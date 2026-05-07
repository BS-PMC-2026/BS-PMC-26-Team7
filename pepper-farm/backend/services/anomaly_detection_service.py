from sqlalchemy.orm import Session

from models.sensor import (
    SensorReading,
    SensorAssignment,
    SensorAlert,
    PepperThreshold,
)
from models.pepper_variety import PepperVariety
from services.sensor_service import create_par_alert_if_needed


def get_pepper_for_sensor(db: Session, sensor_id: int) -> "PepperVariety | None":
    assignment = (
        db.query(SensorAssignment)
        .filter(
            SensorAssignment.SensorId == sensor_id,
            SensorAssignment.IsActive == True,
        )
        .first()
    )
    if not assignment or not assignment.PepperId:
        return None
    return (
        db.query(PepperVariety)
        .filter(PepperVariety.PepperId == assignment.PepperId)
        .first()
    )


def get_active_threshold(db: Session, pepper_id: int) -> "PepperThreshold | None":
    return (
        db.query(PepperThreshold)
        .filter(
            PepperThreshold.PepperId == pepper_id,
            PepperThreshold.IsActive == True,
        )
        .first()
    )


def check_temperature(value: float | None, min_val, max_val) -> str | None:
    if value is None:
        return None
    if min_val is not None and value < float(min_val):
        return "low"
    if max_val is not None and value > float(max_val):
        return "high"
    return None


def check_humidity(value: float | None, min_val, max_val) -> str | None:
    if value is None:
        return None
    if min_val is not None and value < float(min_val):
        return "low"
    if max_val is not None and value > float(max_val):
        return "high"
    return None


def check_leak(value: float | None, max_val) -> str | None:
    if value is None:
        return None
    if max_val is not None and value > float(max_val):
        return "high"
    return None


def _create_metric_alert(
    db: Session,
    sensor_id: int,
    reading_id: int,
    pepper_id: int | None,
    metric: str,
    actual: float,
    min_allowed: float | None,
    max_allowed: float | None,
    direction: str,
    severity: str,
) -> SensorAlert:
    if direction == "low":
        message = (
            f"{metric} {actual} is below minimum threshold ({min_allowed})"
        )
    else:
        message = (
            f"{metric} {actual} is above maximum threshold ({max_allowed})"
        )

    alert = SensorAlert(
        SensorId=sensor_id,
        ReadingId=reading_id,
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
    db.commit()
    db.refresh(alert)
    return alert


def process_sensor_reading(db: Session, reading: SensorReading) -> list[SensorAlert]:
    """Check a SensorReading against all configured thresholds and create alerts.

    Returns the list of SensorAlert rows that were created.
    """
    alerts: list[SensorAlert] = []

    pepper = get_pepper_for_sensor(db, reading.SensorId)
    pepper_id = pepper.PepperId if pepper else None

    par_min = float(pepper.OptimalPARMin) if pepper and pepper.OptimalPARMin is not None else None
    par_max = float(pepper.OptimalPARMax) if pepper and pepper.OptimalPARMax is not None else None
    par_alert = create_par_alert_if_needed(
        db,
        sensor_id=reading.SensorId,
        reading_id=reading.ReadingId,
        pepper_id=pepper_id,
        par=reading.PAR,
        optimal_min=par_min,
        optimal_max=par_max,
    )
    if par_alert:
        alerts.append(par_alert)

    if pepper is None:
        return alerts

    threshold = get_active_threshold(db, pepper.PepperId)
    if threshold is None:
        return alerts

    temp_dir = check_temperature(reading.Temperature, threshold.MinTemperature, threshold.MaxTemperature)
    if temp_dir:
        alerts.append(
            _create_metric_alert(
                db,
                sensor_id=reading.SensorId,
                reading_id=reading.ReadingId,
                pepper_id=pepper_id,
                metric="Temperature",
                actual=reading.Temperature,
                min_allowed=float(threshold.MinTemperature) if threshold.MinTemperature is not None else None,
                max_allowed=float(threshold.MaxTemperature) if threshold.MaxTemperature is not None else None,
                direction=temp_dir,
                severity="warning",
            )
        )

    hum_dir = check_humidity(reading.Humidity, threshold.MinHumidity, threshold.MaxHumidity)
    if hum_dir:
        alerts.append(
            _create_metric_alert(
                db,
                sensor_id=reading.SensorId,
                reading_id=reading.ReadingId,
                pepper_id=pepper_id,
                metric="Humidity",
                actual=reading.Humidity,
                min_allowed=float(threshold.MinHumidity) if threshold.MinHumidity is not None else None,
                max_allowed=float(threshold.MaxHumidity) if threshold.MaxHumidity is not None else None,
                direction=hum_dir,
                severity="warning",
            )
        )

    leak_dir = check_leak(reading.Leak, threshold.MaxLeak)
    if leak_dir:
        alerts.append(
            _create_metric_alert(
                db,
                sensor_id=reading.SensorId,
                reading_id=reading.ReadingId,
                pepper_id=pepper_id,
                metric="Leak",
                actual=reading.Leak,
                min_allowed=None,
                max_allowed=float(threshold.MaxLeak) if threshold.MaxLeak is not None else None,
                direction=leak_dir,
                severity="critical",
            )
        )

    return alerts
