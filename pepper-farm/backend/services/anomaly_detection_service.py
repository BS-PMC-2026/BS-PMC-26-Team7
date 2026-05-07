import json
from datetime import datetime

from sqlalchemy.orm import Session

from models.sensor import (
    SensorReading,
    SensorAssignment,
    SensorAlert,
    PepperThreshold,
)
from schemas.sensor_reading import SensorReadingCreate, AlertResult, SensorReadingResponse

# Metrics supported by trigger-based anomaly detection.
# Each entry: metric_name -> (reading_attr, threshold_min_attr, threshold_max_attr, severity_type)
_METRIC_CONFIG: dict[str, tuple[str, str | None, str | None, str]] = {
    "Temperature": ("Temperature", "MinTemperature", "MaxTemperature", "range"),
    "Humidity":    ("Humidity",    "MinHumidity",    "MaxHumidity",    "range"),
    "Leak":        ("Leak",        None,             "MaxLeak",        "leak"),
}


def _compute_severity_range(value: float, min_val, max_val) -> str:
    """Return 'High' when value is outside [min_val, max_val], 'Medium' when inside.

    When min_val == max_val, any value is considered 'High' (zero-width range
    avoids a divide-by-zero in hypothetical normalized calculations).
    """
    if (
        min_val is not None
        and max_val is not None
        and float(min_val) == float(max_val)
    ):
        return "High"
    if min_val is not None and value < float(min_val):
        return "High"
    if max_val is not None and value > float(max_val):
        return "High"
    return "Medium"


def _compute_severity_leak(value: float, max_val) -> str:
    """Return 'High' when leak is ≥ 1.5× the allowed max, 'Medium' otherwise.

    When max_val == 0 any non-zero leak is immediately 'High'.
    """
    if max_val == 0:
        return "High"
    if value > float(max_val) * 1.5:
        return "High"
    return "Medium"


def _trigger_based_check(
    reading: SensorReading,
    threshold: "PepperThreshold | None",
) -> list[dict]:
    """Return anomaly dicts for every metric flagged True in reading.TriggersJson.

    Only processes metrics present in _METRIC_CONFIG.  Radiation is not
    included — PAR is the light-related metric since the US20 migration.
    """
    if not reading.TriggersJson:
        return []

    try:
        triggers: dict = json.loads(reading.TriggersJson)
    except (json.JSONDecodeError, TypeError):
        return []

    anomalies: list[dict] = []

    for metric, (attr, min_attr, max_attr, severity_type) in _METRIC_CONFIG.items():
        if not triggers.get(metric):
            continue

        actual = getattr(reading, attr, None)
        if actual is None:
            continue

        if threshold is None:
            anomalies.append(
                {
                    "metric": metric,
                    "actual": actual,
                    "min_allowed": None,
                    "max_allowed": None,
                    "severity": "Medium",
                }
            )
            continue

        min_val = getattr(threshold, min_attr, None) if min_attr else None
        max_val = getattr(threshold, max_attr, None) if max_attr else None

        if severity_type == "range":
            if min_val is not None or max_val is not None:
                severity = _compute_severity_range(actual, min_val, max_val)
            else:
                severity = "Medium"
        else:
            severity = _compute_severity_leak(actual, max_val) if max_val is not None else "Medium"

        anomalies.append(
            {
                "metric": metric,
                "actual": actual,
                "min_allowed": float(min_val) if min_val is not None else None,
                "max_allowed": float(max_val) if max_val is not None else None,
                "severity": severity,
            }
        )

    return anomalies


def create_sensor_reading(
    db: Session,
    data: SensorReadingCreate,
) -> "tuple[SensorReading | None, str | None]":
    """Persist a new SensorReading and return (reading, None) or (None, error).

    Radiation is intentionally omitted — it was removed in the US20 migration.
    PAR is the current light-related metric and is computed separately.
    """
    try:
        triggers: dict = {}
        if data.rawJson:
            triggers = data.rawJson.get("triggers", {})

        raw_json_str = json.dumps(data.rawJson or {})

        reading = SensorReading(
            SensorId=data.sensorId,
            MacAddress=data.macAddress,
            DeviceName=data.deviceName,
            Temperature=data.temperature,
            Humidity=data.humidity,
            Leak=data.leak,
            BatteryLevel=data.batteryLevel,
            ReadingType=data.readingType,
            TriggersJson=json.dumps(triggers),
            SampleTimeUtc=datetime.utcnow(),
            RawJson=raw_json_str,
        )

        db.add(reading)
        db.commit()
        db.refresh(reading)
        return reading, None

    except Exception as exc:
        db.rollback()
        return None, str(exc)


def analyze_reading(
    reading: SensorReading,
    threshold: "PepperThreshold | None",
) -> list[dict]:
    """Public wrapper around _trigger_based_check."""
    return _trigger_based_check(reading, threshold)


def create_alert(
    db: Session,
    reading: SensorReading,
    pepper_id: int | None,
    metric: str,
    actual: float,
    min_allowed: float | None,
    max_allowed: float | None,
    severity: str,
    message: str,
) -> SensorAlert:
    """Insert a SensorAlert, deduplicating on (ReadingId, MetricName).

    If an alert for the same reading + metric already exists, returns it
    unchanged rather than creating a duplicate.
    """
    existing = (
        db.query(SensorAlert)
        .filter_by(ReadingId=reading.ReadingId, MetricName=metric)
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
    return alert


def process_sensor_reading(
    db: Session,
    data: SensorReadingCreate,
) -> "tuple[SensorReadingResponse | None, str | None]":
    """Full pipeline: save reading → optionally detect anomalies → return response.

    Alerts are only generated for Trigger-type readings that have an active
    sensor assignment.  Radiation is not checked anywhere in this pipeline.
    """
    reading, error = create_sensor_reading(db, data)
    if error:
        return None, f"Failed to create sensor reading: {error}"

    base_response = SensorReadingResponse(
        readingId=reading.ReadingId,
        alertsCreated=0,
        alerts=[],
    )

    if not data.readingType or data.readingType.lower() != "trigger":
        return base_response, None

    assignment = (
        db.query(SensorAssignment)
        .filter(
            SensorAssignment.SensorId == data.sensorId,
            SensorAssignment.IsActive == True,
        )
        .first()
    )
    if not assignment:
        return base_response, None

    threshold = (
        db.query(PepperThreshold)
        .filter(
            PepperThreshold.PepperId == assignment.PepperId,
            PepperThreshold.IsActive == True,
        )
        .first()
    )

    anomalies = analyze_reading(reading, threshold)

    alert_results: list[AlertResult] = []
    for anomaly in anomalies:
        msg = (
            f"{anomaly['metric']} {anomaly['actual']} is anomalous "
            f"(severity: {anomaly['severity']})"
        )
        create_alert(
            db=db,
            reading=reading,
            pepper_id=assignment.PepperId,
            metric=anomaly["metric"],
            actual=anomaly["actual"],
            min_allowed=anomaly.get("min_allowed"),
            max_allowed=anomaly.get("max_allowed"),
            severity=anomaly["severity"],
            message=msg,
        )
        alert_results.append(
            AlertResult(
                metricName=anomaly["metric"],
                actualValue=anomaly["actual"],
                minAllowed=anomaly.get("min_allowed"),
                maxAllowed=anomaly.get("max_allowed"),
                severity=anomaly["severity"],
                message=msg,
            )
        )

    db.commit()

    return (
        SensorReadingResponse(
            readingId=reading.ReadingId,
            alertsCreated=len(alert_results),
            alerts=alert_results,
        ),
        None,
    )
