"""
Anomaly Detection Service — Phase 3 (Threshold-Based, All Readings)

Flow:
    process_sensor_reading()          ← called by the router
        create_sensor_reading()       ← inserts the reading (flush only)
        query SensorAssignment        ← find active assignment for the sensor
        if no assignment              ← commit and return (no alerts)
        query Plant[]                 ← find all active plants in that zone
        for each distinct PepperId:
            query PepperVariety       ← get optimal thresholds from the pepper itself
            if no variety             ← skip this pepper
            _rule_based_check()       ← compare reading values against variety thresholds
            create_alert() ×N         ← persist each anomaly (dedup inside)
        db.commit()                   ← single atomic commit

Every reading is saved regardless of ReadingType.
TriggersJson is NOT used for anomaly decisions.
Thresholds come from PepperVariety.OptimalTempMinC/MaxC and OptimalSoilMoistureMin/Max.
Deduplication key: (ReadingId, MetricName, PepperId).
"""

from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
import json

from models.sensor import SensorReading
from models.sensor import SensorAssignment
from models.sensor import SensorAlert
from models.plant import Plant
from models.pepper_variety import PepperVariety
from schemas.sensor_reading import AlertResult, SensorReadingCreate, SensorReadingResponse


# ---------------------------------------------------------------------------
# Severity helpers
# ---------------------------------------------------------------------------

def _compute_severity_range(actual: float, min_val: float, max_val: float) -> str:
    """
    High if deviation from midpoint exceeds 20% of the half-range.
    """
    midpoint = (min_val + max_val) / 2.0
    half_range = (max_val - min_val) / 2.0
    if half_range == 0:
        return "High"
    deviation_pct = abs(actual - midpoint) / half_range * 100
    return "High" if deviation_pct > 20 else "Medium"


# ---------------------------------------------------------------------------
# Threshold-based anomaly detection
# ---------------------------------------------------------------------------

def _rule_based_check(
    reading: SensorReading,
    pepper: PepperVariety,
) -> list[dict]:
    """
    Compare a reading against a pepper variety's optimal thresholds.
    Uses OptimalTempMinC/MaxC for temperature and
    OptimalSoilMoistureMin/Max for humidity.
    Returns a list of anomaly dicts with keys:
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
    Deduplication: if an alert already exists for (ReadingId, MetricName, PepperId), return it.
    The caller is responsible for db.commit().
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
    # 1. Insert reading (flush only)
    reading, error = create_sensor_reading(db, data)
    if error:
        return None, f"Failed to create sensor reading: {error}"

    alerts_created: list[SensorAlert] = []

    # 2. Find active assignment
    assignment: Optional[SensorAssignment] = (
        db.query(SensorAssignment)
        .filter(
            SensorAssignment.SensorId == data.sensorId,
            SensorAssignment.IsActive == True,       # noqa: E712
            SensorAssignment.AssignedToUtc == None,  # noqa: E711 — still open
        )
        .first()
    )

    if assignment is not None and assignment.ZoneId is not None:
        # 3. Find all active plants in the zone
        plants = (
            db.query(Plant)
            .filter(
                Plant.ZoneId == assignment.ZoneId,
                Plant.IsActive == True,  # noqa: E712
            )
            .all()
        )

        # Collect distinct PepperIds
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
                continue  # pepper not found or inactive — skip

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

    # 6. Single atomic commit
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
