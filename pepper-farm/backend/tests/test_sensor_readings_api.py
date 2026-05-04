import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from main import app
from database import get_db


client = TestClient(app)


# ------------------------------------------------------------------ #
# Helpers
# ------------------------------------------------------------------ #
def make_valid_payload(**overrides):
    """Build a minimal valid SensorReadingCreate payload."""
    base = {
        "sensorId": 1,
        "macAddress": "AA:BB:CC:DD:EE:FF",
        "deviceName": "Greenhouse 1",
        "temperature": 24.5,
        "humidity": 60.0,
        "leak": 0.0,
        "radiation": 250.0,
        "batteryLevel": 85.0,
        "readingType": "Periodic",
        "rawJson": {"foo": "bar"},
    }
    base.update(overrides)
    return base


# ------------------------------------------------------------------ #
# 1. Successful path
# ------------------------------------------------------------------ #
@patch("routers.sensor_readings.process_sensor_reading")
def test_post_reading_returns_201_on_success(mock_process):
    mock_db = MagicMock()
    mock_process.return_value = (
        MagicMock(readingId=1, alertsCreated=0, alerts=[]),
        None,  # no error
    )

    app.dependency_overrides[get_db] = lambda: mock_db
    try:
        res = client.post("/api/sensor-readings", json=make_valid_payload())
        assert res.status_code == 201
        data = res.json()
        assert data["readingId"] == 1
        assert data["alertsCreated"] == 0
    finally:
        app.dependency_overrides.clear()


@patch("routers.sensor_readings.process_sensor_reading")
def test_post_reading_returns_alerts_when_created(mock_process):
    """When anomalies are detected, response should include alert details."""
    mock_db = MagicMock()
    mock_alerts = [
        MagicMock(
            metricName="Temperature", actualValue=35.0,
            minAllowed=18.0, maxAllowed=30.0,
            severity="High", message="Too hot",
        ),
    ]
    mock_process.return_value = (
        MagicMock(readingId=1, alertsCreated=1, alerts=mock_alerts),
        None,
    )

    app.dependency_overrides[get_db] = lambda: mock_db
    try:
        res = client.post("/api/sensor-readings", json=make_valid_payload(
            temperature=35.0,
            readingType="Trigger",
        ))
        assert res.status_code == 201
        data = res.json()
        assert data["alertsCreated"] == 1
    finally:
        app.dependency_overrides.clear()


# ------------------------------------------------------------------ #
# 2. Validation errors (Pydantic)
# ------------------------------------------------------------------ #
def test_post_reading_rejects_missing_sensor_id():
    payload = make_valid_payload()
    del payload["sensorId"]
    res = client.post("/api/sensor-readings", json=payload)
    assert res.status_code == 422


def test_post_reading_rejects_zero_sensor_id():
    """sensorId must be > 0 (gt=0 in schema)."""
    payload = make_valid_payload(sensorId=0)
    res = client.post("/api/sensor-readings", json=payload)
    assert res.status_code == 422


def test_post_reading_rejects_negative_sensor_id():
    payload = make_valid_payload(sensorId=-5)
    res = client.post("/api/sensor-readings", json=payload)
    assert res.status_code == 422


def test_post_reading_rejects_empty_mac_address():
    payload = make_valid_payload(macAddress="")
    res = client.post("/api/sensor-readings", json=payload)
    assert res.status_code == 422


def test_post_reading_rejects_whitespace_only_mac_address():
    """The schema's field_validator strips whitespace and rejects empty strings."""
    payload = make_valid_payload(macAddress="   ")
    res = client.post("/api/sensor-readings", json=payload)
    assert res.status_code == 422


# ------------------------------------------------------------------ #
# 3. Service-level errors mapped to HTTP codes
# ------------------------------------------------------------------ #
@patch("routers.sensor_readings.process_sensor_reading")
def test_post_reading_returns_404_when_sensor_does_not_exist(mock_process):
    """Service returning 'does not exist' error -> 404."""
    mock_db = MagicMock()
    mock_process.return_value = (None, "Sensor with id 99 does not exist.")

    app.dependency_overrides[get_db] = lambda: mock_db
    try:
        res = client.post("/api/sensor-readings", json=make_valid_payload(sensorId=99))
        assert res.status_code == 404
        assert "does not exist" in res.json()["detail"]
    finally:
        app.dependency_overrides.clear()


@patch("routers.sensor_readings.process_sensor_reading")
def test_post_reading_returns_400_for_other_service_errors(mock_process):
    """Service returning a generic error -> 400."""
    mock_db = MagicMock()
    mock_process.return_value = (None, "Invalid reading format")

    app.dependency_overrides[get_db] = lambda: mock_db
    try:
        res = client.post("/api/sensor-readings", json=make_valid_payload())
        assert res.status_code == 400
    finally:
        app.dependency_overrides.clear()


# ------------------------------------------------------------------ #
# 4. Optional fields
# ------------------------------------------------------------------ #
@patch("routers.sensor_readings.process_sensor_reading")
def test_post_reading_accepts_minimal_payload(mock_process):
    """Only sensorId + macAddress are required."""
    mock_db = MagicMock()
    mock_process.return_value = (
        MagicMock(readingId=1, alertsCreated=0, alerts=[]),
        None,
    )

    app.dependency_overrides[get_db] = lambda: mock_db
    try:
        minimal = {"sensorId": 1, "macAddress": "AA:BB:CC"}
        res = client.post("/api/sensor-readings", json=minimal)
        assert res.status_code == 201
    finally:
        app.dependency_overrides.clear()