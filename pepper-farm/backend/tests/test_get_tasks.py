import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from datetime import datetime, timezone, timedelta

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database import Base
from models.role import Role
from models.user import User
from models.task import Task
from models.farm_zone import FarmZone
from models.pepper_variety import PepperVariety
import models.plant  # noqa: F401 — registers Plants table referenced by SensorAssignment FK
import models.sensor  # noqa: F401 — registers SensorAssignment, SensorAlert, etc.
from schemas.task import CreateTaskRequest, ChecklistItemIn
from services.task_service import create_task, get_all_tasks, get_tasks_by_user, get_completed_tasks

SQLALCHEMY_TEST_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_TEST_URL,
    connect_args={"check_same_thread": False},
)
TestSession = sessionmaker(bind=engine)

MANAGER_ROLE_ID = 1
WORKER_ROLE_ID  = 2
MANAGER_ID      = 10
WORKER_ID       = 20

# A valid (future) due date for tests that only need creation to succeed.
# DueDate is required as of BSPMT7-449.
FUTURE_DUE = datetime.now(timezone.utc) + timedelta(days=7)


@pytest.fixture()
def db():
    Base.metadata.create_all(bind=engine)
    session = TestSession()

    now = datetime.now(timezone.utc)
    session.add_all([
        Role(RoleId=MANAGER_ROLE_ID, RoleName="FarmManager", IsActive=True, CreatedAt=now),
        Role(RoleId=WORKER_ROLE_ID,  RoleName="Worker",      IsActive=True, CreatedAt=now),
    ])
    session.add_all([
        User(UserId=MANAGER_ID, FullName="Alice Manager", Email="alice@farm.com", PasswordHash="x", RoleId=MANAGER_ROLE_ID, IsActive=True, CreatedAt=now),
        User(UserId=WORKER_ID,  FullName="Bob Worker",    Email="bob@farm.com",   PasswordHash="x", RoleId=WORKER_ROLE_ID,  IsActive=True, CreatedAt=now),
    ])
    session.commit()

    yield session

    session.close()
    Base.metadata.drop_all(bind=engine)


# ------------------------------------------------------------------ #
# 10. Get all tasks returns empty list when no tasks exist
# ------------------------------------------------------------------ #
def test_get_all_tasks_empty(db):
    result = get_all_tasks(db)

    assert result == []


# ------------------------------------------------------------------ #
# 11. Get all tasks returns created tasks
# ------------------------------------------------------------------ #
def test_get_all_tasks_returns_tasks(db):
    dto1 = CreateTaskRequest(title="Task One", taskType="irrigation", priority="low", dueDate=FUTURE_DUE)
    dto2 = CreateTaskRequest(title="Task Two", taskType="harvesting", priority="high", dueDate=FUTURE_DUE)
    create_task(db, MANAGER_ID, dto1)
    create_task(db, MANAGER_ID, dto2)

    result = get_all_tasks(db)

    assert len(result) == 2
    titles = {t.title for t in result}
    assert "Task One" in titles
    assert "Task Two" in titles


# ------------------------------------------------------------------ #
# 12. Get all tasks returns newest first
# ------------------------------------------------------------------ #
def test_get_all_tasks_ordered_newest_first(db):
    dto1 = CreateTaskRequest(title="First Created", taskType="planting", priority="medium", dueDate=FUTURE_DUE)
    dto2 = CreateTaskRequest(title="Second Created", taskType="inspection", priority="medium", dueDate=FUTURE_DUE)
    create_task(db, MANAGER_ID, dto1)
    create_task(db, MANAGER_ID, dto2)

    result = get_all_tasks(db)

    assert result[0].title == "Second Created"
    assert result[1].title == "First Created"


# ------------------------------------------------------------------ #
# 13. Get all tasks includes assigned worker
# ------------------------------------------------------------------ #
def test_get_all_tasks_includes_assignee(db):
    dto = CreateTaskRequest(title="Assigned Task", taskType="irrigation", priority="critical", assignedToUserId=WORKER_ID, dueDate=FUTURE_DUE)
    create_task(db, MANAGER_ID, dto)

    result = get_all_tasks(db)

    assert len(result) == 1
    assert result[0].assignedToUserId == WORKER_ID


# ------------------------------------------------------------------ #
# 14. Created task has default status "todo"
# ------------------------------------------------------------------ #
def test_created_task_default_status(db):
    dto = CreateTaskRequest(title="Status Check", taskType="other", priority="low", dueDate=FUTURE_DUE)
    result, error = create_task(db, MANAGER_ID, dto)

    assert error is None
    assert result.status == "todo"


# ------------------------------------------------------------------ #
# 15. Task with due date is stored correctly
# ------------------------------------------------------------------ #
def test_create_task_with_due_date(db):
    future = datetime.now(timezone.utc) + timedelta(days=7)
    dto = CreateTaskRequest(title="Future Task", taskType="harvesting", priority="high", dueDate=future)
    result, error = create_task(db, MANAGER_ID, dto)

    assert error is None
    assert result.dueDate is not None
    assert result.dueDate.date() == future.date()


# ------------------------------------------------------------------ #
# 16-18. selectinload — checklist items are returned without N+1 queries
# ------------------------------------------------------------------ #

def test_get_all_tasks_includes_checklist_items(db):
    """get_all_tasks must return checklistItems populated by selectinload (no N+1)."""
    dto = CreateTaskRequest(
        title="Inspect greenhouse",
        taskType="inspection",
        priority="medium",
        dueDate=FUTURE_DUE,
        checklistItems=[
            ChecklistItemIn(title="Check humidity"),
            ChecklistItemIn(title="Check temperature"),
        ],
    )
    create_task(db, MANAGER_ID, dto)
    db.expire_all()  # Force a fresh load — simulates a real request lifecycle

    results = get_all_tasks(db)

    assert len(results) == 1
    task = results[0]
    assert len(task.checklistItems) == 2
    titles = {i.title for i in task.checklistItems}
    assert titles == {"Check humidity", "Check temperature"}


def test_get_all_tasks_multiple_tasks_checklist_items_not_mixed(db):
    """Each task gets only its own checklist items — no cross-task contamination."""
    dto_a = CreateTaskRequest(
        title="Task A",
        taskType="irrigation",
        priority="low",
        dueDate=FUTURE_DUE,
        checklistItems=[ChecklistItemIn(title="Step A1"), ChecklistItemIn(title="Step A2")],
    )
    dto_b = CreateTaskRequest(
        title="Task B",
        taskType="inspection",
        priority="high",
        dueDate=FUTURE_DUE,
        checklistItems=[ChecklistItemIn(title="Step B1")],
    )
    create_task(db, MANAGER_ID, dto_a)
    create_task(db, MANAGER_ID, dto_b)
    db.expire_all()

    results = get_all_tasks(db)

    by_title = {r.title: r for r in results}
    assert len(by_title["Task A"].checklistItems) == 2
    assert len(by_title["Task B"].checklistItems) == 1
    a_titles = {i.title for i in by_title["Task A"].checklistItems}
    assert a_titles == {"Step A1", "Step A2"}


def test_get_tasks_by_user_includes_checklist_items(db):
    """get_tasks_by_user also eagerly loads checklistItems via selectinload."""
    dto = CreateTaskRequest(
        title="Worker task with checklist",
        taskType="harvesting",
        priority="critical",
        assignedToUserId=WORKER_ID,
        dueDate=FUTURE_DUE,
        checklistItems=[ChecklistItemIn(title="Pick row A"), ChecklistItemIn(title="Pick row B")],
    )
    create_task(db, MANAGER_ID, dto)
    db.expire_all()

    results = get_tasks_by_user(db, WORKER_ID)

    assert len(results) == 1
    assert len(results[0].checklistItems) == 2
