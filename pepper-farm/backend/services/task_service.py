from datetime import datetime, timezone
from sqlalchemy.orm import Session
from models.task import Task
from models.user import User
from models.farm_zone import FarmZone
from schemas.task import CreateTaskRequest, UpdateTaskRequest, TaskResponse

ALLOWED_PRIORITIES = {"low", "medium", "high", "critical"}
ALLOWED_STATUSES = {"todo", "in_progress", "done", "cancelled"}


def _resolve_zone_id(db: Session, data_zone_id, zone_code) -> int | None:
    if data_zone_id is not None:
        return data_zone_id
    if zone_code:
        zone = db.query(FarmZone).filter(FarmZone.ZoneCode == zone_code).first()
        return zone.ZoneId if zone else None
    return None


def create_task(db: Session, created_by_user_id: int, data: CreateTaskRequest) -> tuple[TaskResponse | None, str | None]:
    caller = db.query(User).filter(User.UserId == created_by_user_id).first()
    if not caller:
        return None, "Caller user does not exist."
    if caller.role.RoleName != "FarmManager":
        return None, "Only FarmManagers can create tasks."

    if data.priority not in ALLOWED_PRIORITIES:
        return None, f"Invalid priority '{data.priority}'. Allowed values: low, medium, high, critical."

    if data.dueDate:
        today = datetime.now(timezone.utc).date()
        if data.dueDate.date() < today:
            return None, "DueDate cannot be in the past."

    if data.assignedToUserId is not None:
        assignee = db.query(User).filter(User.UserId == data.assignedToUserId).first()
        if not assignee:
            return None, "Assigned user does not exist."
        if assignee.role.RoleName != "Worker":
            return None, "Tasks can only be assigned to Workers."

    zone_id = _resolve_zone_id(db, data.zoneId, data.zoneCode)

    now = datetime.now(timezone.utc)
    task = Task(
        Title=data.title,
        Description=data.description,
        TaskType=data.taskType,
        Priority=data.priority,
        Status="todo",
        CreatedByUserId=created_by_user_id,
        AssignedToUserId=data.assignedToUserId,
        DueDate=data.dueDate,
        PepperId=data.pepperId,
        ZoneId=zone_id,
        CreatedAt=now,
        UpdatedAt=now,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return _to_response(task), None


def update_task(db: Session, task_id: int, data: UpdateTaskRequest) -> tuple[TaskResponse | None, str | None]:
    task = db.query(Task).filter(Task.Id == task_id).first()
    if not task:
        return None, "Task not found."

    if data.title is not None:
        task.Title = data.title
    if data.taskType is not None:
        task.TaskType = data.taskType
    if data.description is not None:
        task.Description = data.description
    if data.priority is not None:
        if data.priority not in ALLOWED_PRIORITIES:
            return None, f"Invalid priority '{data.priority}'."
        task.Priority = data.priority
    if data.status is not None:
        if data.status not in ALLOWED_STATUSES:
            return None, f"Invalid status '{data.status}'."
        task.Status = data.status
        if data.status == "in_progress" and task.StartedAt is None:
            task.StartedAt = datetime.now(timezone.utc)
        if data.status == "done" and task.CompletedAt is None:
            task.CompletedAt = datetime.now(timezone.utc)
    if data.assignedToUserId is not None:
        task.AssignedToUserId = data.assignedToUserId
    if data.dueDate is not None:
        task.DueDate = data.dueDate
    if data.zoneCode is not None:
        zone = db.query(FarmZone).filter(FarmZone.ZoneCode == data.zoneCode).first()
        task.ZoneId = zone.ZoneId if zone else None

    task.UpdatedAt = datetime.now(timezone.utc)
    db.commit()
    db.refresh(task)
    return _to_response(task), None


def get_all_tasks(db: Session) -> list[TaskResponse]:
    tasks = db.query(Task).order_by(Task.CreatedAt.desc()).all()
    return [_to_response(t) for t in tasks]


def get_tasks_by_user(db: Session, user_id: int) -> list[TaskResponse]:
    tasks = (
        db.query(Task)
        .filter(Task.AssignedToUserId == user_id)
        .order_by(Task.CreatedAt.desc())
        .all()
    )
    return [_to_response(t) for t in tasks]


def get_open_tasks_report(db: Session) -> list[TaskResponse]:
    """BSPMT7-107 BSPMT7-108: Returns all tasks with status not done or cancelled"""
    tasks = (
        db.query(Task)
        .filter(Task.Status.notin_(["done", "cancelled"]))
        .order_by(Task.Priority.asc(), Task.DueDate.asc())
        .all()
    )
    return [_to_response(t) for t in tasks]


def _to_response(task: Task) -> TaskResponse:
    return TaskResponse(
        id=task.Id,
        title=task.Title,
        description=task.Description,
        status=task.Status,
        priority=task.Priority,
        taskType=task.TaskType,
        createdByUserId=task.CreatedByUserId,
        assignedToUserId=task.AssignedToUserId,
        dueDate=task.DueDate,
        startedAt=task.StartedAt,
        completedAt=task.CompletedAt,
        pepperId=task.PepperId,
        zoneId=task.ZoneId,
        zoneCode=task.zone.ZoneCode if task.zone else None,
        createdAt=task.CreatedAt,
        updatedAt=task.UpdatedAt,
    )