from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import OperationalError
from services.sensor_auto_sync_service import run_sensor_auto_sync_once
from database import get_db
from models.sensor import Sensor
from schemas.sensor import SensorResponse, SensorReadingResponse, SensorSyncRequest
from services.sensor_service import (
    sync_sensor_readings,
    get_latest_sensor_reading,
    get_sensor_readings_from_db,
)

router = APIRouter(prefix="/api/sensors", tags=["Sensors"])


@router.get("", response_model=list[SensorResponse])
def list_sensors(db: Session = Depends(get_db)):
    return db.query(Sensor).order_by(Sensor.SensorId.asc()).all()


@router.post("/sync")
def sync_sensor_data(data: SensorSyncRequest, db: Session = Depends(get_db)):
    try:
        if data.endDate <= data.startDate:
            raise HTTPException(status_code=400, detail="endDate must be after startDate.")

        # Conservative protection according to Atomation limits.
        max_range = timedelta(days=2) if data.createdAt else timedelta(days=14)
        if data.endDate - data.startDate > max_range:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Requested range is too large. "
                    "Use max 2 days when createdAt=true, or max 14 days when createdAt=false."
                ),
            )

        return sync_sensor_readings(
            db=db,
            mac_address=data.macAddress,
            start_date=data.startDate,
            end_date=data.endDate,
            created_at=data.createdAt,
        )

    except HTTPException:
        raise
    except OperationalError:
        db.rollback()
        raise HTTPException(status_code=503, detail="Database connection timeout.")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{sensor_id}/refresh")
def refresh_sensor_live(sensor_id: int, db: Session = Depends(get_db)):
    sensor = db.query(Sensor).filter(Sensor.SensorId == sensor_id).first()
    if not sensor:
        raise HTTPException(status_code=404, detail="Sensor not found.")

    end_date = datetime.utcnow()
    start_date = end_date - timedelta(hours=48)

    try:
        return sync_sensor_readings(
            db=db,
            mac_address=sensor.MacAddress,
            start_date=start_date,
            end_date=end_date,
            created_at=False,
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{sensor_id}/live")
def get_sensor_live_data(sensor_id: int, db: Session = Depends(get_db)):
    sensor = db.query(Sensor).filter(Sensor.SensorId == sensor_id).first()

    if not sensor:
        raise HTTPException(status_code=404, detail="Sensor not found.")

    end_date = datetime.utcnow()
    start_date = end_date - timedelta(hours=48)

    sync_result = None

    try:
        sync_result = sync_sensor_readings(
            db=db,
            mac_address=sensor.MacAddress,
            start_date=start_date,
            end_date=end_date,
            created_at=False,
        )
    except Exception as e:
        db.rollback()
        sync_result = {
            "error": str(e),
            "message": "Failed to sync from Atomation. Returning latest DB reading if available.",
        }

    latest_reading = get_latest_sensor_reading(db, sensor_id)

    if latest_reading is None:
        return {
            "sensorId": sensor.SensorId,
            "macAddress": sensor.MacAddress,
            "sync": sync_result,
            "latestReading": None,
            "status": "no_data",
            "isStale": True,
            "staleMinutes": None,
            "message": "No readings found for this sensor.",
        }

    stale_minutes = int((datetime.utcnow() - latest_reading.SampleTimeUtc).total_seconds() // 60)

    if stale_minutes <= 30:
        status = "live"
        is_stale = False
        message = "Sensor data is up to date."
    elif stale_minutes <= 360:
        status = "recent"
        is_stale = False
        message = "Sensor data is recent, but not fully live."
    else:
        status = "stale"
        is_stale = True
        message = "Sensor data is stale. No recent readings were received from Atomation."

    latest_payload = SensorReadingResponse.model_validate(latest_reading).model_dump(mode="json")

    return {
        "sensorId": sensor.SensorId,
        "macAddress": sensor.MacAddress,
        "sync": sync_result,
        "latestReading": latest_payload,
        "status": status,
        "isStale": is_stale,
        "staleMinutes": stale_minutes,
        "message": message,
    }

@router.get("/{sensor_id}/latest", response_model=SensorReadingResponse)
def get_latest_reading(sensor_id: int, db: Session = Depends(get_db)):
    reading = get_latest_sensor_reading(db, sensor_id)
    if not reading:
        raise HTTPException(status_code=404, detail="No readings found for this sensor.")
    return reading


@router.get("/{sensor_id}/readings", response_model=list[SensorReadingResponse])
def get_readings(
    sensor_id: int,
    startDate: datetime | None = None,
    endDate: datetime | None = None,
    db: Session = Depends(get_db),
):
    return get_sensor_readings_from_db(
        db=db,
        sensor_id=sensor_id,
        start_date=startDate,
        end_date=endDate,
    )

@router.post("/auto-sync/run-now")
def run_auto_sync_now():
    try:
        return run_sensor_auto_sync_once()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))