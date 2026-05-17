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
from services.recurrence_detection_service import check_recurrence


# ---------------------------------------------------------------------------
# Severity helpers
# ---------------------------------------------------------------------------

def _compute_severity_range(value: float, min_val, max_val) -> str:
    """Return 'High' when value is outside [min_val, max_val], 'Medium' otherwise."""
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

    # --- Temperature ---
    min_temp = float(pepper.OptimalTempMinC) if pepper.OptimalTempMinC is not None else None
    max_temp = float(pepper.OptimalTempMaxC) if pepper.OptimalTempMaxC is not None else None
    if (
        reading.Temperature is not None
        and min_temp is not None
        and max_temp is not None
        and (reading.Temperature < min_temp or reading.Temperature > max_temp)
    ):
        anomalies.append({
            "metric": "Temperature",
            "actual": reading.Temperature,
            "min_allowed": min_temp,
            "max_allowed": max_temp,
            "severity": _compute_severity_range(reading.Temperature, min_temp, max_temp),
            "message": (
                f"Temperature {reading.Temperature}°C is outside the optimal range "
                f"[{min_temp}, {max_temp}] °C for {pepper.PepperName}"
            ),
        })

    # --- Humidity (mapped from OptimalSoilMoistureMin/Max) ---
    min_moisture = float(pepper.OptimalSoilMoistureMin) if pepper.OptimalSoilMoistureMin is not None else None
    max_moisture = float(pepper.OptimalSoilMoistureMax) if pepper.OptimalSoilMoistureMax is not None else None
    if (
        reading.Humidity is not None
        and min_moisture is not None
        and max_moisture is not None
        and (reading.Humidity < min_moisture or reading.Humidity > max_moisture)
    ):
        anomalies.append({
            "metric": "Humidity",
            "actual": reading.Humidity,
            "min_allowed": min_moisture,
            "max_allowed": max_moisture,
            "severity": _compute_severity_range(reading.Humidity, min_moisture, max_moisture),
            "message": (
                f"Humidity {reading.Humidity}% is outside the optimal soil moisture range "
                f"[{min_moisture}, {max_moisture}] % for {pepper.PepperName}"
            ),
        })

    # --- PAR ---
    min_par = float(pepper.OptimalPARMin) if pepper.OptimalPARMin is not None else None
    max_par = float(pepper.OptimalPARMax) if pepper.OptimalPARMax is not None else None
    if (
        reading.PAR is not None
        and min_par is not None
        and max_par is not None
        and (reading.PAR < min_par or reading.PAR > max_par)
    ):
        anomalies.append({
            "metric": "PAR",
            "actual": reading.PAR,
            "min_allowed": min_par,
            "max_allowed": max_par,
            "severity": _compute_severity_range(reading.PAR, min_par, max_par),
            "message": (
                f"PAR {reading.PAR} µmol/m²/s is outside the optimal range "
                f"[{min_par}, {max_par}] for {pepper.PepperName}"
            ),
        })

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
    if not assignment:
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

    # 6. Flush to assign AlertIds without committing, then check recurrence
    if alerts_created:
        db.flush()
        for alert in alerts_created:
            if check_recurrence(db, alert.SensorId, alert.MetricName, alert.AlertId):
                alert.IsRecurring = True

    # 7. Single atomic commit for all alerts + recurrence flags
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
