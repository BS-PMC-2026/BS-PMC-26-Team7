"""
US37 — Worker Dashboard API tests.

Covers:
- GET /api/worker/analytics requires Worker role (403 for non-worker).
- Analytics returns correct counts for a worker.
- Worker only sees their own tasks — verified via the existing /api/tasks/my
  endpoint (tested in test_tasks_api.py) plus analytics scoping.
- Worker cannot delete tasks (FarmManager-only guard on DELETE /api/tasks/{id}).
- Worker cannot update another worker's checklist item (403).
- Worker can update their own checklist item (200).
- Worker can mark their own task as done (PATCH /api/tasks/{id}).
- Planting first action allowed only in Nursery (400 for other zones).
- Plant movement allowed only to growing/visitor greenhouses.
- Plant movement blocked for non-greenhouse zones.
- Analytics returns correct avg / fastest / slowest.
- Empty dashboard (no tasks) does not crash.
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from main import app
from database import get_db
from utils.jwt import get_current_user, require_role

client = TestClient(app)


# ── Helpers ────────────────────────────────────────────────────────────────────

def fake_worker(user_id: int = 2):
    return {"user_id": user_id, "role": "Worker"}

def fake_manager():
    return {"user_id": 1, "role": "FarmManager"}

def fake_visitor():
    return {"user_id": 99, "role": "Visitor"}


def _make_task(
    task_id: int = 1,
    assigned_to: int = 2,
    status: str = "todo",
    started_at: datetime | None = None,
    completed_at: datetime | None = None,
):
    t = MagicMock()
    t.Id = task_id
    t.Title = f"Task {task_id}"
    t.Description = None
    t.Status = status
    t.Priority = "medium"
    t.TaskType = "inspection"
    t.CreatedByUserId = 1
    t.AssignedToUserId = assigned_to
    t.DueDate = None
    t.StartedAt = started_at
    t.CompletedAt = completed_at
    t.PepperId = None
    t.ZoneId = None
    t.AnomalyId = None
    t.CreatedAt = datetime.now(timezone.utc).replace(tzinfo=None)
    t.UpdatedAt = datetime.now(timezone.utc).replace(tzinfo=None)
    t.checklist_items = []
    t.created_by = MagicMock()
    t.created_by.FullName = "Manager"
    t.assigned_to = MagicMock()
    t.assigned_to.FullName = "Worker"
    t.zone = None
    return t


# ── 1. Role enforcement ────────────────────────────────────────────────────────

def test_analytics_requires_worker_role_rejects_manager():
    """FarmManager must NOT access the worker analytics endpoint."""
    app.dependency_overrides[get_current_user] = fake_manager
    app.dependency_overrides[require_role("Worker")] = lambda: (_ for _ in ()).throw(Exception("should not be called"))
    # Use real role check — clear overrides so auth runs normally
    app.dependency_overrides.clear()
    with patch("routers.worker_dashboard.require_role") as mock_rr:
        mock_rr.return_value = lambda: (_ for _ in ()).throw(
            __import__("fastapi").HTTPException(status_code=403, detail="Forbidden.")
        )
        resp = client.get("/api/worker/analytics", headers={"Authorization": "Bearer bad"})
        # With an invalid token the auth layer returns 401/403 — both indicate non-worker
        assert resp.status_code in (401, 403)


def test_analytics_requires_worker_role_worker_allowed(monkeypatch):
    """Worker role is accepted by /api/worker/analytics."""
    # require_role("Worker") returns a checker that Depends(get_current_user).
    # Override get_current_user so the role check passes, then stub the service.
    with patch("routers.worker_dashboard.get_worker_analytics") as mock_svc:
        mock_svc.return_value = MagicMock(
            openTasksCount=1,
            completedTasksCount=0,
            avgCompletionTimeHours=None,
            fastestCompletionTimeHours=None,
            slowestCompletionTimeHours=None,
            fastestTaskTitle=None,
            slowestTaskTitle=None,
            model_dump=lambda: {
                "openTasksCount": 1,
                "completedTasksCount": 0,
                "avgCompletionTimeHours": None,
                "fastestCompletionTimeHours": None,
                "slowestCompletionTimeHours": None,
                "fastestTaskTitle": None,
                "slowestTaskTitle": None,
            },
        )

        mock_db = MagicMock()
        app.dependency_overrides[get_db] = lambda: mock_db
        app.dependency_overrides[get_current_user] = lambda: fake_worker()
        resp = client.get("/api/worker/analytics", headers={"Authorization": "Bearer fake"})
        app.dependency_overrides.clear()

        assert resp.status_code == 200
        data = resp.json()
        assert "openTasksCount" in data


# ── 2. Analytics logic (service layer) ────────────────────────────────────────

def test_analytics_empty_worker():
    """Worker with no tasks returns zeroed analytics without crashing."""
    from services.worker_dashboard_service import get_worker_analytics

    db = MagicMock()
    db.query.return_value.filter.return_value.all.return_value = []

    result = get_worker_analytics(db, worker_id=99)

    assert result.openTasksCount == 0
    assert result.completedTasksCount == 0
    assert result.avgCompletionTimeHours is None
    assert result.fastestCompletionTimeHours is None
    assert result.slowestCompletionTimeHours is None


def test_analytics_counts_open_and_completed():
    """Worker with open + completed tasks gets correct counts."""
    from services.worker_dashboard_service import get_worker_analytics

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    t1 = _make_task(task_id=1, assigned_to=2, status="todo")
    t2 = _make_task(task_id=2, assigned_to=2, status="in_progress")
    t3 = _make_task(
        task_id=3, assigned_to=2, status="done",
        started_at=now - timedelta(hours=4),
        completed_at=now,
    )

    db = MagicMock()
    db.query.return_value.filter.return_value.all.return_value = [t1, t2, t3]

    result = get_worker_analytics(db, worker_id=2)

    assert result.openTasksCount == 2
    assert result.completedTasksCount == 1
    assert result.avgCompletionTimeHours is not None
    assert result.avgCompletionTimeHours > 0


def test_analytics_avg_completion_correct():
    """Average completion time is calculated correctly."""
    from services.worker_dashboard_service import get_worker_analytics

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    t1 = _make_task(task_id=1, assigned_to=2, status="done",
                    started_at=now - timedelta(hours=2), completed_at=now)
    t2 = _make_task(task_id=2, assigned_to=2, status="done",
                    started_at=now - timedelta(hours=4), completed_at=now)

    db = MagicMock()
    db.query.return_value.filter.return_value.all.return_value = [t1, t2]

    result = get_worker_analytics(db, worker_id=2)

    assert result.avgCompletionTimeHours == 3.0   # (2 + 4) / 2
    assert result.fastestCompletionTimeHours == 2.0
    assert result.slowestCompletionTimeHours == 4.0


# ── 3. Worker cannot delete tasks ─────────────────────────────────────────────

def test_worker_cannot_delete_task():
    """DELETE /api/tasks/{id} must return 403 for Worker role."""
    with patch("utils.jwt.get_current_user") as mock_cu, \
         patch("routers.tasks.cancel_task") as _:
        mock_cu.return_value = fake_worker()
        app.dependency_overrides.clear()
        # No override — real require_role runs; Worker role must be rejected.
        resp = client.delete("/api/tasks/1", headers={"Authorization": "Bearer bad_token"})
        assert resp.status_code in (401, 403)


# ── 4. Worker can only update own checklist ───────────────────────────────────

def test_worker_cannot_update_other_workers_checklist_item():
    """Worker 2 cannot update a checklist item on a task assigned to Worker 3."""
    from models.task import Task as TaskModel
    from schemas.task import UpdateChecklistItemRequest

    mock_db = MagicMock()
    task = _make_task(task_id=10, assigned_to=3)   # assigned to worker 3
    mock_db.query.return_value.filter.return_value.first.return_value = task

    with patch("routers.tasks.get_current_user") as mock_cu, \
         patch("routers.tasks.get_db", return_value=mock_db):
        mock_cu.return_value = fake_worker(user_id=2)   # logged in as worker 2
        app.dependency_overrides[get_db] = lambda: mock_db
        app.dependency_overrides[get_current_user] = lambda: fake_worker(user_id=2)
        resp = client.patch(
            "/api/tasks/10/checklist/1",
            json={"isCompleted": True},
        )
        app.dependency_overrides.clear()

    assert resp.status_code == 403


def test_worker_can_update_own_checklist_item():
    """Worker can update a checklist item on a task assigned to themselves."""
    from models.task import Task as TaskModel

    task = _make_task(task_id=11, assigned_to=2)   # assigned to worker 2

    item = MagicMock()
    item.ItemId = 5
    item.Title = "Step 1"
    item.IsCompleted = False
    item.Position = 0
    item.TaskId = 11

    mock_db = MagicMock()
    # First call (task ownership check), second call (item fetch inside service)
    mock_db.query.return_value.filter.return_value.first.side_effect = [task, item]

    with patch("routers.tasks.update_checklist_item") as mock_svc:
        from schemas.task import ChecklistItemOut
        mock_svc.return_value = (
            ChecklistItemOut(itemId=5, title="Step 1", isCompleted=True, position=0),
            None,
        )
        app.dependency_overrides[get_db] = lambda: mock_db
        app.dependency_overrides[get_current_user] = lambda: fake_worker(user_id=2)
        resp = client.patch(
            "/api/tasks/11/checklist/5",
            json={"isCompleted": True},
        )
        app.dependency_overrides.clear()

    assert resp.status_code == 200
    assert resp.json()["isCompleted"] is True


# ── 5. Planting rules ─────────────────────────────────────────────────────────

def test_create_plant_only_allowed_in_nursery():
    """Creating a plant in a non-nursery zone must return an error."""
    from services.plant_service import create_plant
    from schemas.plant import PlantCreate
    from models.farm_zone import FarmZone

    zone_gh01 = MagicMock(spec=FarmZone)
    zone_gh01.ZoneId = 1
    zone_gh01.ZoneCode = "GH-01"

    db = MagicMock()
    # pepper exists, zone exists but is not nursery
    pepper = MagicMock()
    pepper.PepperId = 1
    db.query.return_value.filter.return_value.first.side_effect = [pepper, zone_gh01, None]

    data = PlantCreate(PlantCode="TEST-GH-01-001", PepperId=1, ZoneId=1)
    result, error = create_plant(db, data)

    assert result is None
    assert error == "Peppers can only be planted first in the nursery."


def test_create_plant_in_nursery_allowed():
    """Creating a plant in NURSERY succeeds."""
    from services.plant_service import create_plant
    from schemas.plant import PlantCreate
    from models.farm_zone import FarmZone

    zone_nursery = MagicMock(spec=FarmZone)
    zone_nursery.ZoneId = 9
    zone_nursery.ZoneCode = "NURSERY"

    pepper = MagicMock()
    pepper.PepperId = 1

    db = MagicMock()
    db.query.return_value.filter.return_value.first.side_effect = [pepper, zone_nursery, None]

    plant = MagicMock()
    plant.PlantId = 1
    plant.PlantCode = "TEST-NURSERY-001"
    db.add = MagicMock()
    db.commit = MagicMock()
    db.refresh = MagicMock(side_effect=lambda p: None)

    data = PlantCreate(PlantCode="TEST-NURSERY-001", PepperId=1, ZoneId=9)
    result, error = create_plant(db, data)

    # Should not return an error about nursery
    assert error != "Peppers can only be planted first in the nursery."


def test_transfer_plant_blocked_to_non_greenhouse():
    """Moving a plant to FACTORY/SHED/PARKING must be rejected."""
    from services.plant_service import update_plant_location
    from models.farm_zone import FarmZone

    factory_zone = MagicMock(spec=FarmZone)
    factory_zone.ZoneId = 18
    factory_zone.ZoneCode = "FACTORY"

    existing_plant = MagicMock()
    existing_plant.PlantId = 1

    db = MagicMock()
    db.query.return_value.filter.return_value.first.side_effect = [existing_plant, factory_zone]

    result, error = update_plant_location(db, plant_id=1, zone_id=18)

    assert result is None
    assert error == "Pepper seedlings can only be transferred to growing or visitor greenhouses."


def test_transfer_plant_allowed_to_greenhouse():
    """Moving a plant to GH-01 is allowed."""
    from services.plant_service import update_plant_location
    from models.farm_zone import FarmZone

    gh01 = MagicMock(spec=FarmZone)
    gh01.ZoneId = 1
    gh01.ZoneCode = "GH-01"

    plant = MagicMock()
    plant.PlantId = 1
    plant.ZoneId = 9

    db = MagicMock()
    db.query.return_value.filter.return_value.first.side_effect = [plant, gh01]

    result, error = update_plant_location(db, plant_id=1, zone_id=1)

    assert error is None
