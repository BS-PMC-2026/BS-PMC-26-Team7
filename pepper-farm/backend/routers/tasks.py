from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from services.task_service import create_task, get_all_tasks, get_tasks_by_user
from schemas.task import CreateTaskRequest, TaskResponse
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
    # TODO: extract created_by_user_id from JWT once auth is implemented
    created_by_user_id: int = 1,
):
    result, error = create_task(db, created_by_user_id, data)
    if error:
        raise HTTPException(status_code=400, detail=error)
    return result
