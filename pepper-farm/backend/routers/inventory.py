from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError, OperationalError
from typing import List
import traceback

from database import get_db
from schemas.inventory import InventoryUpdate, InventoryResponse
from services.inventory_service import (
    get_inventory_list,
    get_inventory_by_product_id,
    update_inventory,
)
from utils.jwt import require_role

router = APIRouter(prefix="/api/inventory", tags=["Inventory"])


@router.get("", response_model=List[InventoryResponse])
def list_inventory_endpoint(
    db: Session = Depends(get_db),
    _user=Depends(require_role("FarmManager")),
):
    try:
        return get_inventory_list(db)
    except OperationalError:
        raise HTTPException(status_code=503, detail="Database connection timeout. Please try again.")
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Unexpected server error.")


@router.get("/{product_id}", response_model=InventoryResponse)
def get_inventory_endpoint(
    product_id: int,
    db: Session = Depends(get_db),
    _user=Depends(require_role("FarmManager")),
):
    try:
        return get_inventory_by_product_id(db, product_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except OperationalError:
        raise HTTPException(status_code=503, detail="Database connection timeout. Please try again.")
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Unexpected server error.")


@router.put("/{product_id}", response_model=InventoryResponse)
def update_inventory_endpoint(
    product_id: int,
    payload: InventoryUpdate,
    db: Session = Depends(get_db),
    _user=Depends(require_role("FarmManager")),
):
    try:
        return update_inventory(db, product_id, payload)
    except ValueError as e:
        db.rollback()
        if "not found" in str(e).lower():
            raise HTTPException(status_code=404, detail=str(e))
        raise HTTPException(status_code=400, detail=str(e))
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Database integrity error while updating inventory.")
    except OperationalError:
        db.rollback()
        raise HTTPException(status_code=503, detail="Database connection timeout. Please try again.")
    except HTTPException:
        raise
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Unexpected server error.")