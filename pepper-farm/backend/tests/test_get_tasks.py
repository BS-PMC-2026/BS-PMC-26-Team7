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
from services.task_service import create_task, get_all_tasks

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
    dto1 = CreateTaskRequest(title="Task One", taskType="irrigation", priority="low")
    dto2 = CreateTaskRequest(title="Task Two", taskType="harvesting", priority="high")
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
    dto1 = CreateTaskRequest(title="First Created", taskType="planting", priority="medium")
    dto2 = CreateTaskRequest(title="Second Created", taskType="inspection", priority="medium")
    create_task(db, MANAGER_ID, dto1)
    create_task(db, MANAGER_ID, dto2)

    result = get_all_tasks(db)

    assert result[0].title == "Second Created"
    assert result[1].title == "First Created"


# ------------------------------------------------------------------ #
# 13. Get all tasks includes assigned worker
# ------------------------------------------------------------------ #
def test_get_all_tasks_includes_assignee(db):
    dto = CreateTaskRequest(title="Assigned Task", taskType="irrigation", priority="critical", assignedToUserId=WORKER_ID)
    create_task(db, MANAGER_ID, dto)

    result = get_all_tasks(db)

    assert len(result) == 1
    assert result[0].assignedToUserId == WORKER_ID


# ------------------------------------------------------------------ #
# 14. Created task has default status "todo"
# ------------------------------------------------------------------ #
def test_created_task_default_status(db):
    dto = CreateTaskRequest(title="Status Check", taskType="other", priority="low")
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
