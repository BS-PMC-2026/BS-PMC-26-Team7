import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import json
from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import IntegrityError

from database import Base

# Import ALL related models so SQLAlchemy can build the FK graph correctly
import models.role            # noqa: F401
import models.pepper_variety  # noqa: F401
import models.farm_zone       # noqa: F401
import models.user            # noqa: F401
import models.plant           # noqa: F401

from models.sensor import Sensor, SensorReading, SensorSyncState, SensorAlert
from services.sensor_service import (
    parse_utc_datetime,
    extract_location,
    get_sensor_by_mac,
    create_sensor_from_reading,
    ensure_sensor_exists,
    reading_exists,
    save_single_reading,
    update_sync_state,
    sync_sensor_readings,
    get_latest_sensor_reading,
    get_sensor_readings_from_db,
    generate_par,
    check_par_threshold,
    create_par_alert_if_needed,
)

# ------------------------------------------------------------------ #
# Setup: SQLite in-memory DB (matches team convention)
# ------------------------------------------------------------------ #

SQLALCHEMY_TEST_URL = "sqlite:///:memory:"
engine = create_engine(SQLALCHEMY_TEST_URL, connect_args={"check_same_thread": False})
TestSession = sessionmaker(bind=engine)


# Teach SQLite the SQL Server function `sysutcdatetime()` used by sensor models.
# In production the DB is Azure SQL which has this built-in; in tests we map it
# to a Python function that returns the current UTC time as ISO string.
@event.listens_for(engine, "connect")
def _register_sqlite_functions(dbapi_connection, connection_record):
    dbapi_connection.create_function(
        "sysutcdatetime", 0,
        lambda: __import__("datetime").datetime.utcnow().isoformat(sep=" ")
    )


@pytest.fixture()
def db():
    Base.metadata.create_all(bind=engine)
    session = TestSession()
    yield session
    session.close()
    Base.metadata.drop_all(bind=engine)


def make_atomation_reading(**overrides):
    """Build a minimal valid Atomation reading payload."""
    base = {
        "mac": "AA:BB:CC:DD:EE:FF",
        "device_name": "Greenhouse Sensor 1",
        "unit_name": "Unit A",
        "business_unit_id": "BU-100",
        "gw_id": "GW-1",
        "Temperature": 24.5,
        "Humidity": 60.2,
        "Leak": 0.0,
        "Vibration SD": 0.1,
        "Battery Level": 85.0,
        "sample_time_utc": "2026-04-27T09:13:17.000Z",
        "gw_read_time_utc": "2026-04-27T09:13:20.000Z",
        "created_at": "2026-04-27T09:13:25.000Z",
        "reading_type": "periodic",
        "triggers": {},
        "location": {"lat": 32.0853, "lng": 34.7818},
    }
    base.update(overrides)
    return base


# ------------------------------------------------------------------ #
# 1. parse_utc_datetime
# ------------------------------------------------------------------ #
def test_parse_utc_datetime_with_z_suffix():
    result = parse_utc_datetime("2026-04-27T09:13:17.000Z")
    assert result == datetime(2026, 4, 27, 9, 13, 17)


def test_parse_utc_datetime_returns_none_for_none():
    assert parse_utc_datetime(None) is None


def test_parse_utc_datetime_returns_none_for_empty_string():
    assert parse_utc_datetime("") is None


def test_parse_utc_datetime_strips_timezone():
    """Result must be naive (no tzinfo) for SQL Server compatibility."""
    result = parse_utc_datetime("2026-04-27T09:13:17.000Z")
    assert result.tzinfo is None


# ------------------------------------------------------------------ #
# 2. extract_location
# ------------------------------------------------------------------ #
def test_extract_location_from_dict():
    reading = {"location": {"lat": 32.08, "lng": 34.78}}
    lat, lng = extract_location(reading)
    assert lat == 32.08
    assert lng == 34.78


def test_extract_location_from_comma_string():
    reading = {"location": "32.08, 34.78"}
    lat, lng = extract_location(reading)
    assert lat == 32.08
    assert lng == 34.78


def test_extract_location_returns_none_when_missing():
    lat, lng = extract_location({})
    assert lat is None
    assert lng is None


def test_extract_location_returns_none_for_invalid_string():
    lat, lng = extract_location({"location": "not-a-coord"})
    assert lat is None
    assert lng is None


# ------------------------------------------------------------------ #
# 3. get_sensor_by_mac
# ------------------------------------------------------------------ #
def test_get_sensor_by_mac_returns_sensor_when_exists(db):
    sensor = Sensor(MacAddress="AA:BB:CC", DeviceName="Test", IsActive=True)
    db.add(sensor)
    db.commit()

    result = get_sensor_by_mac(db, "AA:BB:CC")
    assert result is not None
    assert result.MacAddress == "AA:BB:CC"


def test_get_sensor_by_mac_returns_none_when_missing(db):
    result = get_sensor_by_mac(db, "ZZ:ZZ:ZZ")
    assert result is None


# ------------------------------------------------------------------ #
# 4. create_sensor_from_reading
# ------------------------------------------------------------------ #
def test_create_sensor_from_reading_persists_to_db(db):
    reading = make_atomation_reading()
    sensor = create_sensor_from_reading(db, reading)

    assert sensor.SensorId is not None
    assert sensor.MacAddress == "AA:BB:CC:DD:EE:FF"
    assert sensor.DeviceName == "Greenhouse Sensor 1"
    assert sensor.UnitName == "Unit A"
    assert sensor.IsActive is True


# ------------------------------------------------------------------ #
# 5. ensure_sensor_exists
# ------------------------------------------------------------------ #
def test_ensure_sensor_exists_creates_when_missing(db):
    reading = make_atomation_reading(mac="NEW:MAC:01")
    sensor = ensure_sensor_exists(db, reading)

    assert sensor.SensorId is not None
    assert sensor.MacAddress == "NEW:MAC:01"


def test_ensure_sensor_exists_returns_existing(db):
    existing = Sensor(MacAddress="EXIST:MAC", DeviceName="Existing", IsActive=True)
    db.add(existing)
    db.commit()
    original_id = existing.SensorId

    reading = make_atomation_reading(mac="EXIST:MAC")
    sensor = ensure_sensor_exists(db, reading)

    assert sensor.SensorId == original_id  # didn't create new


def test_ensure_sensor_exists_raises_when_no_mac(db):
    reading = make_atomation_reading()
    del reading["mac"]
    with pytest.raises(ValueError, match="mac address"):
        ensure_sensor_exists(db, reading)


# ------------------------------------------------------------------ #
# 6. reading_exists (deduplication)
# ------------------------------------------------------------------ #
def test_reading_exists_returns_false_for_new(db):
    sensor = Sensor(MacAddress="AA", IsActive=True)
    db.add(sensor)
    db.commit()

    sample_time = datetime(2026, 4, 27, 9, 0, 0)
    assert reading_exists(db, sensor.SensorId, sample_time, "periodic") is False


def test_reading_exists_returns_true_for_duplicate(db):
    sensor = Sensor(MacAddress="AA", IsActive=True)
    db.add(sensor)
    db.commit()

    sample_time = datetime(2026, 4, 27, 9, 0, 0)
    reading = SensorReading(
        SensorId=sensor.SensorId,
        MacAddress="AA",
        SampleTimeUtc=sample_time,
        ReadingType="periodic",
        RawJson="{}",
    )
    db.add(reading)
    db.commit()

    assert reading_exists(db, sensor.SensorId, sample_time, "periodic") is True


# ------------------------------------------------------------------ #
# 7. save_single_reading (the heart of US19)
# ------------------------------------------------------------------ #
def test_save_single_reading_inserts_new_reading(db):
    reading_data = make_atomation_reading()
    inserted, reading_id = save_single_reading(db, reading_data)

    assert inserted is True
    assert reading_id is not None

    saved = db.query(SensorReading).filter_by(ReadingId=reading_id).first()
    assert saved.Temperature == 24.5
    assert saved.Humidity == 60.2
    assert saved.MacAddress == "AA:BB:CC:DD:EE:FF"


def test_save_single_reading_skips_duplicate(db):
    reading_data = make_atomation_reading()
    inserted_first, _ = save_single_reading(db, reading_data)
    inserted_second, _ = save_single_reading(db, reading_data)

    assert inserted_first is True
    assert inserted_second is False  # second call detected duplicate

    count = db.query(SensorReading).count()
    assert count == 1


def test_save_single_reading_raises_when_no_sample_time(db):
    reading_data = make_atomation_reading()
    del reading_data["sample_time_utc"]
    with pytest.raises(ValueError, match="sample_time_utc"):
        save_single_reading(db, reading_data)


def test_save_single_reading_creates_sensor_if_missing(db):
    reading_data = make_atomation_reading(mac="BRAND:NEW:01")
    save_single_reading(db, reading_data)

    sensor = db.query(Sensor).filter_by(MacAddress="BRAND:NEW:01").first()
    assert sensor is not None


def test_save_single_reading_stores_raw_json(db):
    reading_data = make_atomation_reading()
    _, reading_id = save_single_reading(db, reading_data)

    saved = db.query(SensorReading).filter_by(ReadingId=reading_id).first()
    raw = json.loads(saved.RawJson)
    assert raw["mac"] == "AA:BB:CC:DD:EE:FF"


# ------------------------------------------------------------------ #
# 8. update_sync_state
# ------------------------------------------------------------------ #
def test_update_sync_state_creates_first_record(db):
    sensor = Sensor(MacAddress="AA", IsActive=True)
    db.add(sensor)
    db.commit()

    sample_time = datetime(2026, 4, 27, 9, 0, 0)
    update_sync_state(db, sensor.SensorId, sample_time, sample_time, "success")

    state = db.query(SensorSyncState).filter_by(SensorId=sensor.SensorId).first()
    assert state is not None
    assert state.LastSampleTimeUtc == sample_time
    assert state.LastSyncStatus == "success"


def test_update_sync_state_only_updates_when_newer_time(db):
    sensor = Sensor(MacAddress="AA", IsActive=True)
    db.add(sensor)
    db.commit()

    older = datetime(2026, 4, 27, 9, 0, 0)
    newer = datetime(2026, 4, 27, 10, 0, 0)

    update_sync_state(db, sensor.SensorId, newer, newer, "success")
    update_sync_state(db, sensor.SensorId, older, older, "success")  # should NOT overwrite

    state = db.query(SensorSyncState).filter_by(SensorId=sensor.SensorId).first()
    assert state.LastSampleTimeUtc == newer  # kept the newer one


def test_update_sync_state_records_error_status(db):
    sensor = Sensor(MacAddress="AA", IsActive=True)
    db.add(sensor)
    db.commit()

    update_sync_state(db, sensor.SensorId, None, None, "error", error="API down")

    state = db.query(SensorSyncState).filter_by(SensorId=sensor.SensorId).first()
    assert state.LastSyncStatus == "error"
    assert state.LastError == "API down"
    assert state.LastSuccessfulSyncUtc is None  # error → no success timestamp


# ------------------------------------------------------------------ #
# 9. sync_sensor_readings (with mocked Atomation)
# ------------------------------------------------------------------ #
@patch("services.sensor_service.AtomationService")
def test_sync_sensor_readings_inserts_and_skips_duplicates(MockAtomation, db):
    mock_instance = MockAtomation.return_value
    mock_instance.get_sensor_readings.return_value = {
        "readings_data": [make_atomation_reading()],
        "pageCount": 1,
    }

    result = sync_sensor_readings(
        db=db,
        mac_address="AA:BB:CC:DD:EE:FF",
        start_date=datetime(2026, 4, 27, 0, 0),
        end_date=datetime(2026, 4, 28, 0, 0),
    )

    assert result["inserted"] == 1
    assert result["skippedDuplicates"] == 0
    assert result["totalReceived"] == 1


@patch("services.sensor_service.AtomationService")
def test_sync_sensor_readings_handles_pagination(MockAtomation, db):
    mock_instance = MockAtomation.return_value
    mock_instance.get_sensor_readings.side_effect = [
        {"readings_data": [make_atomation_reading(sample_time_utc="2026-04-27T09:00:00.000Z")], "pageCount": 2},
        {"readings_data": [make_atomation_reading(sample_time_utc="2026-04-27T10:00:00.000Z")], "pageCount": 2},
    ]

    result = sync_sensor_readings(
        db=db,
        mac_address="AA:BB:CC:DD:EE:FF",
        start_date=datetime(2026, 4, 27, 0, 0),
        end_date=datetime(2026, 4, 28, 0, 0),
    )

    assert result["inserted"] == 2
    assert mock_instance.get_sensor_readings.call_count == 2


# ------------------------------------------------------------------ #
# 10. get_latest_sensor_reading
# ------------------------------------------------------------------ #
def test_get_latest_sensor_reading_returns_most_recent(db):
    sensor = Sensor(MacAddress="AA", IsActive=True)
    db.add(sensor)
    db.commit()

    older = SensorReading(SensorId=sensor.SensorId, MacAddress="AA",
                           SampleTimeUtc=datetime(2026, 4, 27, 9, 0), RawJson="{}")
    newer = SensorReading(SensorId=sensor.SensorId, MacAddress="AA",
                           SampleTimeUtc=datetime(2026, 4, 27, 10, 0), RawJson="{}")
    db.add_all([older, newer])
    db.commit()

    latest = get_latest_sensor_reading(db, sensor.SensorId)
    assert latest.SampleTimeUtc == datetime(2026, 4, 27, 10, 0)


def test_get_latest_sensor_reading_returns_none_when_no_data(db):
    latest = get_latest_sensor_reading(db, sensor_id=999)
    assert latest is None


# ------------------------------------------------------------------ #
# 11. get_sensor_readings_from_db with date range
# ------------------------------------------------------------------ #
def test_get_sensor_readings_filters_by_date_range(db):
    sensor = Sensor(MacAddress="AA", IsActive=True)
    db.add(sensor)
    db.commit()

    in_range = SensorReading(SensorId=sensor.SensorId, MacAddress="AA",
                              SampleTimeUtc=datetime(2026, 4, 27, 12, 0), RawJson="{}")
    out_range = SensorReading(SensorId=sensor.SensorId, MacAddress="AA",
                               SampleTimeUtc=datetime(2026, 4, 25, 12, 0), RawJson="{}")
    db.add_all([in_range, out_range])
    db.commit()

    results = get_sensor_readings_from_db(
        db, sensor.SensorId,
        start_date=datetime(2026, 4, 27, 0, 0),
        end_date=datetime(2026, 4, 28, 0, 0),
    )
    assert len(results) == 1


# ------------------------------------------------------------------ #
# 12. generate_par – US20 PAR generation realism
# ------------------------------------------------------------------ #
def test_generate_par_returns_non_negative_value():
    assert generate_par() >= 0.0


def test_generate_par_returns_value_within_clamp_range():
    assert 0.0 <= generate_par() <= 1500.0


def test_generate_par_with_all_none_inputs_does_not_crash():
    result = generate_par(sample_time=None, temperature=None, humidity=None)
    assert 0.0 <= result <= 1500.0


def test_generate_par_result_is_rounded_to_two_decimal_places():
    result = generate_par()
    assert result == round(result, 2)


def test_generate_par_never_returns_negative_over_many_runs():
    """Gaussian noise can drive the raw value below 0; clamp must prevent it."""
    import random
    random.seed(0)
    night = datetime(2026, 4, 27, 3, 0, 0)
    for _ in range(300):
        val = generate_par(sample_time=night, temperature=4.0, humidity=95.0)
        assert val >= 0.0, f"Negative PAR generated: {val}"


def test_generate_par_never_exceeds_1500_over_many_runs():
    """Hot midday with dry air could push past 1500 without the clamp."""
    import random
    random.seed(1)
    midday = datetime(2026, 4, 27, 12, 0, 0)
    for _ in range(300):
        val = generate_par(sample_time=midday, temperature=40.0, humidity=15.0)
        assert val <= 1500.0, f"PAR exceeded clamp: {val}"


def test_generate_par_midday_average_higher_than_night_average():
    """Midday hours should produce substantially higher PAR than night hours."""
    import random
    random.seed(42)
    midday = datetime(2026, 4, 27, 12, 0, 0)
    night = datetime(2026, 4, 27, 2, 0, 0)

    midday_avg = sum(generate_par(sample_time=midday) for _ in range(100)) / 100
    night_avg = sum(generate_par(sample_time=night) for _ in range(100)) / 100

    assert midday_avg > night_avg


def test_generate_par_high_humidity_lowers_average_par():
    """Very high humidity (cloud cover) should reduce average PAR."""
    import random
    random.seed(10)
    midday = datetime(2026, 4, 27, 12, 0, 0)

    clear_avg = sum(
        generate_par(sample_time=midday, temperature=25.0, humidity=40.0)
        for _ in range(100)
    ) / 100
    cloudy_avg = sum(
        generate_par(sample_time=midday, temperature=25.0, humidity=92.0)
        for _ in range(100)
    ) / 100

    assert cloudy_avg < clear_avg


# ------------------------------------------------------------------ #
# 13. check_par_threshold – US20 threshold comparison logic
# ------------------------------------------------------------------ #
def test_check_par_below_min_returns_low():
    assert check_par_threshold(100.0, 200.0, 800.0) == "low"


def test_check_par_above_max_returns_high():
    assert check_par_threshold(900.0, 200.0, 800.0) == "high"


def test_check_par_within_range_returns_none():
    assert check_par_threshold(500.0, 200.0, 800.0) is None


def test_check_par_at_exact_min_boundary_is_valid():
    """PAR == OptimalPARMin is exactly at the lower bound – no alert."""
    assert check_par_threshold(200.0, 200.0, 800.0) is None


def test_check_par_at_exact_max_boundary_is_valid():
    """PAR == OptimalPARMax is exactly at the upper bound – no alert."""
    assert check_par_threshold(800.0, 200.0, 800.0) is None


def test_check_par_none_par_returns_none():
    """Missing PAR must not crash and must return None (no alert)."""
    assert check_par_threshold(None, 200.0, 800.0) is None


def test_check_par_none_min_suppresses_low_alert():
    """If OptimalPARMin is absent, low-end violation is not flagged."""
    assert check_par_threshold(50.0, None, 800.0) is None


def test_check_par_none_max_suppresses_high_alert():
    """If OptimalPARMax is absent, high-end violation is not flagged."""
    assert check_par_threshold(1200.0, 200.0, None) is None


def test_check_par_both_thresholds_none_returns_none():
    """No thresholds configured → never alert regardless of PAR value."""
    assert check_par_threshold(500.0, None, None) is None


def test_check_par_none_par_with_both_thresholds_none():
    assert check_par_threshold(None, None, None) is None


def test_check_par_accepts_decimal_thresholds():
    """Thresholds fetched from DB arrive as Decimal; float() cast must handle them."""
    from decimal import Decimal
    assert check_par_threshold(100.0, Decimal("200.00"), Decimal("800.00")) == "low"
    assert check_par_threshold(900.0, Decimal("200.00"), Decimal("800.00")) == "high"
    assert check_par_threshold(500.0, Decimal("200.00"), Decimal("800.00")) is None


# ------------------------------------------------------------------ #
# 14. create_par_alert_if_needed – US20 alert triggering
# ------------------------------------------------------------------ #
def _make_sensor_and_reading(db) -> tuple[int, int]:
    """Insert a Sensor + SensorReading; return (sensor_id, reading_id)."""
    sensor = Sensor(MacAddress="PAR:TEST:01", IsActive=True)
    db.add(sensor)
    db.commit()

    reading = SensorReading(
        SensorId=sensor.SensorId,
        MacAddress="PAR:TEST:01",
        SampleTimeUtc=datetime(2026, 4, 27, 12, 0, 0),
        PAR=500.0,
        RawJson="{}",
    )
    db.add(reading)
    db.commit()
    return sensor.SensorId, reading.ReadingId


def test_create_par_alert_below_min_creates_alert(db):
    sensor_id, reading_id = _make_sensor_and_reading(db)
    alert = create_par_alert_if_needed(
        db, sensor_id, reading_id, pepper_id=None,
        par=100.0, optimal_min=200.0, optimal_max=800.0,
    )
    assert alert is not None
    assert alert.MetricName == "PAR"
    assert alert.ActualValue == 100.0
    assert alert.MinAllowed == 200.0
    assert alert.MaxAllowed == 800.0
    assert "below" in alert.Message.lower()


def test_create_par_alert_above_max_creates_alert(db):
    sensor_id, reading_id = _make_sensor_and_reading(db)
    alert = create_par_alert_if_needed(
        db, sensor_id, reading_id, pepper_id=None,
        par=900.0, optimal_min=200.0, optimal_max=800.0,
    )
    assert alert is not None
    assert alert.MetricName == "PAR"
    assert alert.ActualValue == 900.0
    assert "above" in alert.Message.lower()


def test_create_par_alert_within_range_returns_none(db):
    sensor_id, reading_id = _make_sensor_and_reading(db)
    result = create_par_alert_if_needed(
        db, sensor_id, reading_id, pepper_id=None,
        par=500.0, optimal_min=200.0, optimal_max=800.0,
    )
    assert result is None
    assert db.query(SensorAlert).count() == 0


def test_create_par_alert_none_par_returns_none(db):
    sensor_id, reading_id = _make_sensor_and_reading(db)
    result = create_par_alert_if_needed(
        db, sensor_id, reading_id, pepper_id=None,
        par=None, optimal_min=200.0, optimal_max=800.0,
    )
    assert result is None
    assert db.query(SensorAlert).count() == 0


def test_create_par_alert_none_thresholds_returns_none(db):
    sensor_id, reading_id = _make_sensor_and_reading(db)
    result = create_par_alert_if_needed(
        db, sensor_id, reading_id, pepper_id=None,
        par=500.0, optimal_min=None, optimal_max=None,
    )
    assert result is None
    assert db.query(SensorAlert).count() == 0


def test_create_par_alert_at_exact_min_boundary_no_alert(db):
    """PAR == OptimalPARMin is valid – must not create an alert."""
    sensor_id, reading_id = _make_sensor_and_reading(db)
    result = create_par_alert_if_needed(
        db, sensor_id, reading_id, pepper_id=None,
        par=200.0, optimal_min=200.0, optimal_max=800.0,
    )
    assert result is None


def test_create_par_alert_at_exact_max_boundary_no_alert(db):
    """PAR == OptimalPARMax is valid – must not create an alert."""
    sensor_id, reading_id = _make_sensor_and_reading(db)
    result = create_par_alert_if_needed(
        db, sensor_id, reading_id, pepper_id=None,
        par=800.0, optimal_min=200.0, optimal_max=800.0,
    )
    assert result is None


def test_create_par_alert_sets_severity_warning(db):
    sensor_id, reading_id = _make_sensor_and_reading(db)
    alert = create_par_alert_if_needed(
        db, sensor_id, reading_id, pepper_id=None,
        par=50.0, optimal_min=200.0, optimal_max=800.0,
    )
    assert alert.Severity == "warning"


def test_create_par_alert_persisted_to_db(db):
    sensor_id, reading_id = _make_sensor_and_reading(db)
    alert = create_par_alert_if_needed(
        db, sensor_id, reading_id, pepper_id=None,
        par=50.0, optimal_min=200.0, optimal_max=800.0,
    )
    stored = db.query(SensorAlert).filter_by(AlertId=alert.AlertId).first()
    assert stored is not None
    assert stored.MetricName == "PAR"


def test_create_par_alert_with_pepper_id(db):
    from models.pepper_variety import PepperVariety
    variety = PepperVariety(
        PepperName="Habanero",
        OptimalPARMin=200.0,
        OptimalPARMax=800.0,
        IsActive=True,
    )
    db.add(variety)
    db.commit()

    sensor_id, reading_id = _make_sensor_and_reading(db)
    alert = create_par_alert_if_needed(
        db, sensor_id, reading_id, pepper_id=variety.PepperId,
        par=50.0,
        optimal_min=float(variety.OptimalPARMin),
        optimal_max=float(variety.OptimalPARMax),
    )
    assert alert is not None
    assert alert.PepperId == variety.PepperId


# ------------------------------------------------------------------ #
# 15. PAR field stored in save_single_reading
# ------------------------------------------------------------------ #
def test_save_single_reading_stores_par_value(db):
    """Every new reading must carry a generated PAR value within valid bounds."""
    _, reading_id = save_single_reading(db, make_atomation_reading())

    saved = db.query(SensorReading).filter_by(ReadingId=reading_id).first()
    assert saved.PAR is not None
    assert 0.0 <= saved.PAR <= 1500.0


# ------------------------------------------------------------------ #
# 16. Radiation / UV cleanup – US20 migration verification
# ------------------------------------------------------------------ #
def test_sensor_reading_has_no_radiation_attribute():
    assert not hasattr(SensorReading, "Radiation")


def test_sensor_reading_has_no_uv_attribute():
    assert not hasattr(SensorReading, "UV")


def test_pepper_variety_has_no_optimal_sunlight_hours_attribute():
    from models.pepper_variety import PepperVariety
    assert not hasattr(PepperVariety, "OptimalSunlightHours")