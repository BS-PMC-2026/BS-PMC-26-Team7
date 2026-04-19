from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError, OperationalError
from typing import List
import traceback

from database import get_db
from schemas.inventory import (
    InventoryCreate,
    InventoryUpdate,
    InventoryResponse,
    InventoryByVariety,
)
from services.inventory_service import (
    get_inventory_list,
    get_inventory_by_id,
    create_warehouse_item,
    update_inventory,
    get_inventory_by_variety,
    get_inventory_report,
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


@router.post("", response_model=InventoryResponse, status_code=201)
def create_inventory_endpoint(
    payload: InventoryCreate,
    db: Session = Depends(get_db),
    _user=Depends(require_role("FarmManager")),
):
    try:
        return create_warehouse_item(db, payload)
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Database integrity error while creating inventory item.")
    except OperationalError:
        db.rollback()
        raise HTTPException(status_code=503, detail="Database connection timeout. Please try again.")
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Unexpected server error.")


@router.get("/by-variety", response_model=List[InventoryByVariety])
def inventory_by_variety_endpoint(
    db: Session = Depends(get_db),
    _user=Depends(require_role("FarmManager")),
):
    try:
        return get_inventory_by_variety(db)
    except OperationalError:
        raise HTTPException(status_code=503, detail="Database connection timeout. Please try again.")
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Unexpected server error.")


@router.get("/report")
def inventory_report_endpoint(
    category: str | None = None,
    low_stock_only: bool = False,
    sort_by: str = "name",
    db: Session = Depends(get_db),
    _user=Depends(require_role("FarmManager")),
):
    """BSPMT7-113: Inventory report API"""
    try:
        return get_inventory_report(db, category, low_stock_only, sort_by)
    except OperationalError:
        raise HTTPException(status_code=503, detail="Database connection timeout. Please try again.")
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Unexpected server error.")


@router.get("/{inventory_id}", response_model=InventoryResponse)
def get_inventory_endpoint(
    inventory_id: int,
    db: Session = Depends(get_db),
    _user=Depends(require_role("FarmManager")),
):
    try:
        return get_inventory_by_id(db, inventory_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except OperationalError:
        raise HTTPException(status_code=503, detail="Database connection timeout. Please try again.")
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Unexpected server error.")


@router.put("/{inventory_id}", response_model=InventoryResponse)
def update_inventory_endpoint(
    inventory_id: int,
    payload: InventoryUpdate,
    db: Session = Depends(get_db),
    _user=Depends(require_role("FarmManager")),
):
    try:
        return update_inventory(db, inventory_id, payload)
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