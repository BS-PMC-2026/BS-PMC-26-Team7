"""
Anomaly Detection Service

When a sensor reading arrives:
  1. Save the reading to the DB.
  2. Find the active SensorAssignment for this sensor.
  3. Resolve which peppers are planted near this sensor:
       a. If the assignment has a direct PlantId → use that plant's PepperId.
       b. Otherwise use the assignment's ZoneId → find all active Plants in the zone.
  4. For each planted pepper, load its PepperVariety thresholds.
  5. Cross-validate the reading values against those thresholds.
  6. Persist one SensorAlert per violation (dedup on ReadingId + MetricName + PepperId).
  7. Commit atomically and return a response.

Thresholds come from PepperVariety:
  OptimalTempMinC      / OptimalTempMaxC       → Temperature
  OptimalSoilMoistureMin / OptimalSoilMoistureMax → Humidity
  OptimalPARMin        / OptimalPARMax          → PAR

Deduplication key: (ReadingId, MetricName, PepperId).
"""

import json
from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from models.sensor import SensorReading, SensorAssignment, SensorAlert
from models.plant import Plant
from models.pepper_variety import PepperVariety
from schemas.sensor_reading import AlertResult, SensorReadingCreate, SensorReadingResponse


# ---------------------------------------------------------------------------
# Severity helper
# ---------------------------------------------------------------------------

def _compute_severity_range(actual: float, min_val: float, max_val: float) -> str:
    """'High' when actual is outside [min_val, max_val], 'Medium' when inside."""
    if float(min_val) == float(max_val):
        return "High"
    deviation = max(float(min_val) - actual, actual - float(max_val), 0)
    half_range = (float(max_val) - float(min_val)) / 2
    return "High" if deviation > half_range * 0.2 else "Medium"


# ---------------------------------------------------------------------------
# Cross-validation: reading vs. PepperVariety thresholds
# ---------------------------------------------------------------------------

def _rule_based_check(reading: SensorReading, pepper: PepperVariety) -> list[dict]:
    """Compare one sensor reading against the optimal ranges defined for a pepper variety.

    Checks (only when both min and max threshold values are set on the variety):
      • Temperature  vs OptimalTempMinC / OptimalTempMaxC
      • Humidity     vs OptimalSoilMoistureMin / OptimalSoilMoistureMax
      • PAR (light)  vs OptimalPARMin / OptimalPARMax

    Returns a list of anomaly dicts:
      { metric, actual, min_allowed, max_allowed, severity, message }
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
# Resolve which pepper varieties to check for a given assignment
# ---------------------------------------------------------------------------

def _resolve_pepper_ids(
    db: Session,
    assignment: SensorAssignment,
) -> list[int]:
    """Return a deduplicated list of active PepperIds relevant to this assignment.

    Priority:
      1. Direct PlantId on the assignment → use that plant's PepperId.
      2. ZoneId on the assignment → find all active plants in the zone.
    """
    # Case 1: sensor assigned directly to a plant
    if assignment.PlantId is not None:
        plant: Optional[Plant] = (
            db.query(Plant)
            .filter(
                Plant.PlantId == assignment.PlantId,
                Plant.IsActive == True,   # noqa: E712
            )
            .first()
        )
        if plant and plant.PepperId is not None:
            return [plant.PepperId]
        return []

    # Case 2: sensor assigned to a zone → scan all active plants in that zone
    if assignment.ZoneId is not None:
        plants = (
            db.query(Plant)
            .filter(
                Plant.ZoneId == assignment.ZoneId,
                Plant.IsActive == True,   # noqa: E712
            )
            .all()
        )
        return list({p.PepperId for p in plants if p.PepperId is not None})

    return []


# ---------------------------------------------------------------------------
# Persistence helpers
# ---------------------------------------------------------------------------

def create_sensor_reading(
    db: Session,
    data: SensorReadingCreate,
) -> "tuple[SensorReading | None, str | None]":
    """Persist a new SensorReading. Returns (reading, None) or (None, error_message)."""
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
    pepper_id: int | None,
    metric: str,
    actual: float,
    min_allowed: float | None,
    max_allowed: float | None,
    severity: str,
    message: str,
) -> SensorAlert:
    """Persist a SensorAlert, deduplicating on (ReadingId, MetricName, PepperId).

    If an alert already exists for that combination, returns it unchanged.
    The caller is responsible for calling db.commit().
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
) -> "tuple[SensorReadingResponse | None, str | None]":
    """Save a sensor reading, cross-validate against planted pepper thresholds, create alerts.

    Steps:
      1. Insert the reading (always saved, regardless of ReadingType).
      2. Find the active open SensorAssignment for this sensor.
      3. Resolve which pepper varieties are planted at this sensor's location.
      4. For each pepper variety, run _rule_based_check against the reading values.
      5. Persist one SensorAlert per violation (dedup by ReadingId + MetricName + PepperId).
      6. Commit everything atomically.
      7. Return a SensorReadingResponse with the alert list.

    If no active assignment is found, or no planted peppers are found,
    the reading is still saved and the response contains zero alerts.
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

    # 2. Find the active open assignment for this sensor
    assignment: Optional[SensorAssignment] = (
        db.query(SensorAssignment)
        .filter(
            SensorAssignment.SensorId == data.sensorId,
            SensorAssignment.IsActive == True,       # noqa: E712
            SensorAssignment.AssignedToUtc == None,  # noqa: E711  (open-ended = still active)
        )
        .first()
    )
    if assignment is None:
        return base_response, None

    # 3. Resolve which pepper varieties are planted at this sensor location
    pepper_ids = _resolve_pepper_ids(db, assignment)
    if not pepper_ids:
        return base_response, None

    # 4 & 5. For each pepper variety, cross-validate and persist alerts
    alerts_created: list[SensorAlert] = []

    for pepper_id in pepper_ids:
        pepper: Optional[PepperVariety] = (
            db.query(PepperVariety)
            .filter(
                PepperVariety.PepperId == pepper_id,
                PepperVariety.IsActive == True,  # noqa: E712
            )
            .first()
        )
        if pepper is None:
            continue

        anomalies = _rule_based_check(reading, pepper)

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

    # 6. Single atomic commit
    db.commit()

    # 7. Build and return the response
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
