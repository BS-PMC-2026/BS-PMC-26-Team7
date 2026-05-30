from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import OperationalError
from database import get_db
from schemas.plant import PlantCreate, PlantResponse, UpdatePlantLocationRequest, UpdatePlantStatusRequest
from services.plant_service import create_plant, update_plant_location, update_plant_status, get_all_plants, get_plant_by_id
from utils.jwt import require_role, require_any_role

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
        raise HTTPException(status_code=503, detail="Database connection timeout.")
    except HTTPException:
        raise
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Unexpected server error.")


@router.get("", response_model=list[PlantResponse])
def list_plants_endpoint(db: Session = Depends(get_db)):
    try:
        return get_all_plants(db)
    except OperationalError:
        raise HTTPException(status_code=503, detail="Database connection timeout.")
    except Exception:
        raise HTTPException(status_code=500, detail="Unexpected server error.")


@router.get("/{plant_id}", response_model=PlantResponse)
def get_plant_endpoint(plant_id: int, db: Session = Depends(get_db)):
    plant = get_plant_by_id(db, plant_id)
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found.")
    return plant


@router.put("/{plant_id}/status", response_model=PlantResponse)
def update_plant_status_endpoint(
    plant_id: int,
    data: UpdatePlantStatusRequest,
    db: Session = Depends(get_db),
    _user=Depends(require_role("FarmManager")),
):
    try:
        plant, error = update_plant_status(db, plant_id, data.Status)
        if error:
            if "not found" in error:
                raise HTTPException(status_code=404, detail=error)
            raise HTTPException(status_code=400, detail=error)
        return plant
    except OperationalError:
        db.rollback()
        raise HTTPException(status_code=503, detail="Database connection timeout.")
    except HTTPException:
        raise
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Unexpected server error.")


@router.put("/{plant_id}/location", response_model=PlantResponse)
def update_plant_location_endpoint(
    plant_id: int,
    data: UpdatePlantLocationRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_any_role("FarmManager", "Worker")),
):
    try:
        plant, error = update_plant_location(db, plant_id, data.zoneId)
        if error:
            if "not found" in error:
                raise HTTPException(status_code=404, detail=error)
            raise HTTPException(status_code=400, detail=error)
        return plant
    except OperationalError:
        db.rollback()
        raise HTTPException(status_code=503, detail="Database connection timeout.")
    except HTTPException:
        raise
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Unexpected server error.")