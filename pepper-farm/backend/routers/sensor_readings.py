from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import OperationalError

from database import get_db
from schemas.sensor_reading import SensorReadingCreate, SensorReadingResponse
from services.anomaly_detection_service import process_sensor_reading

router = APIRouter(prefix="/api/sensor-readings", tags=["Sensor Readings"])


@router.post("", response_model=SensorReadingResponse, status_code=201)
def create_reading_endpoint(
    data: SensorReadingCreate,
    db: Session = Depends(get_db),
):
    """
    Ingest a new sensor reading and automatically detect anomalies.

    - Saves the reading to SensorReadings.
    - Finds the active SensorAssignment and resolves PepperVariety thresholds.
    - Compares each metric against the variety's optimal range.
    - Inserts one SensorAlert row per violated metric (dedup safe).
    - Returns the reading ID and all alerts created in this call.

    If the sensor has no active assignment or no variety is configured,
    the reading is still saved and the response contains zero alerts.
    """
    try:
        result, error = process_sensor_reading(db, data)
        if error:
            status = 404 if "does not exist" in error else 400
            raise HTTPException(status_code=status, detail=error)
        return result
    except HTTPException:
        raise
    except OperationalError:
        db.rollback()
        raise HTTPException(status_code=503, detail="Database connection timeout.")
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Unexpected server error.")
