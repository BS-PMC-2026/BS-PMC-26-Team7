from datetime import datetime, timezone

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database import Base
from models.task import Task
from services.task_service import get_completed_tasks

from models.pepper_variety import PepperVariety
from models.user import User
from models.farm_zone import FarmZone
from models.role import Role


SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(SQLALCHEMY_DATABASE_URL)

TestingSessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)


def setup_function():
    Base.metadata.create_all(bind=engine)


def teardown_function():
    Base.metadata.drop_all(bind=engine)


def test_get_completed_tasks_returns_only_done_tasks():
    db = TestingSessionLocal()
    now = datetime.now(timezone.utc)

    done_task = Task(
        Title="Completed Task",
        Status="done",
        Priority="medium",
        TaskType="spray",
        CreatedByUserId=1,
        AssignedToUserId=2,
        CompletedAt=now,
        CreatedAt=now,
        UpdatedAt=now,
    )

    open_task = Task(
        Title="Open Task",
        Status="todo",
        Priority="medium",
        TaskType="spray",
        CreatedByUserId=1,
        AssignedToUserId=2,
        CreatedAt=now,
        UpdatedAt=now,
    )

    db.add(done_task)
    db.add(open_task)
    db.commit()

    result = get_completed_tasks(db)

    assert len(result) == 1
    assert result[0].title == "Completed Task"
    assert result[0].status == "done"

    db.close()


def test_get_completed_tasks_filter_by_worker():
    db = TestingSessionLocal()
    now = datetime.now(timezone.utc)

    task1 = Task(
        Title="Worker 2 Task",
        Status="done",
        Priority="medium",
        TaskType="spray",
        CreatedByUserId=1,
        AssignedToUserId=2,
        CompletedAt=now,
        CreatedAt=now,
        UpdatedAt=now,
    )

    task2 = Task(
        Title="Worker 3 Task",
        Status="done",
        Priority="medium",
        TaskType="spray",
        CreatedByUserId=1,
        AssignedToUserId=3,
        CompletedAt=now,
        CreatedAt=now,
        UpdatedAt=now,
    )

    db.add(task1)
    db.add(task2)
    db.commit()

    result = get_completed_tasks(db, worker_id=2)

    assert len(result) == 1
    assert result[0].assignedToUserId == 2

    db.close()


def test_get_completed_tasks_filter_by_task_type():
    db = TestingSessionLocal()
    now = datetime.now(timezone.utc)

    spray_task = Task(
        Title="Spray Task",
        Status="done",
        Priority="medium",
        TaskType="spray",
        CreatedByUserId=1,
        AssignedToUserId=2,
        CompletedAt=now,
        CreatedAt=now,
        UpdatedAt=now,
    )

    irrigation_task = Task(
        Title="Irrigation Task",
        Status="done",
        Priority="medium",
        TaskType="irrigation",
        CreatedByUserId=1,
        AssignedToUserId=2,
        CompletedAt=now,
        CreatedAt=now,
        UpdatedAt=now,
    )

    db.add(spray_task)
    db.add(irrigation_task)
    db.commit()

    result = get_completed_tasks(db, task_type="spray")

    assert len(result) == 1
    assert result[0].taskType == "spray"

    db.close()