import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from main import app
from database import get_db
from utils.jwt import get_current_user

client = TestClient(app)


# ------------------------------------------------------------------ #
# Helpers
# ------------------------------------------------------------------ #

def fake_manager():
    return {"user_id": 1, "role": "FarmManager"}


def fake_worker():
    return {"user_id": 2, "role": "Worker"}


def make_mock_manager(user_id=1):
    user = MagicMock()
    user.UserId = user_id
    user.role = MagicMock()
    user.role.RoleName = "FarmManager"
    return user


def make_mock_worker(user_id=2):
    user = MagicMock()
    user.UserId = user_id
    user.role = MagicMock()
    user.role.RoleName = "Worker"
    return user


def make_mock_alert(alert_id=1, sensor_id=10):
    alert = MagicMock()
    alert.AlertId = alert_id
    alert.SensorId = sensor_id
    alert.IsResolved = False
    return alert


def make_mock_assignment(zone_id=None, pepper_id=None, plant_id=None):
    a = MagicMock()
    a.ZoneId = zone_id
    a.PepperId = pepper_id
    a.PlantId = plant_id
    a.IsActive = True
    return a


def _fake_response(anomaly_id=None, zone_id=None, pepper_id=None, description=None):
    """Build a minimal mock TaskResponse-like object for patching _to_response."""
    d = {
        "id": 1, "title": "Test task", "description": description,
        "status": "todo", "priority": "medium", "taskType": "inspection",
        "createdByUserId": 1, "assignedToUserId": None, "dueDate": None,
        "startedAt": None, "completedAt": None,
        "pepperId": pepper_id, "zoneId": zone_id, "zoneCode": None,
        "anomalyId": anomaly_id,
        "createdAt": "2026-05-01T00:00:00", "updatedAt": "2026-05-01T00:00:00",
    }
    m = MagicMock(**d)
    m.model_dump = lambda mode=None: d
    return m


def _sequential(*returns):
    """Return a side_effect function that yields values in order, then repeats the last."""
    items = list(returns)
    state = {"i": 0}

    def _fn():
        val = items[state["i"]]
        state["i"] = min(state["i"] + 1, len(items) - 1)
        return val

    return _fn


# ------------------------------------------------------------------ #
# 1. Normal task creation (no anomaly reference) still works
# ------------------------------------------------------------------ #

def test_create_task_without_anomaly_id_succeeds():
    """Normal task creation without anomalyId still works (non-regression)."""
    from services import task_service

    mock_db = MagicMock()
    manager = make_mock_manager()
    # Only one DB query: caller lookup
    mock_db.query.return_value.filter.return_value.first.return_value = manager

    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_current_user] = fake_manager
    try:
        with patch.object(task_service, "_to_response", return_value=_fake_response()):
            res = client.post(
                "/api/tasks",
                json={"title": "Water crops", "taskType": "irrigation"},
            )
        assert res.status_code == 201
        assert res.json()["anomalyId"] is None
        # Verify AnomalyId is not set on the stored task object
        added_task = mock_db.add.call_args[0][0]
        assert added_task.AnomalyId is None
    finally:
        app.dependency_overrides.clear()


# ------------------------------------------------------------------ #
# 2. Task creation with valid anomaly ID links the task
# ------------------------------------------------------------------ #

def test_create_task_with_valid_anomaly_id():
    """When anomalyId is provided and the alert exists, the task is stored with AnomalyId set."""
    from services import task_service

    mock_db = MagicMock()
    manager = make_mock_manager()
    alert = make_mock_alert(alert_id=5, sensor_id=10)
    # No active SensorAssignment for this sensor (alert created before assignment existed)
    mock_db.query.return_value.filter.return_value.first.side_effect = _sequential(
        manager,   # caller lookup
        alert,     # SensorAlert lookup
        None,      # SensorAssignment lookup (not found)
    )

    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_current_user] = fake_manager
    try:
        with patch.object(task_service, "_to_response", return_value=_fake_response(anomaly_id=5)):
            res = client.post(
                "/api/tasks",
                json={
                    "title": "Handle alert: Temperature",
                    "taskType": "inspection",
                    "priority": "critical",
                    "anomalyId": 5,
                },
            )
        assert res.status_code == 201
        assert res.json()["anomalyId"] == 5

        # Verify AnomalyId=5 is stored on the Task object added to the session
        mock_db.add.assert_called_once()
        added_task = mock_db.add.call_args[0][0]
        assert added_task.AnomalyId == 5
    finally:
        app.dependency_overrides.clear()


# ------------------------------------------------------------------ #
# 3. Task creation with non-existent anomaly ID returns 400
# ------------------------------------------------------------------ #

def test_create_task_with_invalid_anomaly_id_returns_error():
    """When anomalyId references a missing alert, task creation returns 400."""
    mock_db = MagicMock()
    manager = make_mock_manager()
    mock_db.query.return_value.filter.return_value.first.side_effect = _sequential(
        manager,  # caller lookup
        None,     # SensorAlert not found — stops here
    )

    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_current_user] = fake_manager
    try:
        res = client.post(
            "/api/tasks",
            json={"title": "Handle alert", "taskType": "inspection", "anomalyId": 999},
        )
        assert res.status_code == 400
        detail = res.json()["detail"]
        assert "999" in detail or "not found" in detail.lower()
        mock_db.add.assert_not_called()
    finally:
        app.dependency_overrides.clear()


# ------------------------------------------------------------------ #
# 4. Worker cannot create a task (existing auth check still enforced)
# ------------------------------------------------------------------ #

def test_worker_cannot_create_task_returns_400():
    """Only FarmManagers may create tasks — Worker gets 400."""
    mock_db = MagicMock()
    worker = make_mock_worker()
    mock_db.query.return_value.filter.return_value.first.return_value = worker

    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_current_user] = fake_worker
    try:
        res = client.post(
            "/api/tasks",
            json={"title": "Test task", "taskType": "inspection"},
        )
        assert res.status_code == 400
        detail = res.json()["detail"].lower()
        assert "manager" in detail or "farmmanager" in detail
    finally:
        app.dependency_overrides.clear()


# ------------------------------------------------------------------ #
# 5. anomalyId is optional — normal tasks have null reference
# ------------------------------------------------------------------ #

def test_create_task_anomaly_id_is_optional():
    """Omitting anomalyId produces a task with AnomalyId=NULL."""
    from services import task_service

    mock_db = MagicMock()
    manager = make_mock_manager()
    mock_db.query.return_value.filter.return_value.first.return_value = manager

    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_current_user] = fake_manager
    try:
        with patch.object(task_service, "_to_response", return_value=_fake_response()):
            res = client.post(
                "/api/tasks",
                json={"title": "Routine check", "taskType": "inspection"},
            )
        assert res.status_code == 201
        added_task = mock_db.add.call_args[0][0]
        assert added_task.AnomalyId is None
    finally:
        app.dependency_overrides.clear()


# ------------------------------------------------------------------ #
# 6. SensorAssignment auto-fills ZoneId and PepperId when not provided
# ------------------------------------------------------------------ #

def test_create_task_uses_sensor_assignment_for_zone_and_pepper():
    """When anomalyId is given, ZoneId/PepperId from active SensorAssignment are used
    as defaults (only when not explicitly provided in the request)."""
    from services import task_service

    mock_db = MagicMock()
    manager = make_mock_manager()
    alert = make_mock_alert(alert_id=3, sensor_id=7)
    assignment = make_mock_assignment(zone_id=42, pepper_id=9, plant_id=55)

    mock_db.query.return_value.filter.return_value.first.side_effect = _sequential(
        manager,     # caller lookup
        alert,       # SensorAlert lookup
        assignment,  # SensorAssignment lookup
    )

    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_current_user] = fake_manager
    try:
        with patch.object(task_service, "_to_response",
                          return_value=_fake_response(anomaly_id=3, zone_id=42, pepper_id=9)):
            res = client.post(
                "/api/tasks",
                # No zoneId / zoneCode / pepperId — should be filled from assignment
                json={"title": "Handle alert", "taskType": "inspection", "anomalyId": 3},
            )
        assert res.status_code == 201

        added_task = mock_db.add.call_args[0][0]
        assert added_task.ZoneId == 42, "ZoneId should come from SensorAssignment"
        assert added_task.PepperId == 9, "PepperId should come from SensorAssignment"
        # PlantId has no column on Task; it must appear in the description
        assert added_task.Description is not None
        assert "55" in added_task.Description
    finally:
        app.dependency_overrides.clear()


# ------------------------------------------------------------------ #
# 7. Explicit zone/pepper in request takes precedence over assignment
# ------------------------------------------------------------------ #

def test_explicit_zone_overrides_sensor_assignment():
    """If the request explicitly provides zoneCode, it must win over SensorAssignment."""
    from services import task_service

    mock_db = MagicMock()
    manager = make_mock_manager()
    alert = make_mock_alert(alert_id=4, sensor_id=8)
    assignment = make_mock_assignment(zone_id=99, pepper_id=99, plant_id=None)

    explicit_zone = MagicMock()
    explicit_zone.ZoneId = 7

    mock_db.query.return_value.filter.return_value.first.side_effect = _sequential(
        manager,        # caller
        explicit_zone,  # FarmZone lookup (for zoneCode resolution)
        alert,          # SensorAlert
        assignment,     # SensorAssignment
    )

    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_current_user] = fake_manager
    try:
        with patch.object(task_service, "_to_response",
                          return_value=_fake_response(anomaly_id=4, zone_id=7)):
            res = client.post(
                "/api/tasks",
                json={
                    "title": "Handle alert",
                    "taskType": "inspection",
                    "anomalyId": 4,
                    "zoneCode": "GH-01",  # explicit — must beat assignment.ZoneId=99
                },
            )
        assert res.status_code == 201
        added_task = mock_db.add.call_args[0][0]
        assert added_task.ZoneId == 7, "Explicit zoneCode must override SensorAssignment"
    finally:
        app.dependency_overrides.clear()
