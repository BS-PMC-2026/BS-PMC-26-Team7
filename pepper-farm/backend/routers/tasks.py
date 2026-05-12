from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from services.task_service import create_task, get_all_tasks, get_tasks_by_user, update_task, get_open_tasks_report, get_open_tasks_by_worker ,get_completed_tasks
from schemas.task import CreateTaskRequest, UpdateTaskRequest, TaskResponse
from utils.jwt import get_current_user, require_role

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


@router.get("/my", response_model=list[TaskResponse])
def get_my_tasks(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return get_tasks_by_user(db, current_user["user_id"])


@router.get("/report", response_model=list[TaskResponse])
def get_tasks_report(
    worker_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("FarmManager")),
):
    """BSPMT7-109: Report of open tasks - all or by worker"""
    if worker_id:
        return get_open_tasks_by_worker(db, worker_id)
    return get_open_tasks_report(db)

@router.get("/completed", response_model=list[TaskResponse])
def get_completed_tasks_endpoint(
    worker_id: int | None = None,
    task_type: str | None = None,
    zone_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("FarmManager")),
):
    return get_completed_tasks(
        db=db,
        worker_id=worker_id,
        task_type=task_type,
        zone_id=zone_id,
    )

@router.get("", response_model=list[TaskResponse])
def list_tasks_endpoint(db: Session = Depends(get_db)):
    return get_all_tasks(db)


@router.post("", response_model=TaskResponse, status_code=201)
def create_task_endpoint(
    data: CreateTaskRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    result, error = create_task(db, current_user["user_id"], data)
    if error:
        raise HTTPException(status_code=400, detail=error)
    return result


@router.patch("/{task_id}", response_model=TaskResponse)
def update_task_endpoint(
    task_id: int,
    data: UpdateTaskRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    result, error = update_task(db, task_id, data)
    if error:
        raise HTTPException(status_code=400, detail=error)
    return result