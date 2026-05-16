"""
Recurrence Detection Service

Detects two recurrence signals for sensor alerts:
  RECUR-01: Frequency — same sensor+metric fires N+ times within a time window
  RECUR-02: Reappearance — same sensor+metric fires after a prior resolved alert

These are pure read functions. They never commit. The caller
(anomaly_detection_service.process_sensor_reading) sets alert.IsRecurring
and does the single atomic db.commit().
"""

from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func

from models.sensor import SensorAlert
from services.recurrence_config import DEFAULT_RECURRENCE_COUNT, DEFAULT_WINDOW_HOURS


def is_frequency_recurring(
    db: Session,
    sensor_id: int,
    metric_name: str,
    new_alert_id: int,
    threshold_count: int = DEFAULT_RECURRENCE_COUNT,
    window_hours: int = DEFAULT_WINDOW_HOURS,
) -> bool:
    """
    RECUR-01: Returns True if same sensor+metric has >= threshold_count OTHER alerts
    in the rolling window_hours window (excluding new_alert_id to avoid off-by-one).
    Uses naive UTC datetime consistent with CreatedAtUtc server_default=sysutcdatetime().
    """
    cutoff = datetime.utcnow() - timedelta(hours=window_hours)
    count = (
        db.query(func.count(SensorAlert.AlertId))
        .filter(
            SensorAlert.SensorId == sensor_id,
            SensorAlert.MetricName == metric_name,
            SensorAlert.CreatedAtUtc >= cutoff,
            SensorAlert.AlertId != new_alert_id,
        )
        .scalar() or 0
    )
    return count >= threshold_count


def is_reappearance_recurring(
    db: Session,
    sensor_id: int,
    metric_name: str,
) -> bool:
    """
    RECUR-02: Returns True if a prior IsResolved=True alert exists for same sensor+metric.
    Signals that this anomaly type has appeared, been resolved, and is now reappearing.
    """
    return (
        db.query(SensorAlert.AlertId)
        .filter(
            SensorAlert.SensorId == sensor_id,
            SensorAlert.MetricName == metric_name,
            SensorAlert.IsResolved == True,   # noqa: E712
        )
        .first()
    ) is not None


def check_recurrence(
    db: Session,
    sensor_id: int,
    metric_name: str,
    new_alert_id: int,
    threshold_count: int = DEFAULT_RECURRENCE_COUNT,
    window_hours: int = DEFAULT_WINDOW_HOURS,
) -> bool:
    """
    Returns True if either RECUR-01 or RECUR-02 fires.
    Called per-alert in the anomaly pipeline after db.flush().
    """
    return (
        is_frequency_recurring(
            db, sensor_id, metric_name, new_alert_id, threshold_count, window_hours
        )
        or is_reappearance_recurring(db, sensor_id, metric_name)
    )
