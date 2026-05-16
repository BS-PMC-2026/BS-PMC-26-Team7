"""
Recurrence Detection Service

Detects two recurrence signals for sensor alerts:
  RECUR-01: Frequency — same sensor+metric fires N+ times within a time window
  RECUR-02: Reappearance — same sensor+metric fires after a prior resolved alert

These are pure read functions. They never commit. The caller
(anomaly_detection_service.process_sensor_reading) sets alert.IsRecurring
and does the single atomic db.commit().
"""

import json
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func
import redis

from models.sensor import SensorAlert, RecurrenceConfig
from services.recurrence_config import DEFAULT_RECURRENCE_COUNT, DEFAULT_WINDOW_HOURS

# ---------------------------------------------------------------------------
# Redis config cache — avoids a DB round-trip on every alert processed.
# TTL: 60 seconds. Invalidated immediately on PATCH via
# invalidate_recurrence_config_cache().
# ---------------------------------------------------------------------------
_REDIS_KEY = "recurrence_config"
_CONFIG_CACHE_TTL = 60  # seconds

_redis_client: redis.Redis | None = None


def _get_redis() -> redis.Redis | None:
    global _redis_client
    if _redis_client is None:
        try:
            _redis_client = redis.Redis(host="localhost", port=6379, db=0, decode_responses=True)
            _redis_client.ping()
        except Exception:
            _redis_client = None
    return _redis_client


def invalidate_recurrence_config_cache() -> None:
    """Call this after any write to RecurrenceConfig to clear the Redis cache immediately."""
    r = _get_redis()
    if r:
        try:
            r.delete(_REDIS_KEY)
        except Exception:
            pass


def get_recurrence_config(db: Session) -> tuple[int, int]:
    """
    Returns (min_count, window_hours).
    Served from Redis cache; hits DB only on cache miss or after expiry / invalidation.
    Falls back to DB directly if Redis is unavailable.
    """
    r = _get_redis()
    if r:
        try:
            cached = r.get(_REDIS_KEY)
            if cached:
                data = json.loads(cached)
                return data["min_count"], data["window_hours"]
        except Exception:
            pass

    cfg = db.query(RecurrenceConfig).filter(RecurrenceConfig.ConfigId == 1).first()
    result = (cfg.MinCount, cfg.WindowHours) if cfg else (DEFAULT_RECURRENCE_COUNT, DEFAULT_WINDOW_HOURS)

    if r:
        try:
            r.setex(_REDIS_KEY, _CONFIG_CACHE_TTL, json.dumps({"min_count": result[0], "window_hours": result[1]}))
        except Exception:
            pass

    return result


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
    threshold_count: int | None = None,
    window_hours: int | None = None,
) -> bool:
    """
    Returns True if either RECUR-01 or RECUR-02 fires.
    Called per-alert in the anomaly pipeline after db.flush().
    Reads threshold_count and window_hours from DB RecurrenceConfig if not provided.
    """
    if threshold_count is None or window_hours is None:
        db_count, db_hours = get_recurrence_config(db)
        threshold_count = threshold_count if threshold_count is not None else db_count
        window_hours = window_hours if window_hours is not None else db_hours
    return (
        is_frequency_recurring(
            db, sensor_id, metric_name, new_alert_id, threshold_count, window_hours
        )
        or is_reappearance_recurring(db, sensor_id, metric_name)
    )


def get_occurrence_count(
    db: Session,
    sensor_id: int,
    metric_name: str,
    window_hours: int | None = None,
) -> int:
    """
    Returns the total number of SensorAlert rows for the given sensor+metric
    within the rolling window_hours window. Used to populate occurrenceCount
    in the API response for the recurring badge tooltip.
    N+1 is acceptable at page size 50; document as known limitation.
    If window_hours is None, reads from DB RecurrenceConfig.
    """
    if window_hours is None:
        _, window_hours = get_recurrence_config(db)
    cutoff = datetime.utcnow() - timedelta(hours=window_hours)
    return (
        db.query(func.count(SensorAlert.AlertId))
        .filter(
            SensorAlert.SensorId == sensor_id,
            SensorAlert.MetricName == metric_name,
            SensorAlert.CreatedAtUtc >= cutoff,
        )
        .scalar() or 0
    )
