from datetime import datetime, timezone
from sqlalchemy.orm import Session
from models.task import Task
from schemas.worker_dashboard import WorkerAnalyticsResponse

_OPEN_STATUSES = {"todo", "in_progress"}


def get_worker_analytics(db: Session, worker_id: int) -> WorkerAnalyticsResponse:
    tasks = db.query(Task).filter(Task.AssignedToUserId == worker_id).all()

    open_tasks = [t for t in tasks if t.Status in _OPEN_STATUSES]
    completed_tasks = [
        t for t in tasks
        if t.Status == "done" and t.StartedAt is not None and t.CompletedAt is not None
    ]

    if not completed_tasks:
        return WorkerAnalyticsResponse(
            openTasksCount=len(open_tasks),
            completedTasksCount=len([t for t in tasks if t.Status == "done"]),
            avgCompletionTimeHours=None,
            fastestCompletionTimeHours=None,
            slowestCompletionTimeHours=None,
            fastestTaskTitle=None,
            slowestTaskTitle=None,
        )

    def hours(task: Task) -> float:
        started = task.StartedAt
        completed = task.CompletedAt
        if started is None or completed is None:
            return 0.0
        # Ensure both are naive or both aware
        if started.tzinfo is None and completed.tzinfo is None:
            delta = completed - started
        else:
            # Normalise to UTC-naive
            def _naive(dt: datetime) -> datetime:
                if dt.tzinfo is not None:
                    return dt.astimezone(timezone.utc).replace(tzinfo=None)
                return dt
            delta = _naive(completed) - _naive(started)
        return max(0.0, delta.total_seconds() / 3600.0)

    durations = [(hours(t), t) for t in completed_tasks]
    total_hours = sum(d for d, _ in durations)
    avg = total_hours / len(durations)

    fastest_hours, fastest_task = min(durations, key=lambda x: x[0])
    slowest_hours, slowest_task = max(durations, key=lambda x: x[0])

    return WorkerAnalyticsResponse(
        openTasksCount=len(open_tasks),
        completedTasksCount=len([t for t in tasks if t.Status == "done"]),
        avgCompletionTimeHours=round(avg, 2),
        fastestCompletionTimeHours=round(fastest_hours, 2),
        slowestCompletionTimeHours=round(slowest_hours, 2),
        fastestTaskTitle=fastest_task.Title,
        slowestTaskTitle=slowest_task.Title,
    )
