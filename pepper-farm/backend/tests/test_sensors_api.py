import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

# Set ATOMATION env vars BEFORE importing main (otherwise startup fails)
os.environ.setdefault("ATOMATION_EMAIL", "test@example.com")
os.environ.setdefault("ATOMATION_PASSWORD", "test-password")

from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from main import app
from database import get_db
from models.sensor import Sensor, SensorReading


client = TestClient(app)


def make_mock_sensor(sensor_id=1, mac="AA:BB:CC", active=True):
    s = MagicMock()
    s.SensorId = sensor_id
    s.MacAddress = mac
    s.DeviceName = "Test Sensor"
    s.UnitName = "Unit 1"
    s.BusinessUnitId = "BU-1"
    s.GatewayId = "GW-1"
    s.SensorType = "temp_humidity"
    s.IsActive = active
    return s


def make_mock_reading(reading_id=1, sensor_id=1, sample_time=None):
    r = MagicMock()
    r.ReadingId = reading_id
    r.SensorId = sensor_id
    r.MacAddress = "AA:BB:CC"
    r.DeviceName = "Test"
    r.Temperature = 24.5
    r.Humidity = 60.0
    r.Leak = 0.0
    r.VibrationSD = 0.0
    r.BatteryLevel = 90.0
    r.Radiation = 0.0
    r.SampleTimeUtc = sample_time or datetime.utcnow() - timedelta(minutes=5)
    r.GatewayReadTimeUtc = None
    r.AtomationCreatedAtUtc = None
    r.ReadingType = "periodic"
    r.Latitude = None
    r.Longitude = None
    return r


# ------------------------------------------------------------------ #
# 1. GET /api/sensors
# ------------------------------------------------------------------ #
def test_get_sensors_returns_list():
    mock_db = MagicMock()
    sensors = [make_mock_sensor(1), make_mock_sensor(2, "DD:EE:FF")]
    mock_db.query.return_value.order_by.return_value.all.return_value = sensors

    app.dependency_overrides[get_db] = lambda: mock_db
    try:
        res = client.get("/api/sensors")
        assert res.status_code == 200
        data = res.json()
        assert len(data) == 2
        assert data[0]["MacAddress"] == "AA:BB:CC"
    finally:
        app.dependency_overrides.clear()


def test_get_sensors_returns_empty_list_when_no_sensors():
    mock_db = MagicMock()
    mock_db.query.return_value.order_by.return_value.all.return_value = []

    app.dependency_overrides[get_db] = lambda: mock_db
    try:
        res = client.get("/api/sensors")
        assert res.status_code == 200
        assert res.json() == []
    finally:
        app.dependency_overrides.clear()


# ------------------------------------------------------------------ #
# 2. POST /api/sensors/sync (validation)
# ------------------------------------------------------------------ #
def test_sync_rejects_end_before_start():
    res = client.post("/api/sensors/sync", json={
        "macAddress": "AA:BB:CC",
        "startDate": "2026-04-28T00:00:00",
        "endDate": "2026-04-27T00:00:00",  # before start
        "createdAt": False,
    })
    assert res.status_code == 400
    assert "after startDate" in res.json()["detail"]


def test_sync_rejects_range_too_large_for_created_at():
    """When createdAt=True, max 2 days. 3 days should fail."""
    res = client.post("/api/sensors/sync", json={
        "macAddress": "AA:BB:CC",
        "startDate": "2026-04-25T00:00:00",
        "endDate": "2026-04-28T00:00:00",  # 3 days
        "createdAt": True,
    })
    assert res.status_code == 400
    assert "too large" in res.json()["detail"].lower()


def test_sync_rejects_range_too_large_for_sample_time():
    """When createdAt=False, max 14 days. 15 days should fail."""
    res = client.post("/api/sensors/sync", json={
        "macAddress": "AA:BB:CC",
        "startDate": "2026-04-01T00:00:00",
        "endDate": "2026-04-16T00:00:00",  # 15 days
        "createdAt": False,
    })
    assert res.status_code == 400


def test_sync_validates_mac_address_min_length():
    res = client.post("/api/sensors/sync", json={
        "macAddress": "AB",  # too short
        "startDate": "2026-04-27T00:00:00",
        "endDate": "2026-04-28T00:00:00",
        "createdAt": False,
    })
    assert res.status_code == 422  # Pydantic validation


# ------------------------------------------------------------------ #
# 3. POST /api/sensors/{id}/refresh
# ------------------------------------------------------------------ #
def test_refresh_returns_404_when_sensor_missing():
    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.first.return_value = None

    app.dependency_overrides[get_db] = lambda: mock_db
    try:
        res = client.post("/api/sensors/999/refresh")
        assert res.status_code == 404
        assert "not found" in res.json()["detail"].lower()
    finally:
        app.dependency_overrides.clear()


@patch("routers.sensors.sync_sensor_readings")
def test_refresh_calls_sync_with_48_hour_window(mock_sync):
    mock_db = MagicMock()
    sensor = make_mock_sensor()
    mock_db.query.return_value.filter.return_value.first.return_value = sensor
    mock_sync.return_value = {"inserted": 5, "macAddress": "AA:BB:CC"}

    app.dependency_overrides[get_db] = lambda: mock_db
    try:
        res = client.post("/api/sensors/1/refresh")
        assert res.status_code == 200

        _, kwargs = mock_sync.call_args
        time_diff = kwargs["end_date"] - kwargs["start_date"]
        assert abs(time_diff - timedelta(hours=48)) < timedelta(seconds=10)
    finally:
        app.dependency_overrides.clear()


# ------------------------------------------------------------------ #
# 4. POST /api/sensors/{id}/live (status calculation)
# ------------------------------------------------------------------ #
@patch("routers.sensors.sync_sensor_readings")
@patch("routers.sensors.get_latest_sensor_reading")
def test_live_returns_live_status_for_recent_reading(mock_get_latest, mock_sync):
    mock_db = MagicMock()
    sensor = make_mock_sensor()
    mock_db.query.return_value.filter.return_value.first.return_value = sensor
    mock_sync.return_value = {"inserted": 1}

    # Reading from 10 minutes ago → should be "live"
    recent_reading = make_mock_reading(sample_time=datetime.utcnow() - timedelta(minutes=10))
    mock_get_latest.return_value = recent_reading

    app.dependency_overrides[get_db] = lambda: mock_db
    try:
        res = client.post("/api/sensors/1/live")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "live"
        assert data["isStale"] is False
    finally:
        app.dependency_overrides.clear()


@patch("routers.sensors.sync_sensor_readings")
@patch("routers.sensors.get_latest_sensor_reading")
def test_live_returns_stale_status_for_old_reading(mock_get_latest, mock_sync):
    mock_db = MagicMock()
    sensor = make_mock_sensor()
    mock_db.query.return_value.filter.return_value.first.return_value = sensor
    mock_sync.return_value = {"inserted": 0}

    # Reading from 8 hours ago → "stale" (>360 minutes)
    old_reading = make_mock_reading(sample_time=datetime.utcnow() - timedelta(hours=8))
    mock_get_latest.return_value = old_reading

    app.dependency_overrides[get_db] = lambda: mock_db
    try:
        res = client.post("/api/sensors/1/live")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "stale"
        assert data["isStale"] is True
    finally:
        app.dependency_overrides.clear()


@patch("routers.sensors.sync_sensor_readings")
@patch("routers.sensors.get_latest_sensor_reading")
def test_live_returns_no_data_when_no_readings(mock_get_latest, mock_sync):
    mock_db = MagicMock()
    sensor = make_mock_sensor()
    mock_db.query.return_value.filter.return_value.first.return_value = sensor
    mock_sync.return_value = {"inserted": 0}
    mock_get_latest.return_value = None  # no readings at all

    app.dependency_overrides[get_db] = lambda: mock_db
    try:
        res = client.post("/api/sensors/1/live")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "no_data"
        assert data["latestReading"] is None
    finally:
        app.dependency_overrides.clear()


# ------------------------------------------------------------------ #
# 5. GET /api/sensors/{id}/latest
# ------------------------------------------------------------------ #
@patch("routers.sensors.get_latest_sensor_reading")
def test_get_latest_returns_404_when_no_readings(mock_get_latest):
    mock_get_latest.return_value = None
    mock_db = MagicMock()

    app.dependency_overrides[get_db] = lambda: mock_db
    try:
        res = client.get("/api/sensors/1/latest")
        assert res.status_code == 404
    finally:
        app.dependency_overrides.clear()


# ------------------------------------------------------------------ #
# 6. POST /api/sensors/export/email (SMTP not configured)
# ------------------------------------------------------------------ #
def test_export_email_returns_503_when_smtp_not_configured(monkeypatch):
    # Clear SMTP env vars to simulate "not configured"
    monkeypatch.delenv("SMTP_HOST", raising=False)
    monkeypatch.delenv("SMTP_USER", raising=False)
    monkeypatch.delenv("SMTP_PASSWORD", raising=False)

    res = client.post("/api/sensors/export/email", json={
        "to": "test@example.com",
        "attachments": [],
    })
    assert res.status_code == 503
    assert "not configured" in res.json()["detail"].lower()


def test_export_email_validates_recipient_email():
    res = client.post("/api/sensors/export/email", json={
        "to": "not-an-email",
        "attachments": [],
    })
    assert res.status_code == 422  # Pydantic EmailStr validation
