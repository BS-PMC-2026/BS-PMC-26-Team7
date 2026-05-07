"""
Anomaly Detection Service — Phase 2 (Trigger-Based)

Flow:
    process_sensor_reading()          ← called by the router
        create_sensor_reading()       ← inserts the reading (flush only)
        if ReadingType != 'Trigger'   ← skip alert creation, commit and return
        query SensorAssignment        ← find active assignment for the sensor
        query PepperThreshold         ← find active thresholds for the pepper
        analyze_reading()             ← use TriggersJson to find triggered metrics
        create_alert()  ×N            ← persist each alert (dedup inside)
        db.commit()                   ← single atomic commit

Only readings with ReadingType='Trigger' generate alerts.
TriggersJson (set by the sensor device) determines which metrics fired.
Thresholds are used only for MinAllowed/MaxAllowed/Severity enrichment.
"""

import json
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from models.sensor import SensorReading
from models.sensor import SensorAssignment
from models.sensor import PepperThreshold
from models.sensor import SensorAlert
from schemas.sensor_reading import AlertResult, SensorReadingCreate, SensorReadingResponse


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _compute_severity_range(actual: float, min_val: float, max_val: float) -> str:
    """
    High if deviation from midpoint exceeds 20% of the half-range.
    Matches the SQL procedure logic in sp_DetectSensorAnomalies.
    """
    midpoint = (min_val + max_val) / 2.0
    half_range = (max_val - min_val) / 2.0
    if half_range == 0:
        return "High"
    deviation_pct = abs(actual - midpoint) / half_range * 100
    return "High" if deviation_pct > 20 else "Medium"


def _compute_severity_leak(actual: float, max_leak: float) -> str:
    """High if more than 50% above the MaxLeak threshold."""
    if max_leak == 0:
        return "High"  # any leak when MaxLeak=0 is immediately critical
    return "High" if actual > max_leak * 1.5 else "Medium"


def _rule_based_check(
    reading: SensorReading,
    threshold: PepperThreshold,
) -> list[dict]:
    """
    Compare a reading against its pepper's thresholds.
    Returns a list of dicts, each representing one anomaly.
    Keys: metric, actual, min_allowed, max_allowed, severity, message
    """
    anomalies: list[dict] = []

    # --- Temperature ---
    if (
        reading.Temperature is not None
        and threshold.MinTemperature is not None
        and threshold.MaxTemperature is not None
        and (
            reading.Temperature < threshold.MinTemperature
            or reading.Temperature > threshold.MaxTemperature
        )
    ):
        anomalies.append({
            "metric": "Temperature",
            "actual": reading.Temperature,
            "min_allowed": threshold.MinTemperature,
            "max_allowed": threshold.MaxTemperature,
            "severity": _compute_severity_range(
                reading.Temperature, threshold.MinTemperature, threshold.MaxTemperature
            ),
            "message": (
                f"Temperature {reading.Temperature}°C is outside "
                f"[{threshold.MinTemperature}, {threshold.MaxTemperature}] °C"
            ),
        })

    # --- Humidity ---
    if (
        reading.Humidity is not None
        and threshold.MinHumidity is not None
        and threshold.MaxHumidity is not None
        and (
            reading.Humidity < threshold.MinHumidity
            or reading.Humidity > threshold.MaxHumidity
        )
    ):
        anomalies.append({
            "metric": "Humidity",
            "actual": reading.Humidity,
            "min_allowed": threshold.MinHumidity,
            "max_allowed": threshold.MaxHumidity,
            "severity": _compute_severity_range(
                reading.Humidity, threshold.MinHumidity, threshold.MaxHumidity
            ),
            "message": (
                f"Humidity {reading.Humidity}% is outside "
                f"[{threshold.MinHumidity}, {threshold.MaxHumidity}] %"
            ),
        })

    # --- Leak (one-sided: only upper bound) ---
    if (
        reading.Leak is not None
        and threshold.MaxLeak is not None
        and reading.Leak > threshold.MaxLeak
    ):
        anomalies.append({
            "metric": "Leak",
            "actual": reading.Leak,
            "min_allowed": None,
            "max_allowed": threshold.MaxLeak,
            "severity": _compute_severity_leak(reading.Leak, threshold.MaxLeak),
            "message": (
                f"Leak index {reading.Leak} exceeds MaxLeak of {threshold.MaxLeak}"
            ),
        })

    # --- Radiation ---
    if (
        reading.Radiation is not None
        and threshold.MinRadiation is not None
        and threshold.MaxRadiation is not None
        and (
            reading.Radiation < threshold.MinRadiation
            or reading.Radiation > threshold.MaxRadiation
        )
    ):
        anomalies.append({
            "metric": "Radiation",
            "actual": reading.Radiation,
            "min_allowed": threshold.MinRadiation,
            "max_allowed": threshold.MaxRadiation,
            "severity": _compute_severity_range(
                reading.Radiation, threshold.MinRadiation, threshold.MaxRadiation
            ),
            "message": (
                f"Radiation {reading.Radiation} W/m² is outside "
                f"[{threshold.MinRadiation}, {threshold.MaxRadiation}] W/m²"
            ),
        })

    return anomalies


# ---------------------------------------------------------------------------
# Public service functions
# ---------------------------------------------------------------------------

def create_sensor_reading(
    db: Session,
    data: SensorReadingCreate,
) -> tuple[Optional[SensorReading], Optional[str]]:
    """
    Insert a new SensorReading row.
    Uses db.flush() so the ReadingId is available before committing.
    The caller is responsible for db.commit() / db.rollback().
    """
    try:
        raw_json_str = json.dumps(data.rawJson) if data.rawJson is not None else "{}"
        now_utc = datetime.now(timezone.utc).replace(tzinfo=None)
        reading = SensorReading(
            SensorId=data.sensorId,
            MacAddress=data.macAddress,
            DeviceName=data.deviceName,
            Temperature=data.temperature,
            Humidity=data.humidity,
            Leak=data.leak,
            Radiation=data.radiation,
            BatteryLevel=data.batteryLevel,
            ReadingType=data.readingType,
            RawJson=raw_json_str,
            SampleTimeUtc=now_utc,
            InsertedAtUtc=now_utc,
        )
        db.add(reading)
        db.flush()  # populates ReadingId without committing
        return reading, None
    except IntegrityError:
        db.rollback()
        return None, f"Sensor with id {data.sensorId} does not exist."
    except Exception as exc:
        db.rollback()
        return None, str(exc)


def _trigger_based_check(
    reading: SensorReading,
    threshold: Optional[PepperThreshold],
) -> list[dict]:
    """
    Uses TriggersJson (device-determined) to decide which metrics are anomalous.
    Thresholds are used only to enrich MinAllowed/MaxAllowed/Severity.
    Metrics not in TriggersJson or with value=false are ignored.
    """
    triggers: dict = json.loads(reading.TriggersJson or "{}") if reading.TriggersJson else {}

    # Map TriggersJson key -> (reading attr, min threshold attr, max threshold attr)
    METRIC_CONFIG = {
        "Temperature": ("Temperature", "MinTemperature", "MaxTemperature"),
        "Humidity":    ("Humidity",    "MinHumidity",    "MaxHumidity"),
        "Leak":        ("Leak",        None,             "MaxLeak"),
        "Radiation":   ("Radiation",   "MinRadiation",   "MaxRadiation"),
    }

    anomalies: list[dict] = []
    for metric, (reading_attr, min_attr, max_attr) in METRIC_CONFIG.items():
        if not triggers.get(metric):
            continue
        actual = getattr(reading, reading_attr, None)
        if actual is None:
            continue

        min_val = getattr(threshold, min_attr, None) if threshold and min_attr else None
        max_val = getattr(threshold, max_attr, None) if threshold and max_attr else None

        if metric == "Leak":
            severity = _compute_severity_leak(actual, max_val) if max_val is not None else "Medium"
        elif min_val is not None and max_val is not None:
            severity = _compute_severity_range(actual, min_val, max_val)
        else:
            severity = "Medium"

        anomalies.append({
            "metric": metric,
            "actual": actual,
            "min_allowed": min_val,
            "max_allowed": max_val,
            "severity": severity,
            "message": f"{metric} value {actual} triggered sensor alert",
        })

    return anomalies


def analyze_reading(
    reading: SensorReading,
    threshold: Optional[PepperThreshold],
) -> list[dict]:
    """
    Return a list of anomaly dicts for the given Trigger reading.
    Uses TriggersJson to determine which metrics fired.
    Does not write to the database.
    """
    return _trigger_based_check(reading, threshold)


def create_alert(
    db: Session,
    reading: SensorReading,
    pepper_id: Optional[int],
    metric: str,
    actual: float,
    min_allowed: Optional[float],
    max_allowed: Optional[float],
    severity: str,
    message: str,
) -> SensorAlert:
    """
    Persist a single SensorAlert.
    Deduplication: if an alert already exists for (ReadingId, MetricName), return it.
    The caller is responsible for db.commit().
    """
    existing = (
        db.query(SensorAlert)
        .filter(
            SensorAlert.ReadingId == reading.ReadingId,
            SensorAlert.MetricName == metric,
        )
        .first()
    )
    if existing:
        return existing

    alert = SensorAlert(
        SensorId=reading.SensorId,
        ReadingId=reading.ReadingId,
        PepperId=pepper_id,
        MetricName=metric,
        ActualValue=actual,
        MinAllowed=min_allowed,
        MaxAllowed=max_allowed,
        Severity=severity,
        Message=message,
        IsResolved=False,
    )
    db.add(alert)
    db.flush()  # make alert available in-session before final commit
    return alert


def process_sensor_reading(
    db: Session,
    data: SensorReadingCreate,
) -> tuple[Optional[SensorReadingResponse], Optional[str]]:
    """
    Full pipeline:
      1. Insert reading
      2. Resolve active SensorAssignment
      3. Resolve active PepperThreshold
      4. Detect anomalies
      5. Persist alerts (dedup inside create_alert)
      6. Commit everything atomically
      7. Return response

    If no assignment or no threshold exists, the reading is still saved
    and the response contains zero alerts (not an error condition).
    """
    # 1. Insert reading (flush only)
    reading, error = create_sensor_reading(db, data)
    if error:
        return None, f"Failed to create sensor reading: {error}"

    alerts_created: list[SensorAlert] = []

    # Only Trigger readings generate alerts
    if data.readingType != "Trigger":
        db.commit()
        db.refresh(reading)
        return SensorReadingResponse(readingId=reading.ReadingId, alertsCreated=0, alerts=[]), None

    # 2. Find active assignment
    assignment: Optional[SensorAssignment] = (
        db.query(SensorAssignment)
        .filter(
            SensorAssignment.SensorId == data.sensorId,
            SensorAssignment.IsActive == True,  # noqa: E712
            SensorAssignment.AssignedToUtc == None,  # noqa: E711 — still open
        )
        .first()
    )

    if assignment is not None and assignment.PepperId is not None:
        # 3. Find active threshold for this pepper
        threshold: Optional[PepperThreshold] = (
            db.query(PepperThreshold)
            .filter(
                PepperThreshold.PepperId == assignment.PepperId,
                PepperThreshold.IsActive == True,  # noqa: E712
            )
            .first()
        )

        # 4. Detect anomalies from TriggersJson (threshold may be None)
        anomalies = analyze_reading(reading, threshold)

        # 5. Persist one alert per anomaly
        for anomaly in anomalies:
            alert = create_alert(
                db=db,
                reading=reading,
                pepper_id=assignment.PepperId,
                metric=anomaly["metric"],
                actual=anomaly["actual"],
                min_allowed=anomaly["min_allowed"],
                max_allowed=anomaly["max_allowed"],
                severity=anomaly["severity"],
                message=anomaly["message"],
            )
            alerts_created.append(alert)

    # 6. Single atomic commit
    db.commit()
    db.refresh(reading)

    # 7. Build response
    alert_results = [
        AlertResult(
            metricName=a.MetricName,
            actualValue=a.ActualValue,
            minAllowed=a.MinAllowed,
            maxAllowed=a.MaxAllowed,
            severity=a.Severity,
            message=a.Message,
        )
        for a in alerts_created
    ]

    response = SensorReadingResponse(
        readingId=reading.ReadingId,
        alertsCreated=len(alert_results),
        alerts=alert_results,
    )
    return response, None
