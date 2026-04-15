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
from schemas.task import CreateTaskRequest
from services.task_service import create_task

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
    dto = CreateTaskRequest(title="Water zone A", taskType="irrigation", priority="medium")
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
# 7. Assigned user does not exist
# ------------------------------------------------------------------ #
def test_create_task_assignee_not_found(db):
    dto = CreateTaskRequest(title="Task", taskType="harvesting", priority="high", assignedToUserId=9999)
    result, error = create_task(db, MANAGER_ID, dto)

    assert result is None
    assert error == "Assigned user does not exist."


# ------------------------------------------------------------------ #
# 8. Assigned user is not a Worker
# ------------------------------------------------------------------ #
def test_create_task_assignee_not_worker(db):
    dto = CreateTaskRequest(title="Task", taskType="inspection", priority="medium", assignedToUserId=ANOTHER_MANAGER_ID)
    result, error = create_task(db, MANAGER_ID, dto)

    assert result is None
    assert error == "Tasks can only be assigned to Workers."


# ------------------------------------------------------------------ #
# 9. Valid assignment to a Worker
# ------------------------------------------------------------------ #
def test_create_task_valid_worker_assignment(db):
    dto = CreateTaskRequest(title="Water zone B", taskType="irrigation", priority="critical", assignedToUserId=WORKER_ID)
    result, error = create_task(db, MANAGER_ID, dto)

    assert error is None
    assert result is not None
    assert result.assignedToUserId == WORKER_ID
