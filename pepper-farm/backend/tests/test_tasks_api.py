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
        "anomalyId": anomaly_id, "alertInfo": None,
        "createdAt": "2026-05-01T00:00:00", "updatedAt": "2026-05-01T00:00:00",
    }
    m = MagicMock(**d)
    m.alertInfo = None  # prevent MagicMock auto-attribute from polluting serialisation
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


# ------------------------------------------------------------------ #
# US25 — Worker receives and handles task
# ------------------------------------------------------------------ #

def make_mock_task(task_id=1, assigned_to=2, status="todo", anomaly_id=None, alert=None):
    task = MagicMock()
    task.Id = task_id
    task.Title = "Test task"
    task.Description = None
    task.Status = status
    task.Priority = "medium"
    task.TaskType = "inspection"
    task.CreatedByUserId = 1
    task.AssignedToUserId = assigned_to
    task.DueDate = None
    task.StartedAt = None
    task.CompletedAt = None
    task.PepperId = None
    task.ZoneId = None
    task.AnomalyId = anomaly_id
    task.alert = alert
    task.zone = None
    task.CreatedAt = MagicMock()
    task.CreatedAt.isoformat.return_value = "2026-05-01T00:00:00"
    task.UpdatedAt = MagicMock()
    task.UpdatedAt.isoformat.return_value = "2026-05-01T00:00:00"
    task.checklist_items = []
    return task


def make_mock_sensor_alert(severity="High", metric="Temperature", value=45.0,
                            min_allowed=10.0, max_allowed=35.0,
                            message="Too hot", is_resolved=False):
    a = MagicMock()
    a.Severity = severity
    a.MetricName = metric
    a.ActualValue = value
    a.MinAllowed = min_allowed
    a.MaxAllowed = max_allowed
    a.Message = message
    a.IsResolved = is_resolved
    a.CreatedAtUtc = MagicMock()
    a.CreatedAtUtc.isoformat.return_value = "2026-05-01T10:00:00"
    return a


# ------------------------------------------------------------------ #
# 8. Worker fetches only their own tasks (GET /api/tasks/my)
# ------------------------------------------------------------------ #

def test_worker_fetches_own_tasks():
    """GET /api/tasks/my returns tasks for the authenticated worker."""
    from services import task_service

    mock_db = MagicMock()
    task = make_mock_task(task_id=10, assigned_to=2, status="todo")

    mock_db.query.return_value.filter.return_value.order_by.return_value.all.return_value = [task]

    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_current_user] = fake_worker
    try:
        with patch.object(task_service, "_to_response",
                          return_value=_fake_response()):
            res = client.get("/api/tasks/my")
        assert res.status_code == 200
        assert isinstance(res.json(), list)
    finally:
        app.dependency_overrides.clear()


# ------------------------------------------------------------------ #
# 9. Unauthenticated request to /api/tasks/my is rejected
# ------------------------------------------------------------------ #

def test_unauthenticated_cannot_fetch_my_tasks():
    """GET /api/tasks/my without a valid token returns 401 or 403."""
    # No dependency override — default JWT check will fire
    res = client.get("/api/tasks/my")
    assert res.status_code in (401, 403, 422)


# ------------------------------------------------------------------ #
# 10. Worker can update task status via PATCH
# ------------------------------------------------------------------ #

def test_worker_can_update_task_status():
    """Worker PATCH /api/tasks/{id} with status=in_progress succeeds."""
    from services import task_service

    mock_db = MagicMock()
    task = make_mock_task(task_id=5, assigned_to=2, status="todo")
    mock_db.query.return_value.filter.return_value.first.return_value = task

    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_current_user] = fake_worker
    try:
        with patch.object(task_service, "_to_response",
                          return_value=_fake_response()):
            res = client.patch("/api/tasks/5", json={"status": "in_progress"})
        assert res.status_code == 200
        assert task.Status == "in_progress"
        assert task.StartedAt is not None
    finally:
        app.dependency_overrides.clear()


# ------------------------------------------------------------------ #
# 11. Alert-linked task serialisation includes alertInfo
# ------------------------------------------------------------------ #

def test_alert_linked_task_includes_alert_info():
    """_to_response populates alertInfo when the task has an associated SensorAlert."""
    from services.task_service import _to_response

    alert = make_mock_sensor_alert(
        severity="High", metric="Temperature", value=45.0,
        min_allowed=10.0, max_allowed=35.0,
        message="Too hot", is_resolved=False,
    )
    task = make_mock_task(task_id=1, anomaly_id=7, alert=alert)

    response = _to_response(task)

    assert response.anomalyId == 7
    assert response.alertInfo is not None
    assert response.alertInfo.severity == "High"
    assert response.alertInfo.metricName == "Temperature"
    assert response.alertInfo.actualValue == 45.0
    assert response.alertInfo.minAllowed == 10.0
    assert response.alertInfo.maxAllowed == 35.0
    assert response.alertInfo.message == "Too hot"
    assert response.alertInfo.isResolved is False


# ------------------------------------------------------------------ #
# 12. Task without anomalyId has alertInfo=None
# ------------------------------------------------------------------ #

def test_regular_task_has_no_alert_info():
    """_to_response leaves alertInfo as None when AnomalyId is not set."""
    from services.task_service import _to_response

    task = make_mock_task(task_id=2, anomaly_id=None, alert=None)

    response = _to_response(task)

    assert response.anomalyId is None
    assert response.alertInfo is None


# ------------------------------------------------------------------ #
# US39 — Checklist endpoint permissions
# ------------------------------------------------------------------ #

def test_manager_can_add_checklist_item():
    """POST /api/tasks/{id}/checklist with manager role returns 201."""
    from routers import tasks as tasks_router

    mock_db = MagicMock()
    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_current_user] = fake_manager
    try:
        fake_item = {
            "itemId": 1, "title": "Step", "isCompleted": False, "position": 0,
        }
        with patch.object(tasks_router, "add_checklist_item",
                          return_value=(fake_item, None)):
            res = client.post("/api/tasks/5/checklist", json={"title": "Step"})
        assert res.status_code == 201
        assert res.json()["title"] == "Step"
    finally:
        app.dependency_overrides.clear()


def test_worker_cannot_add_checklist_item():
    """POST /api/tasks/{id}/checklist as worker is rejected by require_role."""
    app.dependency_overrides[get_db] = lambda: MagicMock()
    app.dependency_overrides[get_current_user] = fake_worker
    try:
        res = client.post("/api/tasks/5/checklist", json={"title": "Step"})
        assert res.status_code == 403
    finally:
        app.dependency_overrides.clear()


def test_worker_can_toggle_item_on_assigned_task():
    """Worker PATCH /api/tasks/{id}/checklist/{item_id} succeeds when assignee matches."""
    from services import task_service

    mock_db = MagicMock()
    task = make_mock_task(task_id=5, assigned_to=2)  # fake_worker has user_id=2
    mock_db.query.return_value.filter.return_value.first.return_value = task

    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_current_user] = fake_worker
    try:
        fake_item = {
            "itemId": 9, "title": "Step", "isCompleted": True, "position": 0,
        }
        with patch.object(task_service, "update_checklist_item",
                          return_value=(fake_item, None)):
            res = client.patch(
                "/api/tasks/5/checklist/9", json={"isCompleted": True}
            )
        assert res.status_code == 200
        assert res.json()["isCompleted"] is True
    finally:
        app.dependency_overrides.clear()


def test_worker_cannot_toggle_item_on_other_workers_task():
    """Worker PATCH on a task assigned to someone else returns 403."""
    mock_db = MagicMock()
    task = make_mock_task(task_id=5, assigned_to=999)  # not user_id=2
    mock_db.query.return_value.filter.return_value.first.return_value = task

    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_current_user] = fake_worker
    try:
        res = client.patch(
            "/api/tasks/5/checklist/9", json={"isCompleted": True}
        )
        assert res.status_code == 403
    finally:
        app.dependency_overrides.clear()


def test_worker_cannot_delete_checklist_item():
    """DELETE /api/tasks/{id}/checklist/{item_id} as worker is rejected."""
    app.dependency_overrides[get_db] = lambda: MagicMock()
    app.dependency_overrides[get_current_user] = fake_worker
    try:
        res = client.delete("/api/tasks/5/checklist/9")
        assert res.status_code == 403
    finally:
        app.dependency_overrides.clear()


# ------------------------------------------------------------------ #
# Delete / cancel task (US42 / BSPMT7-491)
# ------------------------------------------------------------------ #

def test_manager_can_delete_task():
    """DELETE /api/tasks/{id} as a manager soft-deletes (status -> cancelled)."""
    from services import task_service

    mock_db = MagicMock()
    task = make_mock_task(task_id=5, status="todo")
    mock_db.query.return_value.filter.return_value.first.return_value = task

    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_current_user] = fake_manager
    try:
        with patch.object(task_service, "_to_response", return_value=_fake_response()):
            res = client.delete("/api/tasks/5")
        assert res.status_code == 200
        # The task is marked cancelled, not removed from the DB.
        assert task.Status == "cancelled"
        mock_db.delete.assert_not_called()
        mock_db.commit.assert_called_once()
    finally:
        app.dependency_overrides.clear()


def test_worker_cannot_delete_task():
    """DELETE /api/tasks/{id} as a worker is blocked by require_role (403)."""
    app.dependency_overrides[get_db] = lambda: MagicMock()
    app.dependency_overrides[get_current_user] = fake_worker
    try:
        res = client.delete("/api/tasks/5")
        assert res.status_code == 403
    finally:
        app.dependency_overrides.clear()


def test_manager_can_delete_done_task():
    """A completed task created by the manager can be soft-deleted (US42 updated rule)."""
    from services import task_service

    mock_db = MagicMock()
    task = make_mock_task(task_id=5, status="done")  # CreatedByUserId=1 == fake_manager
    mock_db.query.return_value.filter.return_value.first.return_value = task

    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_current_user] = fake_manager
    try:
        with patch.object(task_service, "_to_response", return_value=_fake_response()):
            res = client.delete("/api/tasks/5")
        assert res.status_code == 200
        # Soft-deleted: status flipped to cancelled, row not removed.
        assert task.Status == "cancelled"
        mock_db.delete.assert_not_called()
        mock_db.commit.assert_called_once()
    finally:
        app.dependency_overrides.clear()


def test_manager_cannot_delete_another_managers_task():
    """A manager may only delete tasks they created; others return 403."""
    mock_db = MagicMock()
    task = make_mock_task(task_id=5, status="todo")
    task.CreatedByUserId = 999  # created by a different manager (fake_manager is user_id=1)
    mock_db.query.return_value.filter.return_value.first.return_value = task

    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_current_user] = fake_manager
    try:
        res = client.delete("/api/tasks/5")
        assert res.status_code == 403
        # Status is untouched and nothing is committed.
        assert task.Status == "todo"
        mock_db.commit.assert_not_called()
    finally:
        app.dependency_overrides.clear()


def test_delete_missing_task_returns_404():
    """Deleting a non-existent task returns 404."""
    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.first.return_value = None

    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_current_user] = fake_manager
    try:
        res = client.delete("/api/tasks/999")
        assert res.status_code == 404
    finally:
        app.dependency_overrides.clear()


def test_patch_status_cancelled_is_rejected():
    """PATCH cannot be used to cancel a task; status=cancelled is rejected (400)."""
    mock_db = MagicMock()
    task = make_mock_task(task_id=5, status="todo")
    mock_db.query.return_value.filter.return_value.first.return_value = task

    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_current_user] = fake_manager
    try:
        res = client.patch("/api/tasks/5", json={"status": "cancelled"})
        assert res.status_code == 400
        # Status is untouched and no commit happened.
        assert task.Status == "todo"
    finally:
        app.dependency_overrides.clear()
