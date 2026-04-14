from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import OperationalError
from database import get_db
from schemas.plant import PlantCreate, PlantResponse
from services.plant_service import create_plant

router = APIRouter(prefix="/api/plants", tags=["Plants"])


@router.post("", response_model=PlantResponse, status_code=201)
def create_plant_endpoint(data: PlantCreate, db: Session = Depends(get_db)):
    try:
        result, error = create_plant(db, data)
        if error:
            if "already exists" in error:
                raise HTTPException(status_code=409, detail=error)
            raise HTTPException(status_code=400, detail=error)

        return result

    except OperationalError:
        db.rollback()
        raise HTTPException(
            status_code=503,
            detail="Database connection timeout. Please try again.",
        )

    except HTTPException:
        raise

    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Unexpected server error.")