from datetime import datetime, timezone
from sqlalchemy.orm import Session, selectinload
from models.task import Task, TaskChecklistItem
from models.user import User
from models.farm_zone import FarmZone
from models.sensor import SensorAlert, SensorAssignment
from schemas.task import (
    AlertInfo,
    ChecklistItemIn,
    ChecklistItemOut,
    CreateTaskRequest,
    TaskResponse,
    UpdateChecklistItemRequest,
    UpdateTaskRequest,
)

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

    # Start with explicit values; they will be overridden by SensorAssignment only when absent.
    zone_id = _resolve_zone_id(db, data.zoneId, data.zoneCode)
    pepper_id = data.pepperId
    description = data.description

    if data.anomalyId is not None:
        alert = db.query(SensorAlert).filter(SensorAlert.AlertId == data.anomalyId).first()
        if not alert:
            return None, f"Alert #{data.anomalyId} not found."

        # Auto-fill ZoneId and PepperId from the active SensorAssignment for this sensor.
        # Explicit values from the request always take precedence.
        assignment = (
            db.query(SensorAssignment)
            .filter(
                SensorAssignment.SensorId == alert.SensorId,
                SensorAssignment.IsActive == True,
            )
            .first()
        )
        if assignment:
            if zone_id is None and assignment.ZoneId:
                zone_id = assignment.ZoneId
            if pepper_id is None and assignment.PepperId:
                pepper_id = assignment.PepperId
            # Task has no PlantId column; append the FK to description so it is not lost.
            if assignment.PlantId is not None:
                plant_tag = f"PlantId:{assignment.PlantId}"
                if description:
                    if plant_tag not in description:
                        description = f"{description}\n{plant_tag}"
                else:
                    description = plant_tag

    now = datetime.now(timezone.utc)
    task = Task(
        Title=data.title,
        Description=description,
        TaskType=data.taskType,
        Priority=data.priority,
        Status="todo",
        CreatedByUserId=created_by_user_id,
        AssignedToUserId=data.assignedToUserId,
        DueDate=data.dueDate,
        PepperId=pepper_id,
        ZoneId=zone_id,
        AnomalyId=data.anomalyId,
        CreatedAt=now,
        UpdatedAt=now,
    )
    for idx, item_in in enumerate(data.checklistItems):
        task.checklist_items.append(TaskChecklistItem(
            Title=item_in.title.strip(),
            IsCompleted=False,
            Position=idx,
            CreatedAt=now,
            UpdatedAt=now,
        ))
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
        # Cancelling is a manager-only soft-delete handled by cancel_task; it must
        # not be reachable through the general (worker-accessible) update path.
        if data.status == "cancelled":
            return None, "Use the delete action to cancel a task."
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


def cancel_task(
    db: Session, task_id: int, requester_user_id: int
) -> tuple[TaskResponse | None, str | None]:
    """Soft-delete a task by marking it cancelled (US42 / BSPMT7-491).

    Works for tasks in any status (todo, in_progress, done) so a manager can
    remove anything created by mistake or no longer relevant. The task is never
    removed from the database and history fields (CompletedAt, etc.) are kept;
    it is simply excluded from the active and completed lists via the status
    filter. Only the manager who created the task may cancel it.
    """
    task = db.query(Task).filter(Task.Id == task_id).first()
    if not task:
        return None, "Task not found."
    if task.CreatedByUserId != requester_user_id:
        return None, "You can only delete tasks you created."
    if task.Status == "cancelled":
        return _to_response(task), None

    task.Status = "cancelled"
    task.UpdatedAt = datetime.now(timezone.utc)
    db.commit()
    db.refresh(task)
    return _to_response(task), None


def get_all_tasks(db: Session) -> list[TaskResponse]:
    tasks = (
        db.query(Task)
        .options(selectinload(Task.checklist_items))
        .filter(Task.Status != "cancelled")
        .order_by(Task.CreatedAt.desc())
        .all()
    )
    return [_to_response(t) for t in tasks]


def get_tasks_by_user(db: Session, user_id: int) -> list[TaskResponse]:
    tasks = (
        db.query(Task)
        .options(selectinload(Task.checklist_items))
        .filter(
            Task.AssignedToUserId == user_id,
            Task.Status != "cancelled",
        )
        .order_by(Task.CreatedAt.desc())
        .all()
    )
    return [_to_response(t) for t in tasks]


def get_open_tasks_report(db: Session) -> list[TaskResponse]:
    """BSPMT7-107 BSPMT7-108: Returns all tasks with status not done or cancelled"""
    tasks = (
        db.query(Task)
        .options(selectinload(Task.checklist_items))
        .filter(Task.Status.notin_(["done", "cancelled"]))
        .order_by(Task.Priority.asc(), Task.DueDate.asc())
        .all()
    )
    return [_to_response(t) for t in tasks]


def get_open_tasks_by_worker(db: Session, worker_id: int) -> list[TaskResponse]:
    """BSPMT7-107 BSPMT7-108: Returns open tasks for a specific worker"""
    tasks = (
        db.query(Task)
        .options(selectinload(Task.checklist_items))
        .filter(
            Task.AssignedToUserId == worker_id,
            Task.Status.notin_(["done", "cancelled"])
        )
        .order_by(Task.Priority.asc(), Task.DueDate.asc())
        .all()
    )
    return [_to_response(t) for t in tasks]


def _to_response(task: Task) -> TaskResponse:
    alert_info = None
    if task.AnomalyId is not None and task.alert is not None:
        a = task.alert
        alert_info = AlertInfo(
            severity=a.Severity,
            metricName=a.MetricName,
            actualValue=a.ActualValue,
            minAllowed=a.MinAllowed,
            maxAllowed=a.MaxAllowed,
            message=a.Message,
            isResolved=bool(a.IsResolved),
            createdAtUtc=a.CreatedAtUtc.isoformat() if a.CreatedAtUtc else "",
        )
    items = getattr(task, "checklist_items", None) or []
    checklist_out = [
        ChecklistItemOut(
            itemId=item.ItemId,
            title=item.Title,
            isCompleted=bool(item.IsCompleted),
            position=item.Position,
        )
        for item in items
    ]
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
        anomalyId=task.AnomalyId,
        alertInfo=alert_info,
        createdAt=task.CreatedAt,
        updatedAt=task.UpdatedAt,
        checklistItems=checklist_out,
    )

def get_completed_tasks(
    db: Session,
    worker_id: int | None = None,
    task_type: str | None = None,
    zone_id: int | None = None,
) -> list[TaskResponse]:
    query = db.query(Task).options(selectinload(Task.checklist_items)).filter(Task.Status == "done")

    if worker_id is not None:
        query = query.filter(Task.AssignedToUserId == worker_id)

    if task_type:
        query = query.filter(Task.TaskType == task_type)

    if zone_id is not None:
        query = query.filter(Task.ZoneId == zone_id)

    tasks = query.order_by(Task.CompletedAt.desc()).all()

    return [_to_response(t) for t in tasks]


def _item_to_out(item: TaskChecklistItem) -> ChecklistItemOut:
    return ChecklistItemOut(
        itemId=item.ItemId,
        title=item.Title,
        isCompleted=bool(item.IsCompleted),
        position=item.Position,
    )


def add_checklist_item(
    db: Session, task_id: int, data: ChecklistItemIn
) -> tuple[ChecklistItemOut | None, str | None]:
    task = db.query(Task).filter(Task.Id == task_id).first()
    if not task:
        return None, "Task not found."

    max_position = max((i.Position for i in task.checklist_items), default=-1)
    now = datetime.now(timezone.utc)
    item = TaskChecklistItem(
        TaskId=task.Id,
        Title=data.title.strip(),
        IsCompleted=False,
        Position=max_position + 1,
        CreatedAt=now,
        UpdatedAt=now,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return _item_to_out(item), None


def update_checklist_item(
    db: Session, task_id: int, item_id: int, data: UpdateChecklistItemRequest
) -> tuple[ChecklistItemOut | None, str | None]:
    item = (
        db.query(TaskChecklistItem)
        .filter(
            TaskChecklistItem.ItemId == item_id,
            TaskChecklistItem.TaskId == task_id,
        )
        .first()
    )
    if not item:
        return None, "Checklist item not found."

    if data.title is not None:
        new_title = data.title.strip()
        if not new_title:
            return None, "Checklist item title cannot be empty."
        item.Title = new_title
    if data.isCompleted is not None:
        item.IsCompleted = data.isCompleted

    item.UpdatedAt = datetime.now(timezone.utc)
    db.commit()
    db.refresh(item)
    return _item_to_out(item), None


def delete_checklist_item(
    db: Session, task_id: int, item_id: int
) -> tuple[bool, str | None]:
    item = (
        db.query(TaskChecklistItem)
        .filter(
            TaskChecklistItem.ItemId == item_id,
            TaskChecklistItem.TaskId == task_id,
        )
        .first()
    )
    if not item:
        return False, "Checklist item not found."
    db.delete(item)
    db.commit()
    return True, None