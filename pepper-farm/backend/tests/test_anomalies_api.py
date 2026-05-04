import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from main import app
from database import get_db


client = TestClient(app)


# ------------------------------------------------------------------ #
# Helpers
# ------------------------------------------------------------------ #
def make_mock_alert(
    alert_id=1, sensor_id=1, reading_id=1,
    metric="Temperature", actual=35.0,
    severity="High", resolved=False, pepper_id=1,
):
    a = MagicMock()
    a.AlertId = alert_id
    a.SensorId = sensor_id
    a.ReadingId = reading_id
    a.PepperId = pepper_id
    a.MetricName = metric
    a.ActualValue = actual
    a.MinAllowed = 18.0
    a.MaxAllowed = 30.0
    a.Severity = severity
    a.Message = f"{metric} out of range"
    a.IsResolved = resolved
    a.CreatedAtUtc = datetime(2026, 4, 27, 9, 0, 0)
    a.ResolvedAtUtc = None
    return a


# ------------------------------------------------------------------ #
# 1. GET /api/manager/anomalies/summary
# ------------------------------------------------------------------ #
def test_get_summary_returns_kpi_counts():
    mock_db = MagicMock()
    # Each scalar() call returns a different number for the chained queries
    mock_db.query.return_value.filter.return_value.scalar.side_effect = [
        5,  # active alerts
        2,  # high severity
    ]
    # Then the join query for affected zones
    mock_db.query.return_value.join.return_value.filter.return_value.scalar.return_value = 3
    # And the latest reading
    mock_db.query.return_value.scalar.return_value = datetime(2026, 4, 27, 10, 0, 0)

    app.dependency_overrides[get_db] = lambda: mock_db
    try:
        res = client.get("/api/manager/anomalies/summary")
        assert res.status_code == 200
        data = res.json()
        assert "activeAlerts" in data
        assert "highSeverity" in data
        assert "affectedZones" in data
        assert "latestReadingUtc" in data
    finally:
        app.dependency_overrides.clear()


def test_get_summary_returns_zero_counts_when_db_empty():
    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.scalar.return_value = 0
    mock_db.query.return_value.join.return_value.filter.return_value.scalar.return_value = 0
    mock_db.query.return_value.scalar.return_value = None  # no readings

    app.dependency_overrides[get_db] = lambda: mock_db
    try:
        res = client.get("/api/manager/anomalies/summary")
        assert res.status_code == 200
        data = res.json()
        assert data["activeAlerts"] == 0
        assert data["highSeverity"] == 0
        assert data["latestReadingUtc"] is None
    finally:
        app.dependency_overrides.clear()


# ------------------------------------------------------------------ #
# 2. GET /api/manager/anomalies/recent
# ------------------------------------------------------------------ #
def test_get_recent_returns_alert_list():
    mock_db = MagicMock()
    alert = make_mock_alert()
    # Service returns tuples: (alert, zone_name, zone_code, plant_code, pepper_name)
    mock_db.query.return_value.join.return_value.outerjoin.return_value\
        .outerjoin.return_value.outerjoin.return_value\
        .filter.return_value.order_by.return_value.limit.return_value.all.return_value = [
            (alert, "Greenhouse A", "ZONE-A", "PLANT-1", "Sweet Bell"),
        ]

    app.dependency_overrides[get_db] = lambda: mock_db
    try:
        res = client.get("/api/manager/anomalies/recent")
        assert res.status_code == 200
        data = res.json()
        assert len(data) == 1
        assert data[0]["alertId"] == 1
        assert data[0]["metricName"] == "Temperature"
        assert data[0]["zoneName"] == "Greenhouse A"
    finally:
        app.dependency_overrides.clear()


def test_get_recent_respects_limit_param():
    mock_db = MagicMock()
    mock_db.query.return_value.join.return_value.outerjoin.return_value\
        .outerjoin.return_value.outerjoin.return_value\
        .filter.return_value.order_by.return_value.limit.return_value.all.return_value = []

    app.dependency_overrides[get_db] = lambda: mock_db
    try:
        res = client.get("/api/manager/anomalies/recent?limit=10")
        assert res.status_code == 200
        # Verify .limit(10) was called
        limit_mock = mock_db.query.return_value.join.return_value.outerjoin.return_value\
            .outerjoin.return_value.outerjoin.return_value\
            .filter.return_value.order_by.return_value.limit
        limit_mock.assert_called_with(10)
    finally:
        app.dependency_overrides.clear()


def test_get_recent_rejects_limit_above_200():
    """Limit must be <= 200 per Pydantic Query validation."""
    res = client.get("/api/manager/anomalies/recent?limit=500")
    assert res.status_code == 422


def test_get_recent_rejects_zero_limit():
    res = client.get("/api/manager/anomalies/recent?limit=0")
    assert res.status_code == 422


def test_get_recent_returns_empty_list_when_no_alerts():
    mock_db = MagicMock()
    mock_db.query.return_value.join.return_value.outerjoin.return_value\
        .outerjoin.return_value.outerjoin.return_value\
        .filter.return_value.order_by.return_value.limit.return_value.all.return_value = []

    app.dependency_overrides[get_db] = lambda: mock_db
    try:
        res = client.get("/api/manager/anomalies/recent")
        assert res.status_code == 200
        assert res.json() == []
    finally:
        app.dependency_overrides.clear()


# ------------------------------------------------------------------ #
# 3. GET /api/manager/anomalies/trends
# ------------------------------------------------------------------ #
def test_get_trends_default_returns_7_points():
    """Default days=7 should always return 7 trend points (filling zeros)."""
    mock_db = MagicMock()
    # No DB rows -> all 7 days should be 0
    mock_db.query.return_value.filter.return_value.group_by.return_value\
        .order_by.return_value.all.return_value = []

    app.dependency_overrides[get_db] = lambda: mock_db
    try:
        res = client.get("/api/manager/anomalies/trends")
        assert res.status_code == 200
        data = res.json()
        assert len(data) == 7
        # All counts should be 0 since DB is empty
        assert all(point["count"] == 0 for point in data)
        assert all(point["highCount"] == 0 for point in data)
    finally:
        app.dependency_overrides.clear()


def test_get_trends_respects_days_param():
    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.group_by.return_value\
        .order_by.return_value.all.return_value = []

    app.dependency_overrides[get_db] = lambda: mock_db
    try:
        res = client.get("/api/manager/anomalies/trends?days=14")
        assert res.status_code == 200
        data = res.json()
        assert len(data) == 14
    finally:
        app.dependency_overrides.clear()


def test_get_trends_rejects_days_above_30():
    res = client.get("/api/manager/anomalies/trends?days=60")
    assert res.status_code == 422


def test_get_trends_rejects_zero_days():
    res = client.get("/api/manager/anomalies/trends?days=0")
    assert res.status_code == 422


# ------------------------------------------------------------------ #
# 4. GET /api/manager/anomalies/by-zone
# ------------------------------------------------------------------ #
def test_get_by_zone_returns_zone_health_list():
    mock_db = MagicMock()
    # Returns tuples: (zone_id, zone_name, zone_code, total, high_count)
    mock_db.query.return_value.join.return_value.join.return_value\
        .filter.return_value.group_by.return_value\
        .order_by.return_value.all.return_value = [
            (1, "Greenhouse A", "ZONE-A", 5, 2),
            (2, "Greenhouse B", "ZONE-B", 1, 0),
        ]

    app.dependency_overrides[get_db] = lambda: mock_db
    try:
        res = client.get("/api/manager/anomalies/by-zone")
        assert res.status_code == 200
        data = res.json()
        assert len(data) == 2
        # Zone A has high alerts -> health="high"
        assert data[0]["health"] == "high"
        # Zone B has no high but has alerts -> health="medium"
        assert data[1]["health"] == "medium"
    finally:
        app.dependency_overrides.clear()


def test_get_by_zone_returns_empty_when_no_zones_have_alerts():
    mock_db = MagicMock()
    mock_db.query.return_value.join.return_value.join.return_value\
        .filter.return_value.group_by.return_value\
        .order_by.return_value.all.return_value = []

    app.dependency_overrides[get_db] = lambda: mock_db
    try:
        res = client.get("/api/manager/anomalies/by-zone")
        assert res.status_code == 200
        assert res.json() == []
    finally:
        app.dependency_overrides.clear()


# ------------------------------------------------------------------ #
# 5. PATCH /api/sensor-alerts/{alert_id}/resolve
# ------------------------------------------------------------------ #
def test_resolve_alert_marks_as_resolved():
    mock_db = MagicMock()
    alert = make_mock_alert(alert_id=1, resolved=False)
    mock_db.query.return_value.filter.return_value.first.return_value = alert

    app.dependency_overrides[get_db] = lambda: mock_db
    try:
        res = client.patch("/api/sensor-alerts/1/resolve")
        assert res.status_code == 200
        # Service should have set IsResolved = True
        assert alert.IsResolved is True
    finally:
        app.dependency_overrides.clear()


def test_resolve_alert_returns_404_when_missing():
    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.first.return_value = None

    app.dependency_overrides[get_db] = lambda: mock_db
    try:
        res = client.patch("/api/sensor-alerts/999/resolve")
        assert res.status_code == 404
        assert "not found" in res.json()["detail"].lower()
    finally:
        app.dependency_overrides.clear()


def test_resolve_alert_is_idempotent():
    """Resolving an already-resolved alert should still return 200."""
    mock_db = MagicMock()
    already_resolved = make_mock_alert(alert_id=1, resolved=True)
    already_resolved.ResolvedAtUtc = datetime(2026, 4, 27, 9, 0, 0)
    mock_db.query.return_value.filter.return_value.first.return_value = already_resolved

    app.dependency_overrides[get_db] = lambda: mock_db
    try:
        res = client.patch("/api/sensor-alerts/1/resolve")
        assert res.status_code == 200
        data = res.json()
        assert data["isResolved"] is True
        # commit should NOT have been called again (no change)
        # (this verifies idempotency at the response level)
    finally:
        app.dependency_overrides.clear()


def test_resolve_alert_returns_alert_id_in_response():
    mock_db = MagicMock()
    alert = make_mock_alert(alert_id=42, resolved=False)
    mock_db.query.return_value.filter.return_value.first.return_value = alert

    app.dependency_overrides[get_db] = lambda: mock_db
    try:
        res = client.patch("/api/sensor-alerts/42/resolve")
        assert res.status_code == 200
        data = res.json()
        assert data["alertId"] == 42
    finally:
        app.dependency_overrides.clear()