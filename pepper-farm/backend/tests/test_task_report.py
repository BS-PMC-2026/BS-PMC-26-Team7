import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from datetime import datetime, timezone
from fastapi.testclient import TestClient
from unittest.mock import MagicMock
from main import app
from database import get_db
from utils.jwt import get_current_user

client = TestClient(app)


def make_manager():
    return {"user_id": 1, "role": "FarmManager"}


def make_mock_task(task_id=1, status="todo", assigned_to=3):
    zone = MagicMock()
    zone.ZoneCode = "GH-01"

    now = datetime.now(timezone.utc)

    task = MagicMock()
    task.Id = task_id
    task.Title = f"Task {task_id}"
    task.Description = "Test description"
    task.Status = status
    task.Priority = "medium"
    task.TaskType = "irrigation"
    task.CreatedByUserId = 1
    task.AssignedToUserId = assigned_to
    task.DueDate = None
    task.StartedAt = None
    task.CompletedAt = None
    task.PepperId = None
    task.ZoneId = 1
    task.AnomalyId = None
    task.alert = None
    task.zone = zone
    task.CreatedAt = now
    task.UpdatedAt = now
    return task


# BSPMT7-196: Unit tests for report logic


def test_report_returns_only_open_tasks():
    mock_db = MagicMock()
    mock_tasks = [
        make_mock_task(1, "todo"),
        make_mock_task(2, "in_progress"),
    ]
    mock_db.query.return_value.filter.return_value.order_by.return_value.all.return_value = mock_tasks

    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_current_user] = lambda: make_manager()

    res = client.get("/api/tasks/report")
    app.dependency_overrides.clear()

    assert res.status_code == 200
    assert len(res.json()) == 2


def test_report_excludes_done_tasks():
    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.order_by.return_value.all.return_value = []

    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_current_user] = lambda: make_manager()

    res = client.get("/api/tasks/report")
    app.dependency_overrides.clear()

    assert res.status_code == 200
    assert res.json() == []


def test_report_unauthorized_returns_403():
    app.dependency_overrides[get_current_user] = lambda: {"user_id": 3, "role": "Worker"}

    res = client.get("/api/tasks/report")
    app.dependency_overrides.clear()

    assert res.status_code == 403


def test_report_no_token_returns_401():
    res = client.get("/api/tasks/report")
    assert res.status_code == 401


def test_report_by_worker_returns_200():
    mock_db = MagicMock()
    mock_tasks = [make_mock_task(1, "todo", assigned_to=3)]
    mock_db.query.return_value.filter.return_value.order_by.return_value.all.return_value = mock_tasks

    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_current_user] = lambda: make_manager()

    res = client.get("/api/tasks/report?worker_id=3")
    app.dependency_overrides.clear()

    assert res.status_code == 200
    assert len(res.json()) == 1


def test_report_by_worker_empty():
    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.order_by.return_value.all.return_value = []

    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_current_user] = lambda: make_manager()

    res = client.get("/api/tasks/report?worker_id=999")
    app.dependency_overrides.clear()

    assert res.status_code == 200
    assert res.json() == []


# BSPMT7-197: Additional unit tests


def test_report_returns_list():
    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.order_by.return_value.all.return_value = []

    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_current_user] = lambda: make_manager()

    res = client.get("/api/tasks/report")
    app.dependency_overrides.clear()

    assert res.status_code == 200
    assert isinstance(res.json(), list)


def test_report_task_has_correct_fields():
    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.order_by.return_value.all.return_value = [
        make_mock_task(1, "todo")
    ]

    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_current_user] = lambda: make_manager()

    res = client.get("/api/tasks/report")
    app.dependency_overrides.clear()

    assert res.status_code == 200
    task = res.json()[0]
    assert "id" in task
    assert "title" in task
    assert "status" in task
    assert "priority" in task


def test_report_worker_unauthorized():
    app.dependency_overrides[get_current_user] = lambda: {"user_id": 4, "role": "Visitor"}

    res = client.get("/api/tasks/report?worker_id=3")
    app.dependency_overrides.clear()

    assert res.status_code == 403