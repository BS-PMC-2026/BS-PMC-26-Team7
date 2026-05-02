from datetime import datetime, timedelta
from typing import Optional

from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy.orm import Session

from database import SessionLocal
from models.sensor import Sensor
from services.sensor_service import sync_sensor_readings


# דשבורד חי: תמיד מושכים חלון אחרון.
LIVE_LOOKBACK_HOURS = 48

# תדירות סנכרון אוטומטי.
SYNC_INTERVAL_MINUTES = 30

scheduler: Optional[BackgroundScheduler] = None


def sync_sensor_live_window(db: Session, sensor: Sensor) -> dict:
    end_time = datetime.utcnow()
    start_time = end_time - timedelta(hours=LIVE_LOOKBACK_HOURS)

    result = sync_sensor_readings(
        db=db,
        mac_address=sensor.MacAddress,
        start_date=start_time,
        end_date=end_time,
        created_at=False,
    )

    return {
        "sensorId": sensor.SensorId,
        "macAddress": sensor.MacAddress,
        "mode": "live-window",
        "from": start_time.isoformat(),
        "to": end_time.isoformat(),
        "lookbackHours": LIVE_LOOKBACK_HOURS,
        **result,
    }


def run_sensor_auto_sync_once() -> list[dict]:
    db = SessionLocal()

    try:
        active_sensors = (
            db.query(Sensor)
            .filter(Sensor.IsActive == True)
            .order_by(Sensor.SensorId.asc())
            .all()
        )

        results = []

        for sensor in active_sensors:
            try:
                result = sync_sensor_live_window(db, sensor)
                results.append(result)
            except Exception as sensor_error:
                db.rollback()
                results.append({
                    "sensorId": sensor.SensorId,
                    "macAddress": sensor.MacAddress,
                    "error": str(sensor_error),
                })

        return results

    finally:
        db.close()


def start_sensor_scheduler() -> None:
    global scheduler

    if scheduler is not None and scheduler.running:
        return

    scheduler = BackgroundScheduler(timezone="UTC")

    scheduler.add_job(
        run_sensor_auto_sync_once,
        trigger="interval",
        minutes=SYNC_INTERVAL_MINUTES,
        id="sensor_auto_sync_job",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )

    scheduler.start()

    print("[Sensor Auto Sync] Scheduler started. Live sync will run every 30 minutes.")


def stop_sensor_scheduler() -> None:
    global scheduler

    if scheduler is not None and scheduler.running:
        scheduler.shutdown(wait=False)