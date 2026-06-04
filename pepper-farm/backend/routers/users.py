from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from schemas.user import WorkerResponse, PromoteRequest
from services.user_service import get_all_users, get_user_by_id, promote_user, search_users_by_name
from utils.jwt import require_role

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/workers", response_model=list[WorkerResponse])
def list_workers(db: Session = Depends(get_db)):
    users = get_all_users(db)
    return [
        WorkerResponse(
            userId=u.UserId,
            fullName=u.FullName,
            email=u.Email,
            roleName=u.role.RoleName,
            isActive=u.IsActive,
        )
        for u in users
    ]


@router.get("/search", response_model=list[WorkerResponse])
def search_users(
    name: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("FarmManager")),
):
    users = search_users_by_name(db, name)
    return [
        WorkerResponse(
            userId=u.UserId,
            fullName=u.FullName,
            email=u.Email,
            roleName=u.role.RoleName,
            isActive=u.IsActive,
        )
        for u in users
    ]


@router.get("", response_model=list[WorkerResponse])
def list_all_users(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("FarmManager")),
):
    users = get_all_users(db)
    return [
        WorkerResponse(
            userId=u.UserId,
            fullName=u.FullName,
            email=u.Email,
            roleName=u.role.RoleName,
            isActive=u.IsActive,
        )
        for u in users
    ]


@router.put("/{user_id}/role", response_model=WorkerResponse)
def update_user_role(
    user_id: int,
    data: PromoteRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("FarmManager")),
):
    user, error = promote_user(db, user_id, data.roleId)
    if error:
        if "not found" in error:
            raise HTTPException(status_code=404, detail=error)
        raise HTTPException(status_code=400, detail=error)

    return WorkerResponse(
        userId=user.UserId,
        fullName=user.FullName,
        email=user.Email,
        roleName=user.role.RoleName,
        isActive=user.IsActive,
    )