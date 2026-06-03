"""
BSPMT7-594 — Integration test for the Task Statistics API.

Exercises the real HTTP endpoint GET /api/analytics/task-statistics through a
TestClient: query-param parsing (start_date / end_date / worker_id / period),
the response shape, and the FarmManager auth requirement. Backed by a shared
in-memory SQLite DB so the request flows through the actual service + response
serialization (not a mock).
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from main import app
from database import Base, get_db
from utils.jwt import get_current_user
from models.role import Role
from models.user import User
from models.task import Task
import models.farm_zone        # noqa: F401 — FK referenced by Task.ZoneId
import models.pepper_variety   # noqa: F401 — FK referenced by Task.PepperId
import models.plant            # noqa: F401 — FK referenced by SensorAssignment
import models.sensor           # noqa: F401 — FK referenced by Task.AnomalyId

# ── Shared in-memory DB (StaticPool keeps one connection so seeded rows persist)
engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestSession = sessionmaker(bind=engine)

MANAGER_ROLE_ID, WORKER_ROLE_ID = 1, 2
MANAGER_ID, WORKER_A_ID, WORKER_B_ID = 10, 20, 21

PAST_DUE = datetime(2020, 1, 1)  # always overdue


def _manager():
    return {"user_id": MANAGER_ID, "role": "FarmManager"}


@pytest.fixture()
def client():
    Base.metadata.create_all(bind=engine)
    session = TestSession()
    session.add_all([
        Role(RoleId=MANAGER_ROLE_ID, RoleName="FarmManager", IsActive=True, CreatedAt=datetime.utcnow()),
        Role(RoleId=WORKER_ROLE_ID,  RoleName="Worker",      IsActive=True, CreatedAt=datetime.utcnow()),
    ])
    session.add_all([
        User(UserId=MANAGER_ID,  FullName="Alice Manager", Email="alice@farm.com", PasswordHash="x", RoleId=MANAGER_ROLE_ID, IsActive=True, CreatedAt=datetime.utcnow()),
        User(UserId=WORKER_A_ID, FullName="Bob Worker",    Email="bob@farm.com",   PasswordHash="x", RoleId=WORKER_ROLE_ID,  IsActive=True, CreatedAt=datetime.utcnow()),
        User(UserId=WORKER_B_ID, FullName="Carol Worker",  Email="carol@farm.com", PasswordHash="x", RoleId=WORKER_ROLE_ID,  IsActive=True, CreatedAt=datetime.utcnow()),
    ])
    # Worker A: one done (05-01, 2h) + one open (05-15). Worker B: one overdue (06-01).
    base = datetime(2026, 5, 1, 10, 0, 0)
    session.add_all([
        Task(Title="A-done", TaskType="inspection", Priority="medium", Status="done",
             CreatedByUserId=MANAGER_ID, AssignedToUserId=WORKER_A_ID,
             CreatedAt=base, UpdatedAt=base, CompletedAt=base + timedelta(hours=2)),
        Task(Title="A-open", TaskType="inspection", Priority="medium", Status="todo",
             CreatedByUserId=MANAGER_ID, AssignedToUserId=WORKER_A_ID,
             CreatedAt=datetime(2026, 5, 15), UpdatedAt=datetime(2026, 5, 15)),
        Task(Title="B-overdue", TaskType="inspection", Priority="high", Status="todo",
             CreatedByUserId=MANAGER_ID, AssignedToUserId=WORKER_B_ID, DueDate=PAST_DUE,
             CreatedAt=datetime(2026, 6, 1), UpdatedAt=datetime(2026, 6, 1)),
    ])
    session.commit()

    app.dependency_overrides[get_db] = lambda: session
    app.dependency_overrides[get_current_user] = _manager
    yield TestClient(app)

    app.dependency_overrides.clear()
    session.close()
    Base.metadata.drop_all(bind=engine)


# ── Success + response shape ──────────────────────────────────────────────────

def test_endpoint_returns_200_and_expected_shape(client):
    res = client.get("/api/analytics/task-statistics")
    assert res.status_code == 200

    body = res.json()
    assert set(body) == {"summary", "by_status", "by_worker", "by_period", "overdue_tasks"}
    summary = body["summary"]
    assert summary["total"] == 3
    assert summary["completed"] == 1
    assert summary["overdue"] == 1
    for key in ("open", "completion_rate", "avg_completion_hours",
                "fastest_worker", "slowest_worker"):
        assert key in summary
    assert isinstance(body["by_worker"], list)


# ── Query params ──────────────────────────────────────────────────────────────

def test_worker_id_param_filters_results(client):
    res = client.get("/api/analytics/task-statistics", params={"worker_id": WORKER_A_ID})
    assert res.status_code == 200
    assert res.json()["summary"]["total"] == 2  # only Worker A's two tasks


def test_date_range_params_filter_results(client):
    res = client.get(
        "/api/analytics/task-statistics",
        params={"start_date": "2026-05-01", "end_date": "2026-05-10"},
    )
    assert res.status_code == 200
    assert res.json()["summary"]["total"] == 1  # only the 05-01 task


def test_period_param_daily(client):
    res = client.get("/api/analytics/task-statistics", params={"period": "daily"})
    assert res.status_code == 200
    periods = [p["period"] for p in res.json()["by_period"]]
    assert "2026-05-01" in periods  # daily bucket key format


def test_invalid_period_returns_422(client):
    res = client.get("/api/analytics/task-statistics", params={"period": "hourly"})
    assert res.status_code == 422  # Literal[...] validation rejects unknown values


# ── Auth / permission ─────────────────────────────────────────────────────────

def test_non_manager_role_forbidden_403(client):
    app.dependency_overrides[get_current_user] = lambda: {"user_id": WORKER_A_ID, "role": "Worker"}
    res = client.get("/api/analytics/task-statistics")
    assert res.status_code == 403


def test_missing_token_returns_401(client):
    # Remove the auth override so the real dependency runs with no Authorization header.
    app.dependency_overrides.pop(get_current_user, None)
    res = client.get("/api/analytics/task-statistics")
    assert res.status_code == 401
