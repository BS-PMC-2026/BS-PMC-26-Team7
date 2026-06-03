"""
US45 — Task Statistics: unit tests for get_task_statistics service.
Uses an in-memory SQLite DB (no SQL Server required).
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from datetime import datetime, timedelta

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database import Base
from models.role import Role
from models.user import User
from models.task import Task
import models.farm_zone   # noqa: F401 — FK referenced by Task.ZoneId
import models.pepper_variety  # noqa: F401 — FK referenced by Task.PepperId
import models.plant       # noqa: F401 — FK referenced by SensorAssignment
import models.sensor      # noqa: F401 — FK referenced by Task.AnomalyId
from services.analytics_service import get_task_statistics

# ── DB setup ──────────────────────────────────────────────────────────────────

SQLALCHEMY_TEST_URL = "sqlite:///:memory:"
engine = create_engine(SQLALCHEMY_TEST_URL, connect_args={"check_same_thread": False})
TestSession = sessionmaker(bind=engine)

MANAGER_ROLE_ID = 1
WORKER_ROLE_ID  = 2
MANAGER_ID      = 10
WORKER_A_ID     = 20
WORKER_B_ID     = 21

NOW        = datetime.utcnow()                # naive UTC — always current
YESTERDAY  = NOW - timedelta(days=1)
TOMORROW   = NOW + timedelta(days=2)          # clearly in the future
LAST_MONTH = NOW - timedelta(days=32)


@pytest.fixture()
def db():
    Base.metadata.create_all(bind=engine)
    session = TestSession()

    session.add_all([
        Role(RoleId=MANAGER_ROLE_ID, RoleName="FarmManager", IsActive=True, CreatedAt=NOW),
        Role(RoleId=WORKER_ROLE_ID,  RoleName="Worker",      IsActive=True, CreatedAt=NOW),
    ])
    session.add_all([
        User(UserId=MANAGER_ID,  FullName="Alice Manager", Email="alice@farm.com", PasswordHash="x", RoleId=MANAGER_ROLE_ID, IsActive=True, CreatedAt=NOW),
        User(UserId=WORKER_A_ID, FullName="Bob Worker",    Email="bob@farm.com",   PasswordHash="x", RoleId=WORKER_ROLE_ID,  IsActive=True, CreatedAt=NOW),
        User(UserId=WORKER_B_ID, FullName="Carol Worker",  Email="carol@farm.com", PasswordHash="x", RoleId=WORKER_ROLE_ID,  IsActive=True, CreatedAt=NOW),
    ])
    session.commit()

    yield session

    session.close()
    Base.metadata.drop_all(bind=engine)


def _task(session, *, status="todo", due=None, assigned_to=None,
          created=None, completed_at=None, started_at=None) -> Task:
    t = Task(
        Title="Task",
        TaskType="inspection",
        Priority="medium",
        Status=status,
        CreatedByUserId=MANAGER_ID,
        AssignedToUserId=assigned_to,
        DueDate=due,
        StartedAt=started_at,
        CompletedAt=completed_at,
        CreatedAt=created or NOW,
        UpdatedAt=created or NOW,
    )
    session.add(t)
    session.commit()
    return t


# ── 1. Empty DB ───────────────────────────────────────────────────────────────

def test_empty_db_returns_zeros(db):
    result = get_task_statistics(db)
    s = result.summary
    assert s.total == 0
    assert s.open == 0
    assert s.completed == 0
    assert s.overdue == 0
    assert s.completion_rate == 0.0
    assert s.avg_completion_hours is None
    assert result.by_status == []
    assert result.by_worker == []
    assert result.by_period == []
    assert result.overdue_tasks == []


# ── 2. Counts by status ───────────────────────────────────────────────────────

def test_counts_by_status(db):
    _task(db, status="todo")
    _task(db, status="todo")
    _task(db, status="in_progress")
    _task(db, status="done",      completed_at=NOW)
    _task(db, status="cancelled")

    result = get_task_statistics(db)
    s = result.summary
    assert s.total == 5
    assert s.completed == 1
    assert s.open == 3           # todo×2 + in_progress×1
    assert s.completion_rate == 20.0


# ── 3. Overdue detection ──────────────────────────────────────────────────────

def test_overdue_tasks_detected(db):
    _task(db, status="todo",        due=YESTERDAY)  # overdue
    _task(db, status="in_progress", due=YESTERDAY)  # overdue
    _task(db, status="todo",        due=TOMORROW)   # not overdue
    _task(db, status="done",        due=YESTERDAY, completed_at=NOW)  # done, not overdue
    _task(db, status="cancelled",   due=YESTERDAY)  # cancelled, not overdue

    result = get_task_statistics(db)
    assert result.summary.overdue == 2
    assert len(result.overdue_tasks) == 2


def test_task_without_due_date_is_not_overdue(db):
    _task(db, status="todo", due=None)
    result = get_task_statistics(db)
    assert result.summary.overdue == 0


# ── 4. Completion rate ────────────────────────────────────────────────────────

def test_completion_rate_all_done(db):
    for _ in range(4):
        _task(db, status="done", completed_at=NOW)
    result = get_task_statistics(db)
    assert result.summary.completion_rate == 100.0


def test_completion_rate_none_done(db):
    for _ in range(3):
        _task(db, status="todo")
    result = get_task_statistics(db)
    assert result.summary.completion_rate == 0.0


# ── 5. Average completion time ────────────────────────────────────────────────

def test_avg_completion_time(db):
    # Task completed exactly 2 hours after creation
    created = datetime(2026, 5, 1, 10, 0, 0)
    completed = datetime(2026, 5, 1, 12, 0, 0)
    _task(db, status="done", created=created, completed_at=completed)

    result = get_task_statistics(db)
    assert result.summary.avg_completion_hours == 2.0


def test_avg_completion_time_multiple_tasks(db):
    # 2 h + 4 h  → avg 3 h
    base = datetime(2026, 5, 1, 0, 0, 0)
    _task(db, status="done", created=base, completed_at=base + timedelta(hours=2))
    _task(db, status="done", created=base, completed_at=base + timedelta(hours=4))

    result = get_task_statistics(db)
    assert result.summary.avg_completion_hours == 3.0


def test_avg_completion_time_none_when_no_completed_tasks(db):
    _task(db, status="todo")
    result = get_task_statistics(db)
    assert result.summary.avg_completion_hours is None


# ── 6. Worker filter ──────────────────────────────────────────────────────────

def test_worker_filter(db):
    _task(db, assigned_to=WORKER_A_ID)
    _task(db, assigned_to=WORKER_A_ID)
    _task(db, assigned_to=WORKER_B_ID)

    result = get_task_statistics(db, worker_id=WORKER_A_ID)
    assert result.summary.total == 2


def test_worker_filter_returns_empty_for_unknown_worker(db):
    _task(db, assigned_to=WORKER_A_ID)
    result = get_task_statistics(db, worker_id=9999)
    assert result.summary.total == 0


# ── 7. Date range filter ──────────────────────────────────────────────────────

def test_date_range_filter(db):
    may1 = datetime(2026, 5, 1)
    may15 = datetime(2026, 5, 15)
    june1 = datetime(2026, 6, 1)

    _task(db, created=may1)
    _task(db, created=may15)
    _task(db, created=june1)

    result = get_task_statistics(db, start_date=may1, end_date=may15)
    assert result.summary.total == 2


def test_date_range_start_only(db):
    _task(db, created=datetime(2026, 4, 1))
    _task(db, created=datetime(2026, 5, 15))
    _task(db, created=datetime(2026, 6, 1))

    result = get_task_statistics(db, start_date=datetime(2026, 5, 1))
    assert result.summary.total == 2


# ── 8. By status grouping ─────────────────────────────────────────────────────

def test_by_status_grouping(db):
    _task(db, status="todo")
    _task(db, status="todo")
    _task(db, status="done", completed_at=NOW)

    result = get_task_statistics(db)
    statuses = {r.status: r.count for r in result.by_status}
    assert statuses["todo"] == 2
    assert statuses["done"] == 1


# ── 9. By worker grouping ─────────────────────────────────────────────────────

def test_by_worker_grouping(db):
    _task(db, assigned_to=WORKER_A_ID, status="done", completed_at=NOW)
    _task(db, assigned_to=WORKER_A_ID, status="todo")
    _task(db, assigned_to=WORKER_B_ID, status="todo")

    result = get_task_statistics(db)
    workers = {w.worker_name: w for w in result.by_worker}
    assert workers["Bob Worker"].total == 2
    assert workers["Bob Worker"].completed == 1
    assert workers["Carol Worker"].total == 1
    assert workers["Carol Worker"].completed == 0


# ── 10. By period grouping (monthly) ─────────────────────────────────────────

def test_by_period_monthly(db):
    _task(db, created=datetime(2026, 4, 10))
    _task(db, created=datetime(2026, 4, 20))
    _task(db, created=datetime(2026, 5, 5))

    result = get_task_statistics(db, period="monthly")
    periods = {r.period: r.total for r in result.by_period}
    assert periods["2026-04"] == 2
    assert periods["2026-05"] == 1


def test_by_period_daily(db):
    _task(db, created=datetime(2026, 5, 1))
    _task(db, created=datetime(2026, 5, 1))
    _task(db, created=datetime(2026, 5, 2))

    result = get_task_statistics(db, period="daily")
    periods = {r.period: r.total for r in result.by_period}
    assert periods["2026-05-01"] == 2
    assert periods["2026-05-02"] == 1


def test_by_period_yearly(db):
    _task(db, created=datetime(2025, 6, 1))
    _task(db, created=datetime(2026, 3, 1))

    result = get_task_statistics(db, period="yearly")
    periods = {r.period: r.total for r in result.by_period}
    assert periods["2025"] == 1
    assert periods["2026"] == 1


# ── 11. Overdue tasks list content ───────────────────────────────────────────

def test_overdue_task_list_has_correct_fields(db):
    _task(db, status="todo", due=YESTERDAY, assigned_to=WORKER_A_ID)

    result = get_task_statistics(db)
    assert len(result.overdue_tasks) == 1
    item = result.overdue_tasks[0]
    assert item.assignee_name == "Bob Worker"
    assert item.priority == "medium"
    assert item.status == "todo"
    assert item.due_date is not None


# ── 12. end_date is inclusive of the full day ─────────────────────────────────

def test_end_date_includes_full_day(db):
    """A task created at 23:59 on the end_date day must be included."""
    day = datetime(2026, 5, 15)
    _task(db, created=datetime(2026, 5, 15, 23, 59, 0))
    _task(db, created=datetime(2026, 5, 16, 0, 0, 1))  # next day — excluded

    # Pass end_date as midnight (simulating a date-only frontend input)
    result = get_task_statistics(db, end_date=day)
    assert result.summary.total == 1


# ── 13. avg_completion_hours ignores negative deltas ─────────────────────────

def test_avg_completion_time_skips_negative_delta(db):
    """CompletedAt earlier than CreatedAt is skipped, not included negatively."""
    base = datetime(2026, 5, 1, 12, 0, 0)
    # Normal task: 2 h completion
    _task(db, status="done", created=base, completed_at=base + timedelta(hours=2))
    # Corrupt task: CompletedAt 1 h BEFORE CreatedAt (clock skew / data error)
    _task(db, status="done", created=base, completed_at=base - timedelta(hours=1))

    result = get_task_statistics(db)
    # Only the valid 2-hour task is counted — corrupt delta is skipped
    assert result.summary.avg_completion_hours == 2.0


# ── 15. Per-worker average completion time ────────────────────────────────────

def test_per_worker_avg_completion_time(db):
    base = datetime(2026, 5, 1, 8, 0, 0)
    # Bob: two done tasks averaging 2 h (1 h + 3 h)
    _task(db, assigned_to=WORKER_A_ID, status="done", created=base, completed_at=base + timedelta(hours=1))
    _task(db, assigned_to=WORKER_A_ID, status="done", created=base, completed_at=base + timedelta(hours=3))
    # Carol: one done task taking 6 h
    _task(db, assigned_to=WORKER_B_ID, status="done", created=base, completed_at=base + timedelta(hours=6))

    result = get_task_statistics(db)
    by_name = {w.worker_name: w for w in result.by_worker}
    assert by_name["Bob Worker"].avg_completion_hours == 2.0
    assert by_name["Carol Worker"].avg_completion_hours == 6.0


def test_per_worker_avg_is_none_without_completed(db):
    _task(db, assigned_to=WORKER_A_ID, status="todo")
    result = get_task_statistics(db)
    by_name = {w.worker_name: w for w in result.by_worker}
    assert by_name["Bob Worker"].avg_completion_hours is None


# ── 16. Fastest / slowest worker ──────────────────────────────────────────────

def test_fastest_and_slowest_worker(db):
    base = datetime(2026, 5, 1, 8, 0, 0)
    # Bob averages 2 h → fastest; Carol averages 6 h → slowest
    _task(db, assigned_to=WORKER_A_ID, status="done", created=base, completed_at=base + timedelta(hours=2))
    _task(db, assigned_to=WORKER_B_ID, status="done", created=base, completed_at=base + timedelta(hours=6))

    s = get_task_statistics(db).summary
    assert s.fastest_worker == "Bob Worker"
    assert s.fastest_worker_hours == 2.0
    assert s.slowest_worker == "Carol Worker"
    assert s.slowest_worker_hours == 6.0


def test_fastest_slowest_none_when_no_completions(db):
    _task(db, assigned_to=WORKER_A_ID, status="todo")
    s = get_task_statistics(db).summary
    assert s.fastest_worker is None
    assert s.slowest_worker is None
    assert s.fastest_worker_hours is None
    assert s.slowest_worker_hours is None


def test_single_worker_is_both_fastest_and_slowest(db):
    base = datetime(2026, 5, 1, 8, 0, 0)
    _task(db, assigned_to=WORKER_A_ID, status="done", created=base, completed_at=base + timedelta(hours=4))
    s = get_task_statistics(db).summary
    assert s.fastest_worker == "Bob Worker"
    assert s.slowest_worker == "Bob Worker"


def test_unassigned_tasks_excluded_from_speed_ranking(db):
    base = datetime(2026, 5, 1, 8, 0, 0)
    # Only an unassigned completed task exists → no eligible worker for ranking
    _task(db, assigned_to=None, status="done", created=base, completed_at=base + timedelta(hours=2))
    s = get_task_statistics(db).summary
    assert s.fastest_worker is None
    assert s.slowest_worker is None


# ── 17. Completion time prefers StartedAt, falls back to CreatedAt ─────────────

def test_completion_time_prefers_started_at(db):
    created = datetime(2026, 5, 1, 8, 0, 0)
    started = datetime(2026, 5, 1, 10, 0, 0)   # work began 2 h after creation
    completed = datetime(2026, 5, 1, 13, 0, 0)  # finished 3 h after starting
    _task(db, assigned_to=WORKER_A_ID, status="done",
          created=created, started_at=started, completed_at=completed)

    # Work time is StartedAt->CompletedAt = 3 h, NOT CreatedAt->CompletedAt (5 h)
    by_name = {w.worker_name: w for w in get_task_statistics(db).by_worker}
    assert by_name["Bob Worker"].avg_completion_hours == 3.0


def test_completion_time_falls_back_to_created_at(db):
    created = datetime(2026, 5, 1, 8, 0, 0)
    completed = datetime(2026, 5, 1, 12, 0, 0)  # 4 h, no StartedAt recorded
    _task(db, assigned_to=WORKER_A_ID, status="done",
          created=created, started_at=None, completed_at=completed)

    by_name = {w.worker_name: w for w in get_task_statistics(db).by_worker}
    assert by_name["Bob Worker"].avg_completion_hours == 4.0


# ── 14. CompletedAt cleared when task is re-opened ────────────────────────────

def test_completed_at_cleared_on_reopen(db):
    """Moving a done task back to in_progress must clear CompletedAt."""
    import importlib, services.task_service as ts_module
    from schemas.task import UpdateTaskRequest

    # Create and complete a task
    dto_create = __import__("schemas.task", fromlist=["CreateTaskRequest"]).CreateTaskRequest(
        title="Reopenable", taskType="inspection", priority="medium",
        assignedToUserId=WORKER_A_ID,
    )
    from services.task_service import create_task, update_task
    task_resp, _ = create_task(db, MANAGER_ID, dto_create)
    update_task(db, task_resp.id, UpdateTaskRequest(status="done"))

    # Verify CompletedAt is set
    from models.task import Task
    task_obj = db.query(Task).filter(Task.Id == task_resp.id).first()
    assert task_obj.CompletedAt is not None

    # Re-open
    update_task(db, task_resp.id, UpdateTaskRequest(status="in_progress"))
    db.refresh(task_obj)
    assert task_obj.CompletedAt is None, "CompletedAt must be cleared when re-opened"
