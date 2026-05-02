import base64
import os
import smtplib
from datetime import datetime, timedelta
from email import encoders
from email.mime.base import MIMEBase
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from database import get_db
from models.sensor import Sensor, SensorAlert as SensorAlertModel, SensorReading as ReadingModel
from schemas.sensor import SensorAlertResponse, SensorReadingResponse, SensorResponse, SensorSyncRequest
from services.sensor_auto_sync_service import run_sensor_auto_sync_once
from services.sensor_service import (
    get_latest_sensor_reading,
    get_sensor_readings_from_db,
    sync_sensor_readings,
)

router = APIRouter(prefix="/api/sensors", tags=["Sensors"])


class _ExportAttachment(BaseModel):
    filename: str
    content: str       # base64-encoded file bytes
    contentType: str


class _ExportEmailRequest(BaseModel):
    to: EmailStr
    attachments: list[_ExportAttachment]


@router.get("", response_model=list[SensorResponse])
def list_sensors(db: Session = Depends(get_db)):
    return db.query(Sensor).order_by(Sensor.SensorId.asc()).all()


@router.post("/export/email")
def send_export_email(request: _ExportEmailRequest):
    smtp_host     = os.getenv("SMTP_HOST", "")
    smtp_port     = int(os.getenv("SMTP_PORT", "587"))
    smtp_user     = os.getenv("SMTP_USER", "")
    smtp_password = os.getenv("SMTP_PASSWORD", "")
    smtp_from     = os.getenv("SMTP_FROM", "") or smtp_user

    if not smtp_host or not smtp_user or not smtp_password:
        raise HTTPException(
            status_code=503,
            detail="Email service is not configured on this server. "
                   "Set SMTP_HOST, SMTP_USER, SMTP_PASSWORD in the backend .env file.",
        )

    msg             = MIMEMultipart()
    msg["From"]     = smtp_from
    msg["To"]       = str(request.to)
    msg["Subject"]  = "Pepper Farm – Sensor Data Export"
    msg.attach(MIMEText(
        "Please find the requested sensor data export attached.\n\nPepper Farm",
        "plain",
    ))

    for att in request.attachments:
        part = MIMEBase("application", "octet-stream")
        part.set_payload(base64.b64decode(att.content))
        encoders.encode_base64(part)
        part.add_header("Content-Disposition", f'attachment; filename="{att.filename}"')
        msg.attach(part)

    try:
        with smtplib.SMTP(smtp_host, smtp_port) as smtp:
            smtp.ehlo()
            smtp.starttls()
            smtp.ehlo()
            smtp.login(smtp_user, smtp_password)
            smtp.send_message(msg)
    except smtplib.SMTPException as exc:
        raise HTTPException(status_code=502, detail=f"Failed to send email: {exc}")

    return {"message": "Email sent successfully."}


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

@router.get("/{sensor_id}/alerts", response_model=list[SensorAlertResponse])
def get_sensor_alerts(
    sensor_id: int,
    startDate: datetime | None = None,
    endDate: datetime | None = None,
    db: Session = Depends(get_db),
):
    query = (
        db.query(SensorAlertModel)
        .join(ReadingModel, SensorAlertModel.ReadingId == ReadingModel.ReadingId)
        .filter(SensorAlertModel.SensorId == sensor_id)
    )
    if startDate:
        query = query.filter(ReadingModel.SampleTimeUtc >= startDate)
    if endDate:
        query = query.filter(ReadingModel.SampleTimeUtc <= endDate)
    return query.order_by(SensorAlertModel.AlertId.asc()).all()


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