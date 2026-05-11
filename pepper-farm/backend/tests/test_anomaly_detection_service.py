import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import json
from datetime import datetime
from unittest.mock import MagicMock

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from database import Base

# Import ALL related models so SQLAlchemy can build the FK graph correctly
import models.role            # noqa: F401
import models.pepper_variety  # noqa: F401
import models.farm_zone       # noqa: F401
import models.user            # noqa: F401
import models.plant           # noqa: F401
import models.sensor          # noqa: F401  -- contains all sensor-related classes

from models.sensor import (
    SensorReading,
    SensorAssignment,
    SensorAlert,
)
from models.plant import Plant
from models.pepper_variety import PepperVariety
from schemas.sensor_reading import SensorReadingCreate
from services.anomaly_detection_service import (
    _compute_severity_range,
    _rule_based_check,
    create_sensor_reading,
    create_alert,
    process_sensor_reading,
)

# ------------------------------------------------------------------ #
# Setup: SQLite in-memory DB (matches team convention)
# ------------------------------------------------------------------ #

SQLALCHEMY_TEST_URL = "sqlite:///:memory:"
engine = create_engine(SQLALCHEMY_TEST_URL, connect_args={"check_same_thread": False})
TestSession = sessionmaker(bind=engine)


@event.listens_for(engine, "connect")
def _register_sqlite_functions(dbapi_connection, connection_record):
    dbapi_connection.create_function(
        "sysutcdatetime", 0,
        lambda: __import__("datetime").datetime.utcnow().isoformat(sep=" ")
    )


@pytest.fixture()
def db():
    Base.metadata.create_all(bind=engine)
    session = TestSession()
    yield session
    session.close()
    Base.metadata.drop_all(bind=engine)


# ------------------------------------------------------------------ #
# Helpers
# ------------------------------------------------------------------ #

def make_reading_mock(**kwargs):
    reading = MagicMock(spec=SensorReading)
    reading.Temperature = kwargs.get("Temperature", 35.0)
    reading.Humidity = kwargs.get("Humidity", 60.0)
    reading.PAR = kwargs.get("PAR", None)
    return reading


def make_pepper_mock(**kwargs):
    pepper = MagicMock(spec=PepperVariety)
    pepper.PepperName = kwargs.get("PepperName", "Test Pepper")
    pepper.OptimalTempMinC = kwargs.get("OptimalTempMinC", 18.0)
    pepper.OptimalTempMaxC = kwargs.get("OptimalTempMaxC", 30.0)
    pepper.OptimalSoilMoistureMin = kwargs.get("OptimalSoilMoistureMin", 40.0)
    pepper.OptimalSoilMoistureMax = kwargs.get("OptimalSoilMoistureMax", 80.0)
    return pepper


def _seed_zone_plant_pepper(db, zone_id=1, pepper_id=1, **pepper_kwargs):
    """Insert a PepperVariety and a Plant so process_sensor_reading can find them."""
    defaults = dict(
        PepperName=f"Pepper-{pepper_id}",
        OptimalTempMinC=18.0,
        OptimalTempMaxC=30.0,
        OptimalSoilMoistureMin=40.0,
        OptimalSoilMoistureMax=80.0,
        IsActive=True,
    )
    defaults.update(pepper_kwargs)
    pepper = PepperVariety(PepperId=pepper_id, **defaults)
    db.add(pepper)
    plant = Plant(PlantCode=f"P-{zone_id}-{pepper_id}", ZoneId=zone_id, PepperId=pepper_id, IsActive=True)
    db.add(plant)
    db.commit()


# ------------------------------------------------------------------ #
# 1. _compute_severity_range
# ------------------------------------------------------------------ #
def test_compute_severity_range_returns_high_when_far_outside():
    assert _compute_severity_range(5.0, 18.0, 30.0) == "High"


def test_compute_severity_range_returns_high_when_just_outside_max():
    assert _compute_severity_range(31.0, 18.0, 30.0) == "High"


def test_compute_severity_range_returns_medium_when_close_to_midpoint():
    assert _compute_severity_range(25.0, 18.0, 30.0) == "Medium"


def test_compute_severity_range_handles_zero_half_range():
    assert _compute_severity_range(20.0, 20.0, 20.0) == "High"


# ------------------------------------------------------------------ #
# 2. _rule_based_check — Temperature
# ------------------------------------------------------------------ #
def test_rule_based_check_detects_temperature_above_max():
    reading = make_reading_mock(Temperature=35.0)
    pepper = make_pepper_mock()
    anomalies = _rule_based_check(reading, pepper)
    assert any(a["metric"] == "Temperature" for a in anomalies)


def test_rule_based_check_no_anomaly_when_temperature_in_range():
    reading = make_reading_mock(Temperature=24.0, Humidity=60.0)
    pepper = make_pepper_mock()
    anomalies = _rule_based_check(reading, pepper)
    assert anomalies == []


def test_rule_based_check_detects_temperature_below_min():
    reading = make_reading_mock(Temperature=10.0)
    pepper = make_pepper_mock()
    anomalies = _rule_based_check(reading, pepper)
    assert any(a["metric"] == "Temperature" for a in anomalies)


# ------------------------------------------------------------------ #
# 3. _rule_based_check — None / threshold guard cases
# ------------------------------------------------------------------ #
def test_rule_based_check_skips_temperature_when_reading_is_none():
    reading = make_reading_mock()
    reading.Temperature = None
    pepper = make_pepper_mock()
    anomalies = _rule_based_check(reading, pepper)
    assert all(a["metric"] != "Temperature" for a in anomalies)


def test_rule_based_check_skips_temperature_when_pepper_thresholds_are_none():
    reading = make_reading_mock(Temperature=35.0)
    pepper = make_pepper_mock(OptimalTempMinC=None, OptimalTempMaxC=None)
    anomalies = _rule_based_check(reading, pepper)
    assert all(a["metric"] != "Temperature" for a in anomalies)


def test_rule_based_check_includes_bounds_in_temperature_anomaly():
    reading = make_reading_mock(Temperature=40.0)
    pepper = make_pepper_mock()
    anomalies = _rule_based_check(reading, pepper)
    temp = next(a for a in anomalies if a["metric"] == "Temperature")
    assert temp["min_allowed"] == 18.0
    assert temp["max_allowed"] == 30.0
    assert temp["actual"] == 40.0


# ------------------------------------------------------------------ #
# 3. _rule_based_check — Humidity (soil moisture)
# ------------------------------------------------------------------ #
def test_rule_based_check_detects_humidity_above_max():
    reading = make_reading_mock(Humidity=95.0)
    pepper = make_pepper_mock()
    anomalies = _rule_based_check(reading, pepper)
    assert any(a["metric"] == "Humidity" for a in anomalies)


def test_rule_based_check_detects_humidity_below_min():
    reading = make_reading_mock(Humidity=10.0)
    pepper = make_pepper_mock()
    anomalies = _rule_based_check(reading, pepper)
    assert any(a["metric"] == "Humidity" for a in anomalies)


def test_rule_based_check_skips_humidity_when_reading_is_none():
    reading = make_reading_mock()
    reading.Humidity = None
    pepper = make_pepper_mock()
    anomalies = _rule_based_check(reading, pepper)
    assert all(a["metric"] != "Humidity" for a in anomalies)


def test_rule_based_check_skips_humidity_when_pepper_thresholds_are_none():
    reading = make_reading_mock(Humidity=95.0)
    pepper = make_pepper_mock(OptimalSoilMoistureMin=None, OptimalSoilMoistureMax=None)
    anomalies = _rule_based_check(reading, pepper)
    assert all(a["metric"] != "Humidity" for a in anomalies)


def test_rule_based_check_detects_multiple_violations():
    reading = make_reading_mock(Temperature=40.0, Humidity=95.0)
    pepper = make_pepper_mock()
    anomalies = _rule_based_check(reading, pepper)
    metrics = [a["metric"] for a in anomalies]
    assert "Temperature" in metrics
    assert "Humidity" in metrics


# ------------------------------------------------------------------ #
# 4. create_sensor_reading
# ------------------------------------------------------------------ #
def test_create_sensor_reading_inserts_to_db(db):
    data = SensorReadingCreate(
        sensorId=1,
        macAddress="AA:BB:CC",
        deviceName="Greenhouse 1",
        temperature=24.5,
        humidity=60.0,
        rawJson={"foo": "bar"},
    )
    reading, error = create_sensor_reading(db, data)

    assert error is None
    assert reading is not None
    assert reading.ReadingId is not None
    assert reading.MacAddress == "AA:BB:CC"
    assert reading.Temperature == 24.5


def test_create_sensor_reading_serializes_raw_json(db):
    data = SensorReadingCreate(sensorId=1, macAddress="AA:BB:CC", rawJson={"key": "value"})
    reading, _ = create_sensor_reading(db, data)
    assert json.loads(reading.RawJson) == {"key": "value"}


def test_create_sensor_reading_handles_none_raw_json(db):
    data = SensorReadingCreate(sensorId=1, macAddress="AA:BB:CC", rawJson=None)
    reading, error = create_sensor_reading(db, data)
    assert error is None
    assert reading.RawJson == "{}"


# ------------------------------------------------------------------ #
# 5. create_alert (with deduplication)
# ------------------------------------------------------------------ #
def test_create_alert_inserts_new_alert(db):
    reading = SensorReading(SensorId=1, MacAddress="AA", RawJson="{}", SampleTimeUtc=datetime(2026, 4, 27, 9, 0))
    db.add(reading)
    db.commit()

    alert = create_alert(
        db=db, reading=reading, pepper_id=1,
        metric="Temperature", actual=35.0,
        min_allowed=18.0, max_allowed=30.0,
        severity="High", message="Too hot",
    )
    db.commit()

    assert alert.AlertId is not None
    assert alert.MetricName == "Temperature"
    assert alert.Severity == "High"
    assert alert.PepperId == 1


def test_create_alert_dedupes_same_reading_metric_pepper(db):
    reading = SensorReading(SensorId=1, MacAddress="AA", RawJson="{}", SampleTimeUtc=datetime(2026, 4, 27, 9, 0))
    db.add(reading)
    db.commit()

    alert1 = create_alert(db=db, reading=reading, pepper_id=1, metric="Temperature",
                          actual=35.0, min_allowed=18.0, max_allowed=30.0, severity="High", message="Too hot")
    db.commit()

    alert2 = create_alert(db=db, reading=reading, pepper_id=1, metric="Temperature",
                          actual=99.0, min_allowed=18.0, max_allowed=30.0, severity="High", message="Different")
    db.commit()

    assert alert2.AlertId == alert1.AlertId
    assert db.query(SensorAlert).filter_by(ReadingId=reading.ReadingId).count() == 1


def test_create_alert_allows_same_metric_different_peppers(db):
    reading = SensorReading(SensorId=1, MacAddress="AA", RawJson="{}", SampleTimeUtc=datetime(2026, 4, 27, 9, 0))
    db.add(reading)
    db.commit()

    create_alert(db=db, reading=reading, pepper_id=1, metric="Temperature",
                 actual=35.0, min_allowed=18.0, max_allowed=30.0, severity="High", message="pepper 1")
    create_alert(db=db, reading=reading, pepper_id=2, metric="Temperature",
                 actual=35.0, min_allowed=20.0, max_allowed=28.0, severity="High", message="pepper 2")
    db.commit()

    assert db.query(SensorAlert).filter_by(ReadingId=reading.ReadingId).count() == 2


def test_create_alert_allows_different_metrics_same_reading(db):
    reading = SensorReading(SensorId=1, MacAddress="AA", RawJson="{}", SampleTimeUtc=datetime(2026, 4, 27, 9, 0))
    db.add(reading)
    db.commit()

    create_alert(db=db, reading=reading, pepper_id=1, metric="Temperature",
                 actual=35.0, min_allowed=18.0, max_allowed=30.0, severity="High", message="hot")
    create_alert(db=db, reading=reading, pepper_id=1, metric="Humidity",
                 actual=95.0, min_allowed=40.0, max_allowed=80.0, severity="High", message="humid")
    db.commit()

    assert db.query(SensorAlert).filter_by(ReadingId=reading.ReadingId).count() == 2


# ------------------------------------------------------------------ #
# 6. process_sensor_reading (full pipeline)
# ------------------------------------------------------------------ #
def test_process_returns_response_with_reading_id(db):
    data = SensorReadingCreate(sensorId=1, macAddress="AA:BB:CC", temperature=24.5, readingType="Periodic")
    response, error = process_sensor_reading(db, data)
    assert error is None
    assert response.readingId is not None
    assert response.readingId > 0


def test_process_creates_no_alerts_when_no_assignment(db):
    data = SensorReadingCreate(sensorId=1, macAddress="AA:BB:CC", temperature=99.0, rawJson={})
    response, error = process_sensor_reading(db, data)
    assert error is None
    assert response.alertsCreated == 0


def test_process_saves_reading_for_any_reading_type(db):
    for reading_type in ("Periodic", "Trigger", "Heartbeat", None):
        data = SensorReadingCreate(sensorId=1, macAddress="AA:BB:CC", temperature=24.0, readingType=reading_type)
        response, error = process_sensor_reading(db, data)
        assert error is None
        assert response.readingId is not None


def test_process_creates_alert_when_temperature_violates_threshold(db):
    assignment = SensorAssignment(SensorId=1, ZoneId=1, IsActive=True, AssignedToUtc=None)
    db.add(assignment)
    db.commit()
    _seed_zone_plant_pepper(db, zone_id=1, pepper_id=1)

    data = SensorReadingCreate(sensorId=1, macAddress="AA:BB:CC", temperature=40.0, readingType="Periodic")
    response, error = process_sensor_reading(db, data)

    assert error is None
    assert response.alertsCreated == 1
    assert response.alerts[0].metricName == "Temperature"
    assert response.alerts[0].pepperId == 1


def test_process_creates_no_alert_when_reading_in_range(db):
    assignment = SensorAssignment(SensorId=1, ZoneId=1, IsActive=True, AssignedToUtc=None)
    db.add(assignment)
    db.commit()
    _seed_zone_plant_pepper(db, zone_id=1, pepper_id=1)

    data = SensorReadingCreate(sensorId=1, macAddress="AA:BB:CC",
                               temperature=24.0, humidity=60.0, readingType="Periodic")
    response, error = process_sensor_reading(db, data)

    assert error is None
    assert response.alertsCreated == 0


def test_process_creates_separate_alerts_per_pepper(db):
    assignment = SensorAssignment(SensorId=1, ZoneId=1, IsActive=True, AssignedToUtc=None)
    db.add(assignment)
    db.commit()

    pepper1 = PepperVariety(PepperId=1, PepperName="Pepper-1", OptimalTempMinC=18.0, OptimalTempMaxC=30.0, IsActive=True)
    pepper2 = PepperVariety(PepperId=2, PepperName="Pepper-2", OptimalTempMinC=20.0, OptimalTempMaxC=28.0, IsActive=True)
    plant1 = Plant(PlantCode="P1", ZoneId=1, PepperId=1, IsActive=True)
    plant2 = Plant(PlantCode="P2", ZoneId=1, PepperId=2, IsActive=True)
    db.add_all([pepper1, pepper2, plant1, plant2])
    db.commit()

    data = SensorReadingCreate(sensorId=1, macAddress="AA:BB:CC", temperature=40.0, readingType="Periodic")
    response, error = process_sensor_reading(db, data)

    assert error is None
    assert response.alertsCreated == 2
    assert {a.pepperId for a in response.alerts} == {1, 2}


def test_process_skips_pepper_with_no_variety_record(db):
    assignment = SensorAssignment(SensorId=1, ZoneId=1, IsActive=True, AssignedToUtc=None)
    db.add(assignment)
    # Plant references pepper_id=1 but no PepperVariety row exists
    plant = Plant(PlantCode="P1", ZoneId=1, PepperId=1, IsActive=True)
    db.add(plant)
    db.commit()

    data = SensorReadingCreate(sensorId=1, macAddress="AA:BB:CC", temperature=99.0)
    response, error = process_sensor_reading(db, data)

    assert error is None
    assert response.alertsCreated == 0


def test_process_skips_pepper_with_no_temperature_thresholds(db):
    """PepperVariety exists but OptimalTempMinC/MaxC are None → no temperature alert."""
    assignment = SensorAssignment(SensorId=1, ZoneId=1, IsActive=True, AssignedToUtc=None)
    db.add(assignment)
    db.commit()
    _seed_zone_plant_pepper(db, zone_id=1, pepper_id=1,
                             OptimalTempMinC=None, OptimalTempMaxC=None,
                             OptimalSoilMoistureMin=None, OptimalSoilMoistureMax=None)

    data = SensorReadingCreate(sensorId=1, macAddress="AA:BB:CC", temperature=99.0)
    response, error = process_sensor_reading(db, data)

    assert error is None
    assert response.alertsCreated == 0


def test_process_creates_multiple_metric_alerts_for_one_pepper(db):
    assignment = SensorAssignment(SensorId=1, ZoneId=1, IsActive=True, AssignedToUtc=None)
    db.add(assignment)
    db.commit()
    _seed_zone_plant_pepper(db, zone_id=1, pepper_id=1)

    data = SensorReadingCreate(sensorId=1, macAddress="AA:BB:CC",
                               temperature=40.0, humidity=95.0, readingType="Periodic")
    response, error = process_sensor_reading(db, data)

    assert error is None
    assert response.alertsCreated == 2
    assert {a.metricName for a in response.alerts} == {"Temperature", "Humidity"}


def test_process_ignores_inactive_plants(db):
    assignment = SensorAssignment(SensorId=1, ZoneId=1, IsActive=True, AssignedToUtc=None)
    db.add(assignment)
    pepper = PepperVariety(PepperId=1, PepperName="P1", OptimalTempMinC=18.0, OptimalTempMaxC=30.0, IsActive=True)
    plant = Plant(PlantCode="P1", ZoneId=1, PepperId=1, IsActive=False)  # inactive
    db.add_all([pepper, plant])
    db.commit()

    data = SensorReadingCreate(sensorId=1, macAddress="AA:BB:CC", temperature=40.0)
    response, error = process_sensor_reading(db, data)

    assert error is None
    assert response.alertsCreated == 0


def test_process_ignores_inactive_pepper_variety(db):
    assignment = SensorAssignment(SensorId=1, ZoneId=1, IsActive=True, AssignedToUtc=None)
    db.add(assignment)
    pepper = PepperVariety(PepperId=1, PepperName="P1", OptimalTempMinC=18.0, OptimalTempMaxC=30.0, IsActive=False)  # inactive
    plant = Plant(PlantCode="P1", ZoneId=1, PepperId=1, IsActive=True)
    db.add_all([pepper, plant])
    db.commit()

    data = SensorReadingCreate(sensorId=1, macAddress="AA:BB:CC", temperature=40.0)
    response, error = process_sensor_reading(db, data)

    assert error is None
    assert response.alertsCreated == 0
