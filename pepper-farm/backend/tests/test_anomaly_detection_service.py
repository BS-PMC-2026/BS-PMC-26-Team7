import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from datetime import datetime

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from database import Base

import models.role            # noqa: F401
import models.pepper_variety  # noqa: F401
import models.farm_zone       # noqa: F401
import models.user            # noqa: F401
import models.plant           # noqa: F401

from models.sensor import Sensor, SensorReading, SensorAssignment, SensorAlert, PepperThreshold
from models.pepper_variety import PepperVariety
from services.anomaly_detection_service import (
    get_pepper_for_sensor,
    get_active_threshold,
    check_temperature,
    check_humidity,
    check_leak,
    process_sensor_reading,
)

# ------------------------------------------------------------------ #
# DB setup
# ------------------------------------------------------------------ #

SQLALCHEMY_TEST_URL = "sqlite:///:memory:"
engine = create_engine(SQLALCHEMY_TEST_URL, connect_args={"check_same_thread": False})
TestSession = sessionmaker(bind=engine)


@event.listens_for(engine, "connect")
def _register_sqlite_functions(dbapi_connection, connection_record):
    dbapi_connection.create_function(
        "sysutcdatetime", 0,
        lambda: __import__("datetime").datetime.utcnow().isoformat(sep=" "),
    )


@pytest.fixture()
def db():
    Base.metadata.create_all(bind=engine)
    session = TestSession()
    yield session
    session.close()
    Base.metadata.drop_all(bind=engine)


# ------------------------------------------------------------------ #
# Builders
# ------------------------------------------------------------------ #

SAMPLE_TIME = datetime(2026, 5, 1, 12, 0, 0)


def _make_pepper(db, name="Habanero", par_min=200.0, par_max=800.0) -> PepperVariety:
    pepper = PepperVariety(
        PepperName=name,
        OptimalPARMin=par_min,
        OptimalPARMax=par_max,
        IsActive=True,
    )
    db.add(pepper)
    db.commit()
    return pepper


def _make_sensor(db, mac="AA:BB:CC") -> Sensor:
    sensor = Sensor(MacAddress=mac, IsActive=True)
    db.add(sensor)
    db.commit()
    return sensor


def _make_reading(
    db,
    sensor,
    temperature=24.0,
    humidity=60.0,
    leak=0.0,
    par=500.0,
) -> SensorReading:
    reading = SensorReading(
        SensorId=sensor.SensorId,
        MacAddress=sensor.MacAddress,
        Temperature=temperature,
        Humidity=humidity,
        Leak=leak,
        PAR=par,
        SampleTimeUtc=SAMPLE_TIME,
        RawJson="{}",
    )
    db.add(reading)
    db.commit()
    return reading


def _assign_pepper(db, sensor, pepper) -> SensorAssignment:
    assignment = SensorAssignment(
        SensorId=sensor.SensorId,
        PepperId=pepper.PepperId,
        IsActive=True,
    )
    db.add(assignment)
    db.commit()
    return assignment


def _make_threshold(
    db,
    pepper,
    min_temp=15.0,
    max_temp=35.0,
    min_hum=40.0,
    max_hum=90.0,
    max_leak=0.5,
) -> PepperThreshold:
    threshold = PepperThreshold(
        PepperId=pepper.PepperId,
        MinTemperature=min_temp,
        MaxTemperature=max_temp,
        MinHumidity=min_hum,
        MaxHumidity=max_hum,
        MaxLeak=max_leak,
        IsActive=True,
    )
    db.add(threshold)
    db.commit()
    return threshold


# ------------------------------------------------------------------ #
# 1. check_temperature
# ------------------------------------------------------------------ #

def test_check_temperature_below_min_returns_low():
    assert check_temperature(10.0, 15.0, 35.0) == "low"


def test_check_temperature_above_max_returns_high():
    assert check_temperature(40.0, 15.0, 35.0) == "high"


def test_check_temperature_within_range_returns_none():
    assert check_temperature(25.0, 15.0, 35.0) is None


def test_check_temperature_at_exact_min_boundary_is_valid():
    assert check_temperature(15.0, 15.0, 35.0) is None


def test_check_temperature_at_exact_max_boundary_is_valid():
    assert check_temperature(35.0, 15.0, 35.0) is None


def test_check_temperature_none_value_returns_none():
    assert check_temperature(None, 15.0, 35.0) is None


def test_check_temperature_none_min_suppresses_low_alert():
    assert check_temperature(5.0, None, 35.0) is None


def test_check_temperature_none_max_suppresses_high_alert():
    assert check_temperature(50.0, 15.0, None) is None


# ------------------------------------------------------------------ #
# 2. check_humidity
# ------------------------------------------------------------------ #

def test_check_humidity_below_min_returns_low():
    assert check_humidity(30.0, 40.0, 90.0) == "low"


def test_check_humidity_above_max_returns_high():
    assert check_humidity(95.0, 40.0, 90.0) == "high"


def test_check_humidity_within_range_returns_none():
    assert check_humidity(65.0, 40.0, 90.0) is None


def test_check_humidity_none_value_returns_none():
    assert check_humidity(None, 40.0, 90.0) is None


def test_check_humidity_none_thresholds_returns_none():
    assert check_humidity(65.0, None, None) is None


# ------------------------------------------------------------------ #
# 3. check_leak
# ------------------------------------------------------------------ #

def test_check_leak_above_max_returns_high():
    assert check_leak(1.0, 0.5) == "high"


def test_check_leak_at_or_below_max_returns_none():
    assert check_leak(0.5, 0.5) is None
    assert check_leak(0.0, 0.5) is None


def test_check_leak_none_value_returns_none():
    assert check_leak(None, 0.5) is None


def test_check_leak_none_max_returns_none():
    assert check_leak(5.0, None) is None


# ------------------------------------------------------------------ #
# 4. get_pepper_for_sensor
# ------------------------------------------------------------------ #

def test_get_pepper_for_sensor_returns_pepper_when_assigned(db):
    sensor = _make_sensor(db)
    pepper = _make_pepper(db)
    _assign_pepper(db, sensor, pepper)

    result = get_pepper_for_sensor(db, sensor.SensorId)
    assert result is not None
    assert result.PepperId == pepper.PepperId


def test_get_pepper_for_sensor_returns_none_when_no_assignment(db):
    sensor = _make_sensor(db)
    result = get_pepper_for_sensor(db, sensor.SensorId)
    assert result is None


def test_get_pepper_for_sensor_ignores_inactive_assignment(db):
    sensor = _make_sensor(db)
    pepper = _make_pepper(db)
    assignment = SensorAssignment(
        SensorId=sensor.SensorId,
        PepperId=pepper.PepperId,
        IsActive=False,
    )
    db.add(assignment)
    db.commit()

    result = get_pepper_for_sensor(db, sensor.SensorId)
    assert result is None


# ------------------------------------------------------------------ #
# 5. get_active_threshold
# ------------------------------------------------------------------ #

def test_get_active_threshold_returns_threshold_when_exists(db):
    pepper = _make_pepper(db)
    _make_threshold(db, pepper)

    result = get_active_threshold(db, pepper.PepperId)
    assert result is not None
    assert result.PepperId == pepper.PepperId


def test_get_active_threshold_returns_none_when_missing(db):
    pepper = _make_pepper(db)
    result = get_active_threshold(db, pepper.PepperId)
    assert result is None


def test_get_active_threshold_ignores_inactive(db):
    pepper = _make_pepper(db)
    threshold = PepperThreshold(
        PepperId=pepper.PepperId,
        MinTemperature=15.0,
        MaxTemperature=35.0,
        IsActive=False,
    )
    db.add(threshold)
    db.commit()

    result = get_active_threshold(db, pepper.PepperId)
    assert result is None


# ------------------------------------------------------------------ #
# 6. process_sensor_reading – no alerts when all metrics are fine
# ------------------------------------------------------------------ #

def test_process_reading_no_alerts_when_all_within_range(db):
    sensor = _make_sensor(db)
    pepper = _make_pepper(db, par_min=200.0, par_max=800.0)
    _assign_pepper(db, sensor, pepper)
    _make_threshold(db, pepper)
    reading = _make_reading(db, sensor, temperature=25.0, humidity=65.0, leak=0.0, par=500.0)

    alerts = process_sensor_reading(db, reading)

    assert alerts == []
    assert db.query(SensorAlert).count() == 0


# ------------------------------------------------------------------ #
# 7. process_sensor_reading – PAR alerts
# ------------------------------------------------------------------ #

def test_process_reading_creates_par_alert_when_below_min(db):
    sensor = _make_sensor(db)
    pepper = _make_pepper(db, par_min=300.0, par_max=900.0)
    _assign_pepper(db, sensor, pepper)
    _make_threshold(db, pepper)
    reading = _make_reading(db, sensor, par=100.0)

    alerts = process_sensor_reading(db, reading)

    par_alerts = [a for a in alerts if a.MetricName == "PAR"]
    assert len(par_alerts) == 1
    assert par_alerts[0].ActualValue == 100.0
    assert "below" in par_alerts[0].Message.lower()


def test_process_reading_creates_par_alert_when_above_max(db):
    sensor = _make_sensor(db)
    pepper = _make_pepper(db, par_min=200.0, par_max=800.0)
    _assign_pepper(db, sensor, pepper)
    _make_threshold(db, pepper)
    reading = _make_reading(db, sensor, par=1000.0)

    alerts = process_sensor_reading(db, reading)

    par_alerts = [a for a in alerts if a.MetricName == "PAR"]
    assert len(par_alerts) == 1
    assert par_alerts[0].ActualValue == 1000.0
    assert "above" in par_alerts[0].Message.lower()


def test_process_reading_no_par_alert_when_no_pepper(db):
    sensor = _make_sensor(db)
    reading = _make_reading(db, sensor, par=50.0)

    alerts = process_sensor_reading(db, reading)

    assert alerts == []
    assert db.query(SensorAlert).count() == 0


# ------------------------------------------------------------------ #
# 8. process_sensor_reading – Temperature alerts
# ------------------------------------------------------------------ #

def test_process_reading_creates_temperature_alert_when_too_cold(db):
    sensor = _make_sensor(db)
    pepper = _make_pepper(db)
    _assign_pepper(db, sensor, pepper)
    _make_threshold(db, pepper, min_temp=18.0, max_temp=35.0)
    reading = _make_reading(db, sensor, temperature=10.0, par=500.0)

    alerts = process_sensor_reading(db, reading)

    temp_alerts = [a for a in alerts if a.MetricName == "Temperature"]
    assert len(temp_alerts) == 1
    assert temp_alerts[0].ActualValue == 10.0
    assert temp_alerts[0].Severity == "warning"
    assert "below" in temp_alerts[0].Message.lower()


def test_process_reading_creates_temperature_alert_when_too_hot(db):
    sensor = _make_sensor(db)
    pepper = _make_pepper(db)
    _assign_pepper(db, sensor, pepper)
    _make_threshold(db, pepper, min_temp=15.0, max_temp=30.0)
    reading = _make_reading(db, sensor, temperature=40.0, par=500.0)

    alerts = process_sensor_reading(db, reading)

    temp_alerts = [a for a in alerts if a.MetricName == "Temperature"]
    assert len(temp_alerts) == 1
    assert "above" in temp_alerts[0].Message.lower()


# ------------------------------------------------------------------ #
# 9. process_sensor_reading – Humidity alerts
# ------------------------------------------------------------------ #

def test_process_reading_creates_humidity_alert_when_too_dry(db):
    sensor = _make_sensor(db)
    pepper = _make_pepper(db)
    _assign_pepper(db, sensor, pepper)
    _make_threshold(db, pepper, min_hum=50.0, max_hum=85.0)
    reading = _make_reading(db, sensor, humidity=20.0, par=500.0)

    alerts = process_sensor_reading(db, reading)

    hum_alerts = [a for a in alerts if a.MetricName == "Humidity"]
    assert len(hum_alerts) == 1
    assert hum_alerts[0].ActualValue == 20.0
    assert "below" in hum_alerts[0].Message.lower()


def test_process_reading_creates_humidity_alert_when_too_humid(db):
    sensor = _make_sensor(db)
    pepper = _make_pepper(db)
    _assign_pepper(db, sensor, pepper)
    _make_threshold(db, pepper, min_hum=40.0, max_hum=80.0)
    reading = _make_reading(db, sensor, humidity=95.0, par=500.0)

    alerts = process_sensor_reading(db, reading)

    hum_alerts = [a for a in alerts if a.MetricName == "Humidity"]
    assert len(hum_alerts) == 1
    assert "above" in hum_alerts[0].Message.lower()


# ------------------------------------------------------------------ #
# 10. process_sensor_reading – Leak alerts
# ------------------------------------------------------------------ #

def test_process_reading_creates_leak_alert_when_above_max(db):
    sensor = _make_sensor(db)
    pepper = _make_pepper(db)
    _assign_pepper(db, sensor, pepper)
    _make_threshold(db, pepper, max_leak=0.5)
    reading = _make_reading(db, sensor, leak=2.0, par=500.0)

    alerts = process_sensor_reading(db, reading)

    leak_alerts = [a for a in alerts if a.MetricName == "Leak"]
    assert len(leak_alerts) == 1
    assert leak_alerts[0].ActualValue == 2.0
    assert leak_alerts[0].Severity == "critical"
    assert "above" in leak_alerts[0].Message.lower()


def test_process_reading_no_leak_alert_when_zero_leak(db):
    sensor = _make_sensor(db)
    pepper = _make_pepper(db)
    _assign_pepper(db, sensor, pepper)
    _make_threshold(db, pepper, max_leak=0.5)
    reading = _make_reading(db, sensor, leak=0.0, par=500.0)

    alerts = process_sensor_reading(db, reading)

    leak_alerts = [a for a in alerts if a.MetricName == "Leak"]
    assert leak_alerts == []


# ------------------------------------------------------------------ #
# 11. process_sensor_reading – multiple alerts from one reading
# ------------------------------------------------------------------ #

def test_process_reading_creates_multiple_alerts_simultaneously(db):
    sensor = _make_sensor(db)
    pepper = _make_pepper(db, par_min=300.0, par_max=900.0)
    _assign_pepper(db, sensor, pepper)
    _make_threshold(db, pepper, min_temp=18.0, max_temp=35.0, max_leak=0.5)
    reading = _make_reading(
        db, sensor,
        temperature=5.0,   # below min → alert
        humidity=65.0,     # fine
        leak=2.0,          # above max → alert
        par=50.0,          # below min → alert
    )

    alerts = process_sensor_reading(db, reading)

    metric_names = {a.MetricName for a in alerts}
    assert "PAR" in metric_names
    assert "Temperature" in metric_names
    assert "Leak" in metric_names
    assert len(alerts) == 3
    assert db.query(SensorAlert).count() == 3


# ------------------------------------------------------------------ #
# 12. process_sensor_reading – edge cases
# ------------------------------------------------------------------ #

def test_process_reading_no_threshold_returns_only_par_alerts(db):
    sensor = _make_sensor(db)
    pepper = _make_pepper(db, par_min=300.0, par_max=900.0)
    _assign_pepper(db, sensor, pepper)
    # No PepperThreshold configured — only PAR can fire
    reading = _make_reading(db, sensor, temperature=5.0, leak=5.0, par=50.0)

    alerts = process_sensor_reading(db, reading)

    assert len(alerts) == 1
    assert alerts[0].MetricName == "PAR"


def test_process_reading_no_assignment_returns_empty(db):
    sensor = _make_sensor(db)
    reading = _make_reading(db, sensor, temperature=5.0, humidity=10.0, leak=5.0, par=10.0)

    alerts = process_sensor_reading(db, reading)

    assert alerts == []
    assert db.query(SensorAlert).count() == 0


def test_process_reading_alerts_are_persisted_to_db(db):
    sensor = _make_sensor(db)
    pepper = _make_pepper(db, par_min=300.0, par_max=900.0)
    _assign_pepper(db, sensor, pepper)
    _make_threshold(db, pepper)
    reading = _make_reading(db, sensor, par=50.0)

    alerts = process_sensor_reading(db, reading)

    stored = db.query(SensorAlert).filter_by(AlertId=alerts[0].AlertId).first()
    assert stored is not None
    assert stored.MetricName == "PAR"


def test_process_reading_alert_has_correct_reading_and_sensor_ids(db):
    sensor = _make_sensor(db)
    pepper = _make_pepper(db, par_min=300.0, par_max=900.0)
    _assign_pepper(db, sensor, pepper)
    _make_threshold(db, pepper)
    reading = _make_reading(db, sensor, par=50.0)

    alerts = process_sensor_reading(db, reading)

    assert alerts[0].SensorId == sensor.SensorId
    assert alerts[0].ReadingId == reading.ReadingId


def test_process_reading_no_radiation_field_used():
    """Confirm the service has no Radiation attribute references."""
    import services.anomaly_detection_service as svc
    import inspect
    source = inspect.getsource(svc)
    assert "Radiation" not in source
    assert "radiation" not in source
