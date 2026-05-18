from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy.exc import OperationalError
from database import get_db
from schemas.user import LoginRequest, LoginResponse, RegisterRequest, RegisterResponse, TokenResponse
from services.auth_service import login, register

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


@router.post("/token", response_model=TokenResponse)
def swagger_token_endpoint(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    """
    OAuth2 password-flow endpoint consumed by Swagger UI's Authorize dialog.
    Accepts standard form fields (username, password) and treats username as email.
    Returns access_token / token_type so Swagger can set the Bearer header.
    The existing /login endpoint (JSON body) is unchanged.
    """
    try:
        data = LoginRequest(email=form_data.username, password=form_data.password)
        result, error = login(db, data)
        if error:
            raise HTTPException(
                status_code=401,
                detail=error,
                headers={"WWW-Authenticate": "Bearer"},
            )
        return TokenResponse(access_token=result["accessToken"])

    except OperationalError:
        raise HTTPException(status_code=503, detail="Database connection timeout. Please try again.")

    except HTTPException:
        raise

    except Exception:
        raise HTTPException(status_code=500, detail="Unexpected server error.")