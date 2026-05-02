import json
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from models.sensor import Sensor, SensorReading, SensorSyncState
from services.atomation_service import AtomationService


def parse_utc_datetime(value: str | None) -> datetime | None:
    if not value:
        return None

    # Example: 2026-04-27T09:13:17.000Z
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return parsed.astimezone(timezone.utc).replace(tzinfo=None)


def extract_location(reading: dict[str, Any]) -> tuple[float | None, float | None]:
    location = reading.get("location")

    if isinstance(location, dict):
        return location.get("lat"), location.get("lng")

    if isinstance(location, str) and "," in location:
        try:
            lat_str, lng_str = location.split(",", 1)
            return float(lat_str.strip()), float(lng_str.strip())
        except ValueError:
            return None, None

    return None, None


def get_sensor_by_mac(db: Session, mac_address: str) -> Sensor | None:
    return db.query(Sensor).filter(Sensor.MacAddress == mac_address).first()


def create_sensor_from_reading(db: Session, reading: dict[str, Any]) -> Sensor:
    sensor = Sensor(
        MacAddress=reading["mac"],
        DeviceName=reading.get("device_name"),
        UnitName=reading.get("unit_name"),
        BusinessUnitId=reading.get("business_unit_id"),
        GatewayId=reading.get("gw_id"),
        SensorType="temperature_humidity_leak",
        IsActive=True,
    )

    db.add(sensor)
    db.commit()
    db.refresh(sensor)
    return sensor


def ensure_sensor_exists(db: Session, reading: dict[str, Any]) -> Sensor:
    mac = reading.get("mac")
    if not mac:
        raise ValueError("Reading does not contain mac address.")

    sensor = get_sensor_by_mac(db, mac)
    if sensor:
        return sensor

    return create_sensor_from_reading(db, reading)


def reading_exists(
    db: Session,
    sensor_id: int,
    sample_time_utc: datetime,
    reading_type: str | None,
) -> bool:
    return (
        db.query(SensorReading)
        .filter(
            SensorReading.SensorId == sensor_id,
            SensorReading.SampleTimeUtc == sample_time_utc,
            SensorReading.ReadingType == reading_type,
        )
        .first()
        is not None
    )


def save_single_reading(db: Session, reading: dict[str, Any]) -> tuple[bool, int | None]:
    sensor = ensure_sensor_exists(db, reading)

    sample_time = parse_utc_datetime(reading.get("sample_time_utc"))
    if sample_time is None:
        raise ValueError("Reading does not contain sample_time_utc.")

    reading_type = reading.get("reading_type")

    if reading_exists(db, sensor.SensorId, sample_time, reading_type):
        return False, None

    lat, lng = extract_location(reading)

    sensor_reading = SensorReading(
        SensorId=sensor.SensorId,
        MacAddress=reading.get("mac"),
        DeviceName=reading.get("device_name"),

        Temperature=reading.get("Temperature"),
        Humidity=reading.get("Humidity"),
        Leak=reading.get("Leak"),
        VibrationSD=reading.get("Vibration SD"),
        BatteryLevel=reading.get("Battery Level"),
        Radiation=reading.get("Radiation"),

        SampleTimeUtc=sample_time,
        GatewayReadTimeUtc=parse_utc_datetime(reading.get("gw_read_time_utc")),
        AtomationCreatedAtUtc=parse_utc_datetime(reading.get("created_at")),

        ReadingType=reading_type,
        TriggersJson=json.dumps(reading.get("triggers", {}), ensure_ascii=False),

        Latitude=lat,
        Longitude=lng,

        RawJson=json.dumps(reading, ensure_ascii=False),
    )

    db.add(sensor_reading)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        return False, None

    db.refresh(sensor_reading)
    return True, sensor_reading.ReadingId


def update_sync_state(
    db: Session,
    sensor_id: int,
    last_sample_time: datetime | None,
    last_created_at: datetime | None,
    status: str,
    error: str | None = None,
) -> None:
    sync_state = (
        db.query(SensorSyncState)
        .filter(SensorSyncState.SensorId == sensor_id)
        .first()
    )

    if not sync_state:
        sync_state = SensorSyncState(SensorId=sensor_id)
        db.add(sync_state)

    if last_sample_time is not None:
        if (
            sync_state.LastSampleTimeUtc is None
            or last_sample_time > sync_state.LastSampleTimeUtc
        ):
            sync_state.LastSampleTimeUtc = last_sample_time

    if last_created_at is not None:
        if (
            sync_state.LastAtomationCreatedAtUtc is None
            or last_created_at > sync_state.LastAtomationCreatedAtUtc
        ):
            sync_state.LastAtomationCreatedAtUtc = last_created_at

    if status == "success":
        sync_state.LastSuccessfulSyncUtc = datetime.utcnow()

    sync_state.LastSyncStatus = status
    sync_state.LastError = error

    db.commit()


def sync_sensor_readings(
    db: Session,
    mac_address: str,
    start_date: datetime,
    end_date: datetime,
    created_at: bool = False,
) -> dict[str, Any]:
    atomation = AtomationService()

    inserted_count = 0
    skipped_count = 0
    total_received = 0

    page = 1
    page_count = 1

    latest_sample_time: datetime | None = None
    latest_created_at: datetime | None = None

    while page <= page_count:
        data = atomation.get_sensor_readings(
            mac_addresses=[mac_address],
            start_date=start_date,
            end_date=end_date,
            page=page,
            page_size=1000,
            created_at=created_at,
        )

        readings = data.get("readings_data", [])
        page_count = data.get("pageCount", 1)

        total_received += len(readings)

        for reading in readings:
            inserted, _ = save_single_reading(db, reading)

            if inserted:
                inserted_count += 1
            else:
                skipped_count += 1

            sample_time = parse_utc_datetime(reading.get("sample_time_utc"))
            created_time = parse_utc_datetime(reading.get("created_at"))

            if sample_time and (latest_sample_time is None or sample_time > latest_sample_time):
                latest_sample_time = sample_time

            if created_time and (latest_created_at is None or created_time > latest_created_at):
                latest_created_at = created_time

        page += 1

    sensor = get_sensor_by_mac(db, mac_address)
    if sensor:
        update_sync_state(
            db=db,
            sensor_id=sensor.SensorId,
            last_sample_time=latest_sample_time,
            last_created_at=latest_created_at,
            status="success",
        )

    return {
        "macAddress": mac_address,
        "from": start_date.isoformat(),
        "to": end_date.isoformat(),
        "totalReceived": total_received,
        "inserted": inserted_count,
        "skippedDuplicates": skipped_count,
        "pageCount": page_count,
    }


def get_latest_sensor_reading(db: Session, sensor_id: int) -> SensorReading | None:
    return (
        db.query(SensorReading)
        .filter(SensorReading.SensorId == sensor_id)
        .order_by(SensorReading.SampleTimeUtc.desc())
        .first()
    )


def get_sensor_readings_from_db(
    db: Session,
    sensor_id: int,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
) -> list[SensorReading]:
    query = db.query(SensorReading).filter(SensorReading.SensorId == sensor_id)

    if start_date:
        query = query.filter(SensorReading.SampleTimeUtc >= start_date)

    if end_date:
        query = query.filter(SensorReading.SampleTimeUtc <= end_date)

    return query.order_by(SensorReading.SampleTimeUtc.asc()).all()