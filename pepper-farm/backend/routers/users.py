from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from services.user_service import get_workers
from schemas.user import WorkerResponse

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/workers", response_model=list[WorkerResponse])
def list_workers(db: Session = Depends(get_db)):
    workers = get_workers(db)
    return [
        WorkerResponse(
            userId=w.UserId,
            fullName=w.FullName,
            email=w.Email,
            roleName=w.role.RoleName,
            isActive=w.IsActive,
        )
        for w in workers
    ]
