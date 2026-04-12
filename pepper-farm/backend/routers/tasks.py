from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from services.task_service import create_task, get_all_tasks
from schemas.task import CreateTaskRequest, TaskResponse

router = APIRouter(prefix="/api/tasks", tags=["tasks"])

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
