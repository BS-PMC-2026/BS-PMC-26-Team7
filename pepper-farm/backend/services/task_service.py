from datetime import datetime, timezone
from sqlalchemy.orm import Session
from models.task import Task
from models.user import User
from schemas.task import CreateTaskRequest, TaskResponse

ALLOWED_PRIORITIES = {"low", "medium", "high", "critical"}

def create_task(db: Session, created_by_user_id: int, data: CreateTaskRequest) -> tuple[TaskResponse | None, str | None]:
    # Verify caller exists and is FarmManager
    caller = db.query(User).filter(User.UserId == created_by_user_id).first()
    if not caller:
        return None, "Caller user does not exist."
    if caller.role.RoleName != "FarmManager":
        return None, "Only FarmManagers can create tasks."

    # Validate priority
    if data.priority not in ALLOWED_PRIORITIES:
        return None, f"Invalid priority '{data.priority}'. Allowed values: low, medium, high, critical."

    # Validate due date
    if data.dueDate:
        today = datetime.now(timezone.utc).date()
        if data.dueDate.date() < today:
            return None, "DueDate cannot be in the past."

    # Validate assignee
    if data.assignedToUserId is not None:
        assignee = db.query(User).filter(User.UserId == data.assignedToUserId).first()
        if not assignee:
            return None, "Assigned user does not exist."
        if assignee.role.RoleName != "Worker":
            return None, "Tasks can only be assigned to Workers."

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
        ZoneId=data.zoneId,
        CreatedAt=now,
        UpdatedAt=now,
    )
    db.add(task)
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
