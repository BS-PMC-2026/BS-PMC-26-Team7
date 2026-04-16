from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import OperationalError
from database import get_db
from schemas.user import RegisterRequest, RegisterResponse, LoginRequest, LoginResponse
from services.auth_service import register, login

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=RegisterResponse, status_code=201)
def register_endpoint(data: RegisterRequest, db: Session = Depends(get_db)):
    try:
        user, error = register(db, data)
        if error:
            if "already registered" in error:
                raise HTTPException(status_code=409, detail=error)
            raise HTTPException(status_code=400, detail=error)

        return RegisterResponse(
            userId=user.UserId,
            fullName=user.FullName,
            email=user.Email,
            role=user.role.RoleName,
        )

    except OperationalError:
        db.rollback()
        raise HTTPException(status_code=503, detail="Database connection timeout. Please try again.")

    except HTTPException:
        raise

    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Unexpected server error.")


@router.post("/login", response_model=LoginResponse)
def login_endpoint(data: LoginRequest, db: Session = Depends(get_db)):
    try:
        result, error = login(db, data)
        if error:
            raise HTTPException(status_code=401, detail=error)

        return LoginResponse(**result)

    except OperationalError:
        raise HTTPException(status_code=503, detail="Database connection timeout. Please try again.")

    except HTTPException:
        raise

    except Exception:
        raise HTTPException(status_code=500, detail="Unexpected server error.")