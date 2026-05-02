import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from datetime import datetime, timedelta
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

from models.sensor import Sensor
from services.sensor_auto_sync_service import (
    sync_sensor_live_window,
    run_sensor_auto_sync_once,
    LIVE_LOOKBACK_HOURS,
    SYNC_INTERVAL_MINUTES,
)

# ------------------------------------------------------------------ #
# Setup
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
# 1. Configuration constants
# ------------------------------------------------------------------ #
def test_lookback_hours_is_48():
    """Live dashboard should look back 48 hours - per design."""
    assert LIVE_LOOKBACK_HOURS == 48


def test_sync_interval_is_30_minutes():
    """Auto-sync should run every 30 minutes - per design."""
    assert SYNC_INTERVAL_MINUTES == 30


# ------------------------------------------------------------------ #
# 2. sync_sensor_live_window
# ------------------------------------------------------------------ #
@patch("services.sensor_auto_sync_service.sync_sensor_readings")
def test_sync_sensor_live_window_uses_correct_time_range(mock_sync, db):
    sensor = Sensor(SensorId=1, MacAddress="AA:BB:CC", IsActive=True)
    db.add(sensor)
    db.commit()

    mock_sync.return_value = {"inserted": 5, "skippedDuplicates": 0}

    result = sync_sensor_live_window(db, sensor)

    # Verify the call was made with proper 48h window
    args, kwargs = mock_sync.call_args
    time_diff = kwargs["end_date"] - kwargs["start_date"]
    assert abs(time_diff - timedelta(hours=48)) < timedelta(seconds=1)

    # Verify result includes mode + lookback metadata
    assert result["mode"] == "live-window"
    assert result["lookbackHours"] == 48
    assert result["sensorId"] == 1


@patch("services.sensor_auto_sync_service.sync_sensor_readings")
def test_sync_sensor_live_window_passes_created_at_false(mock_sync, db):
    """For live data we want 'sample_time' not 'created_at' from Atomation."""
    sensor = Sensor(SensorId=1, MacAddress="AA:BB:CC", IsActive=True)
    db.add(sensor)
    db.commit()

    mock_sync.return_value = {"inserted": 0, "skippedDuplicates": 0}
    sync_sensor_live_window(db, sensor)

    _, kwargs = mock_sync.call_args
    assert kwargs["created_at"] is False


# ------------------------------------------------------------------ #
# 3. run_sensor_auto_sync_once
# ------------------------------------------------------------------ #
@patch("services.sensor_auto_sync_service.SessionLocal")
@patch("services.sensor_auto_sync_service.sync_sensor_live_window")
def test_run_auto_sync_processes_only_active_sensors(mock_sync_window, mock_session_local):
    # Setup mock DB
    mock_db = MagicMock()
    mock_session_local.return_value = mock_db

    active_sensor_1 = MagicMock(SensorId=1, MacAddress="AA", IsActive=True)
    active_sensor_2 = MagicMock(SensorId=2, MacAddress="BB", IsActive=True)
    # Note: filter() with IsActive==True excludes inactive — query mock should reflect that

    mock_db.query.return_value.filter.return_value.order_by.return_value.all.return_value = [
        active_sensor_1, active_sensor_2,
    ]

    mock_sync_window.return_value = {"inserted": 1}

    results = run_sensor_auto_sync_once()

    assert len(results) == 2
    assert mock_sync_window.call_count == 2
    mock_db.close.assert_called_once()


@patch("services.sensor_auto_sync_service.SessionLocal")
@patch("services.sensor_auto_sync_service.sync_sensor_live_window")
def test_run_auto_sync_continues_after_single_sensor_error(mock_sync_window, mock_session_local):
    """If one sensor fails, others must still be processed."""
    mock_db = MagicMock()
    mock_session_local.return_value = mock_db

    sensor_1 = MagicMock(SensorId=1, MacAddress="AA", IsActive=True)
    sensor_2 = MagicMock(SensorId=2, MacAddress="BB", IsActive=True)
    sensor_3 = MagicMock(SensorId=3, MacAddress="CC", IsActive=True)

    mock_db.query.return_value.filter.return_value.order_by.return_value.all.return_value = [
        sensor_1, sensor_2, sensor_3,
    ]

    # Sensor 2 fails, others succeed
    mock_sync_window.side_effect = [
        {"inserted": 1, "sensorId": 1},
        Exception("Atomation API down"),
        {"inserted": 1, "sensorId": 3},
    ]

    results = run_sensor_auto_sync_once()

    assert len(results) == 3
    assert "error" in results[1]
    assert "Atomation API down" in results[1]["error"]
    # Sensors 1 and 3 still succeeded
    assert results[0].get("inserted") == 1
    assert results[2].get("inserted") == 1


@patch("services.sensor_auto_sync_service.SessionLocal")
def test_run_auto_sync_closes_db_on_exception(mock_session_local):
    """Even if everything fails, DB connection must be closed."""
    mock_db = MagicMock()
    mock_session_local.return_value = mock_db
    mock_db.query.side_effect = Exception("DB unreachable")

    with pytest.raises(Exception):
        run_sensor_auto_sync_once()

    mock_db.close.assert_called_once()