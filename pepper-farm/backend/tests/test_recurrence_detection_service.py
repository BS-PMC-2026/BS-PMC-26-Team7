import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import pytest
from datetime import datetime, timedelta
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from database import Base
import models.role            # noqa: F401
import models.pepper_variety  # noqa: F401
import models.farm_zone       # noqa: F401
import models.user            # noqa: F401
import models.plant           # noqa: F401
import models.sensor          # noqa: F401 — registers SensorAlert with Base metadata
from models.sensor import SensorAlert
from services.recurrence_detection_service import (
    is_frequency_recurring,
    is_reappearance_recurring,
    check_recurrence,
)

SQLALCHEMY_TEST_URL = "sqlite:///:memory:"
engine = create_engine(SQLALCHEMY_TEST_URL, connect_args={"check_same_thread": False})
TestSession = sessionmaker(bind=engine)


@event.listens_for(engine, "connect")
def _register_sqlite_functions(dbapi_connection, connection_record):
    dbapi_connection.create_function(
        "sysutcdatetime", 0,
        lambda: datetime.utcnow().isoformat(sep=" "),
    )


@pytest.fixture()
def db():
    Base.metadata.create_all(bind=engine)
    session = TestSession()
    yield session
    session.close()
    Base.metadata.drop_all(bind=engine)


def _make_alert(db, sensor_id, metric_name, is_resolved=False, created_offset_hours=0):
    alert = SensorAlert(
        SensorId=sensor_id,
        ReadingId=1,
        MetricName=metric_name,
        ActualValue=0.0,
        Severity="warning",
        Message="test",
        IsResolved=is_resolved,
        CreatedAtUtc=datetime.utcnow() - timedelta(hours=created_offset_hours),
    )
    db.add(alert)
    db.flush()
    return alert


# --- RECUR-01: is_frequency_recurring ---

def test_frequency_below_threshold_returns_false(db):
    # 2 prior alerts — below threshold of 3
    s1 = _make_alert(db, sensor_id=1, metric_name="Temperature")
    s2 = _make_alert(db, sensor_id=1, metric_name="Temperature")
    new = _make_alert(db, sensor_id=1, metric_name="Temperature")
    result = is_frequency_recurring(db, sensor_id=1, metric_name="Temperature", new_alert_id=new.AlertId, threshold_count=3, window_hours=24)
    assert result is False


def test_frequency_at_threshold_returns_true(db):
    # 3 prior alerts — exactly at threshold
    _make_alert(db, sensor_id=1, metric_name="Temperature")
    _make_alert(db, sensor_id=1, metric_name="Temperature")
    _make_alert(db, sensor_id=1, metric_name="Temperature")
    new = _make_alert(db, sensor_id=1, metric_name="Temperature")
    result = is_frequency_recurring(db, sensor_id=1, metric_name="Temperature", new_alert_id=new.AlertId, threshold_count=3, window_hours=24)
    assert result is True


def test_frequency_excludes_new_alert_id(db):
    # Only 2 prior alerts; new alert itself would make count=3 if not excluded
    _make_alert(db, sensor_id=1, metric_name="Temperature")
    _make_alert(db, sensor_id=1, metric_name="Temperature")
    new = _make_alert(db, sensor_id=1, metric_name="Temperature")
    result = is_frequency_recurring(db, sensor_id=1, metric_name="Temperature", new_alert_id=new.AlertId, threshold_count=3, window_hours=24)
    # Without exclusion count=3, with exclusion count=2 → should be False
    assert result is False


def test_frequency_outside_window_returns_false(db):
    # 3 prior alerts but 48h ago — outside 24h window
    _make_alert(db, sensor_id=1, metric_name="Temperature", created_offset_hours=48)
    _make_alert(db, sensor_id=1, metric_name="Temperature", created_offset_hours=48)
    _make_alert(db, sensor_id=1, metric_name="Temperature", created_offset_hours=48)
    new = _make_alert(db, sensor_id=1, metric_name="Temperature")
    result = is_frequency_recurring(db, sensor_id=1, metric_name="Temperature", new_alert_id=new.AlertId, threshold_count=3, window_hours=24)
    assert result is False


# --- RECUR-02: is_reappearance_recurring ---

def test_reappearance_no_prior_alerts_returns_false(db):
    result = is_reappearance_recurring(db, sensor_id=1, metric_name="Temperature")
    assert result is False


def test_reappearance_unresolved_prior_returns_false(db):
    _make_alert(db, sensor_id=1, metric_name="Temperature", is_resolved=False)
    result = is_reappearance_recurring(db, sensor_id=1, metric_name="Temperature")
    assert result is False


def test_reappearance_resolved_prior_returns_true(db):
    _make_alert(db, sensor_id=1, metric_name="Temperature", is_resolved=True)
    result = is_reappearance_recurring(db, sensor_id=1, metric_name="Temperature")
    assert result is True


# --- check_recurrence (combined) ---

def test_check_recurrence_neither_signal_returns_false(db):
    # 1 alert, no resolved history
    new = _make_alert(db, sensor_id=2, metric_name="Humidity")
    result = check_recurrence(db, sensor_id=2, metric_name="Humidity", new_alert_id=new.AlertId, threshold_count=3, window_hours=24)
    assert result is False


def test_check_recurrence_frequency_signal_only_returns_true(db):
    _make_alert(db, sensor_id=2, metric_name="Humidity")
    _make_alert(db, sensor_id=2, metric_name="Humidity")
    _make_alert(db, sensor_id=2, metric_name="Humidity")
    new = _make_alert(db, sensor_id=2, metric_name="Humidity")
    result = check_recurrence(db, sensor_id=2, metric_name="Humidity", new_alert_id=new.AlertId, threshold_count=3, window_hours=24)
    assert result is True


def test_check_recurrence_reappearance_signal_only_returns_true(db):
    _make_alert(db, sensor_id=2, metric_name="Humidity", is_resolved=True)
    new = _make_alert(db, sensor_id=2, metric_name="Humidity")
    result = check_recurrence(db, sensor_id=2, metric_name="Humidity", new_alert_id=new.AlertId, threshold_count=3, window_hours=24)
    assert result is True
