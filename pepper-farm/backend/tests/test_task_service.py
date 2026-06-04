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
import models.plant   # noqa: F401 — registers Plants table referenced by SensorAssignment FK
import models.sensor  # noqa: F401 — registers SensorAssignment, SensorAlert, etc.
from schemas.task import ChecklistItemIn, CreateTaskRequest, UpdateChecklistItemRequest
from services.task_service import (
    add_checklist_item,
    create_task,
    delete_checklist_item,
    update_checklist_item,
)

# ------------------------------------------------------------------ #
# Setup: SQLite in-memory DB (no SQL Server needed)
# ------------------------------------------------------------------ #

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
ANOTHER_MANAGER_ID = 30

# A valid (future) due date used by tests that just need creation to succeed.
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
        User(UserId=MANAGER_ID,        FullName="Alice Manager", Email="alice@farm.com", PasswordHash="x", RoleId=MANAGER_ROLE_ID, IsActive=True, CreatedAt=now),
        User(UserId=WORKER_ID,          FullName="Bob Worker",    Email="bob@farm.com",   PasswordHash="x", RoleId=WORKER_ROLE_ID,  IsActive=True, CreatedAt=now),
        User(UserId=ANOTHER_MANAGER_ID, FullName="Carol Manager", Email="carol@farm.com", PasswordHash="x", RoleId=MANAGER_ROLE_ID, IsActive=True, CreatedAt=now),
    ])
    session.commit()

    yield session

    session.close()
    Base.metadata.drop_all(bind=engine)


# ------------------------------------------------------------------ #
# 1. Valid task creation (unassigned)
# ------------------------------------------------------------------ #
def test_create_task_valid(db):
    dto = CreateTaskRequest(title="Water zone A", taskType="irrigation", priority="medium", dueDate=FUTURE_DUE)
    result, error = create_task(db, MANAGER_ID, dto)

    assert error is None
    assert result is not None
    assert result.title == "Water zone A"
    assert result.status == "todo"
    assert result.createdByUserId == MANAGER_ID
    assert result.assignedToUserId is None


# ------------------------------------------------------------------ #
# 2. Caller does not exist
# ------------------------------------------------------------------ #
def test_create_task_caller_not_found(db):
    dto = CreateTaskRequest(title="Task", taskType="other", priority="low")
    result, error = create_task(db, 9999, dto)

    assert result is None
    assert error == "Caller user does not exist."


# ------------------------------------------------------------------ #
# 3. Caller is not a FarmManager
# ------------------------------------------------------------------ #
def test_create_task_caller_not_manager(db):
    dto = CreateTaskRequest(title="Task", taskType="other", priority="low")
    result, error = create_task(db, WORKER_ID, dto)

    assert result is None
    assert error == "Only FarmManagers can create tasks."


# ------------------------------------------------------------------ #
# 4. Invalid priority
# ------------------------------------------------------------------ #
def test_create_task_invalid_priority(db):
    dto = CreateTaskRequest(title="Task", taskType="inspection", priority="urgent")
    result, error = create_task(db, MANAGER_ID, dto)

    assert result is None
    assert "Invalid priority" in error


# ------------------------------------------------------------------ #
# 5. Due date in the past
# ------------------------------------------------------------------ #
def test_create_task_due_date_in_past(db):
    yesterday = datetime.now(timezone.utc) - timedelta(days=1)
    dto = CreateTaskRequest(title="Old task", taskType="inspection", priority="low", dueDate=yesterday)
    result, error = create_task(db, MANAGER_ID, dto)

    assert result is None
    assert error == "DueDate cannot be in the past."


# ------------------------------------------------------------------ #
# 6. Due date today — should succeed
# ------------------------------------------------------------------ #
def test_create_task_due_date_today(db):
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    dto = CreateTaskRequest(title="Today task", taskType="planting", priority="high", dueDate=today)
    result, error = create_task(db, MANAGER_ID, dto)

    assert error is None
    assert result is not None


# ------------------------------------------------------------------ #
# 6b. Due date is required (BSPMT7-449)
# ------------------------------------------------------------------ #
def test_create_task_missing_due_date_returns_error(db):
    dto = CreateTaskRequest(title="No deadline", taskType="inspection", priority="low")
    result, error = create_task(db, MANAGER_ID, dto)

    assert result is None
    assert error == "DueDate is required."


# ------------------------------------------------------------------ #
# 6c. Time component of the due date is preserved (BSPMT7-449)
# ------------------------------------------------------------------ #
def test_create_task_preserves_due_date_time(db):
    due = (datetime.now(timezone.utc) + timedelta(days=3)).replace(
        hour=14, minute=30, second=0, microsecond=0
    )
    dto = CreateTaskRequest(title="Timed task", taskType="irrigation", priority="medium", dueDate=due)
    result, error = create_task(db, MANAGER_ID, dto)

    assert error is None
    assert result is not None
    assert result.dueDate.hour == 14
    assert result.dueDate.minute == 30


# ------------------------------------------------------------------ #
# 7. Assigned user does not exist
# ------------------------------------------------------------------ #
def test_create_task_assignee_not_found(db):
    dto = CreateTaskRequest(title="Task", taskType="harvesting", priority="high", assignedToUserId=9999, dueDate=FUTURE_DUE)
    result, error = create_task(db, MANAGER_ID, dto)

    assert result is None
    assert error == "Assigned user does not exist."


# ------------------------------------------------------------------ #
# 8. Assigned user is not a Worker
# ------------------------------------------------------------------ #
def test_create_task_assignee_not_worker(db):
    dto = CreateTaskRequest(title="Task", taskType="inspection", priority="medium", assignedToUserId=ANOTHER_MANAGER_ID, dueDate=FUTURE_DUE)
    result, error = create_task(db, MANAGER_ID, dto)

    assert result is None
    assert error == "Tasks can only be assigned to Workers."


# ------------------------------------------------------------------ #
# 9. Valid assignment to a Worker
# ------------------------------------------------------------------ #
def test_create_task_valid_worker_assignment(db):
    dto = CreateTaskRequest(title="Water zone B", taskType="irrigation", priority="critical", assignedToUserId=WORKER_ID, dueDate=FUTURE_DUE)
    result, error = create_task(db, MANAGER_ID, dto)

    assert error is None
    assert result is not None
    assert result.assignedToUserId == WORKER_ID


# ------------------------------------------------------------------ #
# US39 — Checklist items
# ------------------------------------------------------------------ #
def test_create_task_without_checklist_returns_empty_list(db):
    """A task created without checklistItems exposes an empty list (no crash)."""
    dto = CreateTaskRequest(title="No checklist", taskType="inspection", priority="low", dueDate=FUTURE_DUE)
    result, error = create_task(db, MANAGER_ID, dto)

    assert error is None
    assert result.checklistItems == []


def test_create_task_with_checklist_persists_items_in_order(db):
    """checklistItems on CreateTaskRequest are persisted with sequential Position."""
    dto = CreateTaskRequest(
        title="Inspect greenhouse",
        taskType="inspection",
        priority="medium",
        dueDate=FUTURE_DUE,
        checklistItems=[
            ChecklistItemIn(title="Check humidity"),
            ChecklistItemIn(title="Check temperature"),
            ChecklistItemIn(title="Log results"),
        ],
    )
    result, error = create_task(db, MANAGER_ID, dto)

    assert error is None
    assert len(result.checklistItems) == 3
    assert [i.title for i in result.checklistItems] == [
        "Check humidity", "Check temperature", "Log results"
    ]
    assert [i.position for i in result.checklistItems] == [0, 1, 2]
    assert all(i.isCompleted is False for i in result.checklistItems)


def test_add_checklist_item_appends_after_existing(db):
    """add_checklist_item assigns a Position greater than any existing item."""
    dto = CreateTaskRequest(
        title="Harvest",
        taskType="harvesting",
        priority="high",
        dueDate=FUTURE_DUE,
        checklistItems=[ChecklistItemIn(title="Pick row A")],
    )
    created, _ = create_task(db, MANAGER_ID, dto)

    added, error = add_checklist_item(db, created.id, ChecklistItemIn(title="Pick row B"))
    assert error is None
    assert added.title == "Pick row B"
    assert added.position == 1
    assert added.isCompleted is False


def test_add_checklist_item_task_not_found(db):
    """add_checklist_item returns a clear error when the task is missing."""
    added, error = add_checklist_item(db, 9999, ChecklistItemIn(title="x"))
    assert added is None
    assert error == "Task not found."


def test_update_checklist_item_toggles_completion(db):
    """update_checklist_item flips IsCompleted without touching other items."""
    dto = CreateTaskRequest(
        title="Two-step",
        taskType="inspection",
        priority="medium",
        dueDate=FUTURE_DUE,
        checklistItems=[
            ChecklistItemIn(title="Step 1"),
            ChecklistItemIn(title="Step 2"),
        ],
    )
    created, _ = create_task(db, MANAGER_ID, dto)
    first_item = created.checklistItems[0]

    toggled, error = update_checklist_item(
        db, created.id, first_item.itemId, UpdateChecklistItemRequest(isCompleted=True)
    )
    assert error is None
    assert toggled.itemId == first_item.itemId
    assert toggled.isCompleted is True
    # The other item is untouched
    assert created.checklistItems[1].isCompleted is False


def test_update_checklist_item_not_found(db):
    """update_checklist_item returns an error when the item id does not match."""
    dto = CreateTaskRequest(title="t", taskType="other", priority="low", dueDate=FUTURE_DUE)
    created, _ = create_task(db, MANAGER_ID, dto)

    result, error = update_checklist_item(
        db, created.id, 9999, UpdateChecklistItemRequest(isCompleted=True)
    )
    assert result is None
    assert error == "Checklist item not found."


def test_delete_checklist_item_removes_row(db):
    """delete_checklist_item drops the row; subsequent toggle reports not-found."""
    dto = CreateTaskRequest(
        title="Removable",
        taskType="other",
        priority="low",
        dueDate=FUTURE_DUE,
        checklistItems=[ChecklistItemIn(title="Doomed")],
    )
    created, _ = create_task(db, MANAGER_ID, dto)
    item_id = created.checklistItems[0].itemId

    ok, error = delete_checklist_item(db, created.id, item_id)
    assert ok is True
    assert error is None

    # Toggling the deleted item now returns the not-found error.
    _, post_error = update_checklist_item(
        db, created.id, item_id, UpdateChecklistItemRequest(isCompleted=True)
    )
    assert post_error == "Checklist item not found."


def test_update_checklist_item_updates_title(db):
    """update_checklist_item replaces the title without touching isCompleted."""
    dto = CreateTaskRequest(
        title="Rename step",
        taskType="inspection",
        priority="medium",
        dueDate=FUTURE_DUE,
        checklistItems=[ChecklistItemIn(title="Old title")],
    )
    created, _ = create_task(db, MANAGER_ID, dto)
    item_id = created.checklistItems[0].itemId

    updated, error = update_checklist_item(
        db, created.id, item_id, UpdateChecklistItemRequest(title="New title")
    )
    assert error is None
    assert updated.title == "New title"
    assert updated.isCompleted is False  # unchanged


def test_update_checklist_item_empty_title_returns_error(db):
    """update_checklist_item rejects a blank title update."""
    dto = CreateTaskRequest(
        title="t",
        taskType="other",
        priority="low",
        dueDate=FUTURE_DUE,
        checklistItems=[ChecklistItemIn(title="Original")],
    )
    created, _ = create_task(db, MANAGER_ID, dto)
    item_id = created.checklistItems[0].itemId

    result, error = update_checklist_item(
        db, created.id, item_id, UpdateChecklistItemRequest(title="   ")
    )
    assert result is None
    assert error is not None
    assert "empty" in error.lower() or "cannot" in error.lower()


def test_create_task_checklist_items_have_correct_positions(db):
    """Each checklist item gets a sequential Position starting from 0."""
    dto = CreateTaskRequest(
        title="Ordered task",
        taskType="inspection",
        priority="medium",
        dueDate=FUTURE_DUE,
        checklistItems=[
            ChecklistItemIn(title="First"),
            ChecklistItemIn(title="Second"),
            ChecklistItemIn(title="Third"),
        ],
    )
    created, _ = create_task(db, MANAGER_ID, dto)

    positions = [i.position for i in created.checklistItems]
    assert positions == [0, 1, 2]


def test_checklist_items_belong_to_correct_task(db):
    """Checklist items created for one task are not returned for another."""
    dto_a = CreateTaskRequest(
        title="Task A",
        taskType="inspection",
        priority="low",
        dueDate=FUTURE_DUE,
        checklistItems=[ChecklistItemIn(title="Item A")],
    )
    dto_b = CreateTaskRequest(
        title="Task B",
        taskType="inspection",
        priority="low",
        dueDate=FUTURE_DUE,
        checklistItems=[ChecklistItemIn(title="Item B")],
    )
    task_a, _ = create_task(db, MANAGER_ID, dto_a)
    task_b, _ = create_task(db, MANAGER_ID, dto_b)

    assert len(task_a.checklistItems) == 1
    assert task_a.checklistItems[0].title == "Item A"
    assert len(task_b.checklistItems) == 1
    assert task_b.checklistItems[0].title == "Item B"
