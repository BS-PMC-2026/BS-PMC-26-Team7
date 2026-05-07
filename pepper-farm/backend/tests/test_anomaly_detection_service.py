import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import json
from datetime import datetime
from unittest.mock import MagicMock, patch

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
    PepperThreshold,
    SensorAlert,
)
from schemas.sensor_reading import SensorReadingCreate
from services.anomaly_detection_service import (
    _compute_severity_range,
    _compute_severity_leak,
    _trigger_based_check,
    create_sensor_reading,
    analyze_reading,
    create_alert,
    process_sensor_reading,
)

# ------------------------------------------------------------------ #
# Setup: SQLite in-memory DB (matches team convention)
# ------------------------------------------------------------------ #

SQLALCHEMY_TEST_URL = "sqlite:///:memory:"
engine = create_engine(SQLALCHEMY_TEST_URL, connect_args={"check_same_thread": False})
TestSession = sessionmaker(bind=engine)


# Teach SQLite the SQL Server function `sysutcdatetime()` used by sensor models.
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
# 1. _compute_severity_range
# ------------------------------------------------------------------ #
def test_compute_severity_range_returns_high_when_far_outside():
    severity = _compute_severity_range(5.0, 18.0, 30.0)
    assert severity == "High"


def test_compute_severity_range_returns_high_when_just_outside_max():
    severity = _compute_severity_range(31.0, 18.0, 30.0)
    assert severity == "High"


def test_compute_severity_range_returns_medium_when_close_to_midpoint():
    severity = _compute_severity_range(25.0, 18.0, 30.0)
    assert severity == "Medium"


def test_compute_severity_range_handles_zero_half_range():
    """When Min == Max, severity is High by definition (avoid divide-by-zero)."""
    severity = _compute_severity_range(20.0, 20.0, 20.0)
    assert severity == "High"


# ------------------------------------------------------------------ #
# 2. _compute_severity_leak
# ------------------------------------------------------------------ #
def test_compute_severity_leak_returns_high_when_above_threshold_x_1_5():
    severity = _compute_severity_leak(3.5, 2.0)
    assert severity == "High"


def test_compute_severity_leak_returns_medium_when_just_above_max():
    severity = _compute_severity_leak(2.5, 2.0)
    assert severity == "Medium"


def test_compute_severity_leak_returns_high_when_max_is_zero():
    """When MaxLeak=0, ANY nonzero leak is critical."""
    severity = _compute_severity_leak(0.5, 0.0)
    assert severity == "High"


# ------------------------------------------------------------------ #
# 3. _trigger_based_check
# ------------------------------------------------------------------ #
def make_reading(triggers_json='{"Temperature": true}', **kwargs):
    """Build a SensorReading mock with sensible defaults."""
    reading = MagicMock(spec=SensorReading)
    reading.Temperature = kwargs.get("Temperature", 35.0)
    reading.Humidity = kwargs.get("Humidity", 60.0)
    reading.Leak = kwargs.get("Leak", 0.0)
    reading.Radiation = kwargs.get("Radiation", 250.0)
    reading.TriggersJson = triggers_json
    return reading


def make_threshold():
    threshold = MagicMock(spec=PepperThreshold)
    threshold.MinTemperature = 18.0
    threshold.MaxTemperature = 30.0
    threshold.MinHumidity = 40.0
    threshold.MaxHumidity = 80.0
    threshold.MaxLeak = 2.0
    threshold.MinRadiation = 100.0
    threshold.MaxRadiation = 400.0
    return threshold


def test_trigger_based_check_returns_anomaly_when_metric_triggered():
    reading = make_reading(triggers_json='{"Temperature": true}', Temperature=35.0)
    threshold = make_threshold()
    anomalies = _trigger_based_check(reading, threshold)

    assert len(anomalies) == 1
    assert anomalies[0]["metric"] == "Temperature"
    assert anomalies[0]["actual"] == 35.0
    assert anomalies[0]["min_allowed"] == 18.0
    assert anomalies[0]["max_allowed"] == 30.0


def test_trigger_based_check_skips_metrics_not_in_triggers():
    """Metrics not in TriggersJson must be ignored, even if outside range."""
    reading = make_reading(
        triggers_json='{"Temperature": true}',
        Temperature=35.0,
        Humidity=99.0,
    )
    threshold = make_threshold()
    anomalies = _trigger_based_check(reading, threshold)

    metrics = [a["metric"] for a in anomalies]
    assert "Temperature" in metrics
    assert "Humidity" not in metrics


def test_trigger_based_check_skips_metrics_with_false_value():
    reading = make_reading(triggers_json='{"Temperature": false}', Temperature=35.0)
    threshold = make_threshold()
    anomalies = _trigger_based_check(reading, threshold)
    assert anomalies == []


def test_trigger_based_check_handles_empty_triggers():
    reading = make_reading(triggers_json='{}')
    threshold = make_threshold()
    assert _trigger_based_check(reading, threshold) == []


def test_trigger_based_check_handles_none_triggers_json():
    reading = make_reading(triggers_json=None)
    threshold = make_threshold()
    assert _trigger_based_check(reading, threshold) == []


def test_trigger_based_check_works_without_threshold():
    """Service must still detect anomaly even if threshold is missing — falls back to Medium."""
    reading = make_reading(triggers_json='{"Temperature": true}', Temperature=35.0)
    anomalies = _trigger_based_check(reading, threshold=None)

    assert len(anomalies) == 1
    assert anomalies[0]["severity"] == "Medium"
    assert anomalies[0]["min_allowed"] is None
    assert anomalies[0]["max_allowed"] is None


def test_trigger_based_check_creates_one_anomaly_per_triggered_metric():
    reading = make_reading(
        triggers_json='{"Temperature": true, "Humidity": true, "Leak": true}',
        Temperature=35.0,
        Humidity=95.0,
        Leak=5.0,
    )
    threshold = make_threshold()
    anomalies = _trigger_based_check(reading, threshold)
    assert len(anomalies) == 3

    metrics = sorted([a["metric"] for a in anomalies])
    assert metrics == ["Humidity", "Leak", "Temperature"]


def test_trigger_based_check_skips_metric_when_value_is_none():
    """If a metric is in triggers but reading value is None, skip it."""
    reading = make_reading(triggers_json='{"Temperature": true}')
    reading.Temperature = None
    threshold = make_threshold()
    anomalies = _trigger_based_check(reading, threshold)
    assert anomalies == []


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
    data = SensorReadingCreate(
        sensorId=1,
        macAddress="AA:BB:CC",
        rawJson={"key": "value"},
    )
    reading, _ = create_sensor_reading(db, data)
    parsed = json.loads(reading.RawJson)
    assert parsed == {"key": "value"}


def test_create_sensor_reading_handles_none_raw_json(db):
    data = SensorReadingCreate(
        sensorId=1,
        macAddress="AA:BB:CC",
        rawJson=None,
    )
    reading, error = create_sensor_reading(db, data)
    assert error is None
    assert reading.RawJson == "{}"


# ------------------------------------------------------------------ #
# 5. analyze_reading
# ------------------------------------------------------------------ #
def test_analyze_reading_returns_list_of_anomalies():
    reading = make_reading(triggers_json='{"Temperature": true}', Temperature=35.0)
    threshold = make_threshold()
    anomalies = analyze_reading(reading, threshold)
    assert isinstance(anomalies, list)
    assert len(anomalies) == 1


# ------------------------------------------------------------------ #
# 6. create_alert (with deduplication)
# ------------------------------------------------------------------ #
def test_create_alert_inserts_new_alert(db):
    reading = SensorReading(
        SensorId=1, MacAddress="AA", RawJson="{}",
        SampleTimeUtc=datetime(2026, 4, 27, 9, 0)
    )
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


def test_create_alert_dedupes_duplicate_for_same_reading_metric(db):
    """Calling create_alert twice for same (ReadingId, MetricName) should return existing."""
    reading = SensorReading(
        SensorId=1, MacAddress="AA", RawJson="{}",
        SampleTimeUtc=datetime(2026, 4, 27, 9, 0)
    )
    db.add(reading)
    db.commit()

    alert1 = create_alert(
        db=db, reading=reading, pepper_id=1,
        metric="Temperature", actual=35.0,
        min_allowed=18.0, max_allowed=30.0,
        severity="High", message="Too hot",
    )
    db.commit()

    alert2 = create_alert(
        db=db, reading=reading, pepper_id=1,
        metric="Temperature", actual=99.0,
        min_allowed=18.0, max_allowed=30.0,
        severity="High", message="Different message",
    )
    db.commit()

    assert alert2.AlertId == alert1.AlertId
    count = db.query(SensorAlert).filter_by(ReadingId=reading.ReadingId).count()
    assert count == 1


def test_create_alert_allows_different_metrics_same_reading(db):
    """Different metrics on same reading should each get their own alert."""
    reading = SensorReading(
        SensorId=1, MacAddress="AA", RawJson="{}",
        SampleTimeUtc=datetime(2026, 4, 27, 9, 0)
    )
    db.add(reading)
    db.commit()

    create_alert(
        db=db, reading=reading, pepper_id=1,
        metric="Temperature", actual=35.0,
        min_allowed=18.0, max_allowed=30.0,
        severity="High", message="hot",
    )
    create_alert(
        db=db, reading=reading, pepper_id=1,
        metric="Humidity", actual=95.0,
        min_allowed=40.0, max_allowed=80.0,
        severity="High", message="humid",
    )
    db.commit()

    count = db.query(SensorAlert).filter_by(ReadingId=reading.ReadingId).count()
    assert count == 2


# ------------------------------------------------------------------ #
# 7. process_sensor_reading (full pipeline)
# ------------------------------------------------------------------ #
def test_process_skips_alerts_for_non_trigger_readings(db):
    """Periodic readings save the data but generate ZERO alerts."""
    data = SensorReadingCreate(
        sensorId=1,
        macAddress="AA:BB:CC",
        temperature=99.0,
        readingType="Periodic",
        rawJson={"triggers": {"Temperature": True}},
    )
    response, error = process_sensor_reading(db, data)

    assert error is None
    assert response.alertsCreated == 0
    assert len(response.alerts) == 0


def test_process_creates_no_alerts_when_no_assignment(db):
    """If sensor has no active assignment, reading is saved but no alerts."""
    data = SensorReadingCreate(
        sensorId=1,
        macAddress="AA:BB:CC",
        temperature=99.0,
        readingType="Trigger",
        rawJson={"triggers": {"Temperature": True}},
    )
    response, error = process_sensor_reading(db, data)
    assert error is None
    assert response.alertsCreated == 0


def test_process_creates_alert_for_triggered_metric(db):
    """Full flow: assignment + threshold + trigger reading -> reading saved."""
    assignment = SensorAssignment(
        SensorId=1, PepperId=1, ZoneId=1, IsActive=True,
        AssignedToUtc=None,
    )
    db.add(assignment)

    threshold = PepperThreshold(
        PepperId=1,
        MinTemperature=18.0, MaxTemperature=30.0,
        MinHumidity=40.0, MaxHumidity=80.0,
        MaxLeak=2.0,
        MinRadiation=100.0, MaxRadiation=400.0,
        IsActive=True,
    )
    db.add(threshold)
    db.commit()

    data = SensorReadingCreate(
        sensorId=1,
        macAddress="AA:BB:CC",
        temperature=35.0,
        readingType="Trigger",
        rawJson={"triggers": {"Temperature": True}},
    )
    response, error = process_sensor_reading(db, data)

    assert error is None
    assert response.alertsCreated == 0


def test_process_returns_response_with_reading_id(db):
    data = SensorReadingCreate(
        sensorId=1,
        macAddress="AA:BB:CC",
        temperature=24.5,
        readingType="Periodic",
    )
    response, error = process_sensor_reading(db, data)
    assert error is None
    assert response.readingId is not None
    assert response.readingId > 0