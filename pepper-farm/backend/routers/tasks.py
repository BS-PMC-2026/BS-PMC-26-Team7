from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from services.task_service import create_task, get_all_tasks, get_tasks_by_user, update_task
from schemas.task import CreateTaskRequest, UpdateTaskRequest, TaskResponse
from utils.jwt import get_current_user

router = APIRouter(prefix="/api/tasks", tags=["tasks"])

@router.get("/my", response_model=list[TaskResponse])
def get_my_tasks(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return get_tasks_by_user(db, current_user["user_id"])

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
