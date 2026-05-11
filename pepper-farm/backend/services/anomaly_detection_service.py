"""
Anomaly Detection Service

Flow:
    process_sensor_reading()          - called by the router
        create_sensor_reading()       - inserts the reading
        query SensorAssignment        - find active assignment for the sensor
        if no assignment              - commit and return (no alerts)
        query Plant[]                 - find all active plants in that zone
        for each distinct PepperId:
            query PepperVariety       - get optimal thresholds from the pepper itself
            if no active variety      - check if any variety exists at all:
                                          inactive variety → skip silently
                                          no variety at all → generic alert
            _rule_based_check()       - compare reading values against variety thresholds
            create_alert() x N        - persist each anomaly (dedup inside)
        db.commit()                   - single atomic commit

Every reading is saved regardless of ReadingType.
Thresholds come exclusively from PepperVariety:
  Temperature  → OptimalTempMinC / OptimalTempMaxC
  Soil moisture→ OptimalSoilMoistureMin / OptimalSoilMoistureMax
  PAR          → OptimalPARMin / OptimalPARMax

Deduplication key: (ReadingId, MetricName, PepperId).
"""

import json
from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from models.sensor import (
    SensorReading,
    SensorAssignment,
    SensorAlert,
)
from models.plant import Plant
from models.pepper_variety import PepperVariety
from schemas.sensor_reading import AlertResult, SensorReadingCreate, SensorReadingResponse


# ---------------------------------------------------------------------------
# Severity helpers
# ---------------------------------------------------------------------------

def _compute_severity_range(actual: float, min_val, max_val) -> str:
    """'High' when actual is outside [min_val, max_val], 'Medium' when within range.
    Equal min/max always returns 'High'."""
    if (
        min_val is not None
        and max_val is not None
        and float(min_val) == float(max_val)
    ):
        return "High"
    if actual < float(min_val) or actual > float(max_val):
        return "High"
    return "Medium"


def _compute_severity_leak(value: float, max_val) -> str:
    """Return 'High' when leak is >= 1.5x the allowed max, 'Medium' otherwise.

    When max_val == 0 any non-zero leak is immediately 'High'.
    """
    if max_val == 0:
        return "High"
    if value > float(max_val) * 1.5:
        return "High"
    return "Medium"


# ---------------------------------------------------------------------------
# Metric → PepperVariety field mapping (for trigger-based checks)
# ---------------------------------------------------------------------------

_METRIC_CONFIG: dict[str, tuple[str, str, str]] = {
    "Temperature": ("Temperature", "OptimalTempMinC",        "OptimalTempMaxC"),
    "Humidity":    ("Humidity",    "OptimalSoilMoistureMin", "OptimalSoilMoistureMax"),
    "PAR":         ("PAR",         "OptimalPARMin",          "OptimalPARMax"),
}


# ---------------------------------------------------------------------------
# Rule-based anomaly detection (against PepperVariety thresholds)
# ---------------------------------------------------------------------------

def _rule_based_check(
    reading: SensorReading,
    pepper: PepperVariety,
) -> list[dict]:
    """Compare a reading against a pepper variety's optimal thresholds.

    Checks Temperature (OptimalTempMinC/MaxC), soil moisture via Humidity
    (OptimalSoilMoistureMin/Max), and PAR (OptimalPARMin/Max).
    Returns anomaly dicts with keys:
      metric, actual, min_allowed, max_allowed, severity, message
    """
    anomalies: list[dict] = []

    def _check(metric: str, actual, min_col, max_col, unit: str):
        min_v = float(min_col) if min_col is not None else None
        max_v = float(max_col) if max_col is not None else None
        if actual is None or min_v is None or max_v is None:
            return
        if actual < min_v or actual > max_v:
            anomalies.append({
                "metric": metric,
                "actual": actual,
                "min_allowed": min_v,
                "max_allowed": max_v,
                "severity": _compute_severity_range(actual, min_v, max_v),
                "message": (
                    f"{metric} {actual}{unit} is outside the optimal range "
                    f"[{min_v}, {max_v}]{unit} for {pepper.PepperName}"
                ),
            })

    _check("Temperature", reading.Temperature,
           pepper.OptimalTempMinC,        pepper.OptimalTempMaxC,        " °C")
    _check("Humidity",    reading.Humidity,
           pepper.OptimalSoilMoistureMin, pepper.OptimalSoilMoistureMax, "%")
    _check("PAR",         reading.PAR,
           pepper.OptimalPARMin,          pepper.OptimalPARMax,          " µmol/m²/s")

    return anomalies


# ---------------------------------------------------------------------------
# Trigger-based anomaly detection (TriggersJson-driven, against PepperVariety)
# ---------------------------------------------------------------------------

def _trigger_based_check(
    reading: SensorReading,
    pepper: Optional[PepperVariety],
) -> list[dict]:
    """Create anomaly dicts only for metrics flagged true in TriggersJson.

    Thresholds come from PepperVariety via _METRIC_CONFIG.
    Metrics absent from TriggersJson are ignored even if out of range.
    """
    anomalies: list[dict] = []
    try:
        triggers: dict = json.loads(reading.TriggersJson or "{}")
    except (json.JSONDecodeError, TypeError):
        triggers = {}

    for metric, (reading_attr, min_attr, max_attr) in _METRIC_CONFIG.items():
        if not triggers.get(metric):
            continue
        actual = getattr(reading, reading_attr, None)
        if actual is None:
            continue

        min_val = (
            float(getattr(pepper, min_attr))
            if pepper is not None and getattr(pepper, min_attr, None) is not None
            else None
        )
        max_val = (
            float(getattr(pepper, max_attr))
            if pepper is not None and getattr(pepper, max_attr, None) is not None
            else None
        )

        pepper_name = pepper.PepperName if pepper is not None else "unknown pepper"
        anomalies.append({
            "metric": metric,
            "actual": actual,
            "min_allowed": min_val,
            "max_allowed": max_val,
            "severity": _compute_severity_range(actual, min_val, max_val),
            "message": (
                f"{metric} {actual} triggered; optimal range "
                f"[{min_val}, {max_val}] for {pepper_name}"
            ),
        })

    return anomalies


# ---------------------------------------------------------------------------
# Database helpers
# ---------------------------------------------------------------------------

def create_sensor_reading(
    db: Session,
    data: SensorReadingCreate,
) -> tuple[Optional[SensorReading], Optional[str]]:
    """Persist a new SensorReading and return (reading, None) or (None, error)."""
    try:
        triggers: dict = {}
        if data.rawJson:
            triggers = data.rawJson.get("triggers", {})

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
            RawJson=json.dumps(data.rawJson or {}),
        )

        db.add(reading)
        db.commit()
        db.refresh(reading)
        return reading, None

    except Exception as exc:
        db.rollback()
        return None, str(exc)


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
    """Insert a SensorAlert, deduplicating on (ReadingId, MetricName, PepperId).

    If an alert for the same (reading, metric, pepper) already exists, returns it
    unchanged. The caller is responsible for db.commit().
    """
    existing = (
        db.query(SensorAlert)
        .filter(
            SensorAlert.ReadingId == reading.ReadingId,
            SensorAlert.MetricName == metric,
            SensorAlert.PepperId == pepper_id,
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
    return alert


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------

def process_sensor_reading(
    db: Session,
    data: SensorReadingCreate,
) -> tuple[Optional[SensorReadingResponse], Optional[str]]:
    """Full pipeline: save reading -> detect anomalies -> return response.

    1. Insert reading
    2. Resolve active SensorAssignment
    3. Find all active Plants in that zone
    4. For each distinct PepperId: get PepperVariety, run rule-based check
    5. Persist alerts (dedup on ReadingId + MetricName + PepperId)
    6. Commit everything atomically
    7. Return response

    Every reading is saved. Alerts are generated based on threshold violations
    using PepperVariety.OptimalTempMinC/MaxC and OptimalSoilMoistureMin/Max.
    If no assignment exists or no plants are found, the reading is still saved
    and the response contains zero alerts.
    """
    # 1. Save the reading
    reading, error = create_sensor_reading(db, data)
    if error:
        return None, f"Failed to create sensor reading: {error}"

    base_response = SensorReadingResponse(
        readingId=reading.ReadingId,
        alertsCreated=0,
        alerts=[],
    )

    # 2. Find active open assignment for this sensor
    assignment: Optional[SensorAssignment] = (
        db.query(SensorAssignment)
        .filter(
            SensorAssignment.SensorId == data.sensorId,
            SensorAssignment.IsActive == True,       # noqa: E712
            SensorAssignment.AssignedToUtc == None,  # noqa: E711
        )
        .first()
    )
    if assignment is None:
        return base_response, None

    alerts_created: list[SensorAlert] = []

    if assignment.ZoneId is not None:
        # 3. Find all active plants in the zone
        plants = (
            db.query(Plant)
            .filter(
                Plant.ZoneId == assignment.ZoneId,
                Plant.IsActive == True,  # noqa: E712
            )
            .all()
        )

        # 4. Collect distinct PepperIds from those plants
        pepper_ids = list({p.PepperId for p in plants if p.PepperId is not None})

        for pepper_id in pepper_ids:
            # 4a. Get the pepper variety (thresholds live here)
            pepper: Optional[PepperVariety] = (
                db.query(PepperVariety)
                .filter(
                    PepperVariety.PepperId == pepper_id,
                    PepperVariety.IsActive == True,  # noqa: E712
                )
                .first()
            )

            if pepper is None:
                # Distinguish: inactive variety (skip) vs no variety record (generic alert)
                any_pepper = (
                    db.query(PepperVariety)
                    .filter(PepperVariety.PepperId == pepper_id)
                    .first()
                )
                if any_pepper is not None:
                    continue  # variety exists but is inactive — skip silently
                # No variety record at all — create a generic sensor-level alert
                for metric, val in [("Temperature", reading.Temperature), ("Humidity", reading.Humidity)]:
                    if val is not None:
                        alert = create_alert(
                            db=db,
                            reading=reading,
                            pepper_id=pepper_id,
                            metric=metric,
                            actual=val,
                            min_allowed=None,
                            max_allowed=None,
                            severity="Medium",
                            message=(
                                f"{metric} {val} recorded; no variety configured for pepper_id={pepper_id}"
                            ),
                        )
                        alerts_created.append(alert)
                continue

            # 4b. Detect threshold violations
            anomalies = _rule_based_check(reading, pepper)

            # 5. Persist one alert per anomaly
            for anomaly in anomalies:
                alert = create_alert(
                    db=db,
                    reading=reading,
                    pepper_id=pepper_id,
                    metric=anomaly["metric"],
                    actual=anomaly["actual"],
                    min_allowed=anomaly["min_allowed"],
                    max_allowed=anomaly["max_allowed"],
                    severity=anomaly["severity"],
                    message=anomaly["message"],
                )
                alerts_created.append(alert)

    # 6. Single atomic commit for all alerts
    db.commit()
    db.refresh(reading)

    # 7. Build response
    alert_results = [
        AlertResult(
            pepperId=a.PepperId,
            metricName=a.MetricName,
            actualValue=a.ActualValue,
            minAllowed=a.MinAllowed,
            maxAllowed=a.MaxAllowed,
            severity=a.Severity,
            message=a.Message,
        )
        for a in alerts_created
    ]

    return SensorReadingResponse(
        readingId=reading.ReadingId,
        alertsCreated=len(alert_results),
        alerts=alert_results,
    ), None
