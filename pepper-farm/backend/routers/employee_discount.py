"""
US41 — Employee Discount Settings (FarmManager only)
GET    /api/employee-discounts/settings              → get global setting
PUT    /api/employee-discounts/settings              → update global setting
GET    /api/employee-discounts/overrides             → list product overrides
POST   /api/employee-discounts/overrides             → add/update override for product
DELETE /api/employee-discounts/overrides/{id}        → remove override (back to global)
GET    /api/employee-discounts/worker-info           → worker sees effective discount per cart product
"""
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models.employee_discount import EmployeeDiscountSetting, EmployeeDiscountProductOverride
from models.product import Product
from schemas.employee_discount import (
    EmployeeDiscountSettingResponse,
    EmployeeDiscountSettingUpdate,
    ProductOverrideCreate,
    ProductOverrideResponse,
    EmployeeDiscountInfoResponse,
)
from services.pricing_service import get_employee_discount_pct
from utils.jwt import get_current_user, require_role

router = APIRouter(prefix="/api/employee-discounts", tags=["Employee Discounts"])


def _get_or_create_setting(db: Session) -> EmployeeDiscountSetting:
    setting = db.query(EmployeeDiscountSetting).filter(
        EmployeeDiscountSetting.Active == True  # noqa: E712
    ).first()
    if not setting:
        setting = EmployeeDiscountSetting(GlobalDiscountPercent=40, Active=True)
        db.add(setting)
        db.commit()
        db.refresh(setting)
    return setting


def _ser_setting(s: EmployeeDiscountSetting) -> EmployeeDiscountSettingResponse:
    return EmployeeDiscountSettingResponse(
        settingId=s.SettingId,
        globalDiscountPercent=float(s.GlobalDiscountPercent),
        active=bool(s.Active),
        updatedAtUtc=s.UpdatedAtUtc,
    )


@router.get("/settings", response_model=EmployeeDiscountSettingResponse)
def get_setting(
    db: Session = Depends(get_db),
    _: dict = Depends(require_role("FarmManager")),
):
    return _ser_setting(_get_or_create_setting(db))


@router.put("/settings", response_model=EmployeeDiscountSettingResponse)
def update_setting(
    payload: EmployeeDiscountSettingUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("FarmManager")),
):
    setting = _get_or_create_setting(db)
    setting.GlobalDiscountPercent = payload.globalDiscountPercent
    setting.Active                = payload.active
    setting.UpdatedAtUtc          = datetime.now(timezone.utc).replace(tzinfo=None)
    setting.UpdatedBy             = current_user["user_id"]
    db.commit()
    db.refresh(setting)
    return _ser_setting(setting)


@router.get("/overrides", response_model=List[ProductOverrideResponse])
def list_overrides(
    db: Session = Depends(get_db),
    _: dict = Depends(require_role("FarmManager")),
):
    rows = db.query(EmployeeDiscountProductOverride, Product).join(
        Product, EmployeeDiscountProductOverride.ProductId == Product.ProductId
    ).all()
    result = []
    for override, product in rows:
        result.append(ProductOverrideResponse(
            overrideId=override.OverrideId,
            productId=override.ProductId,
            productName=product.ProductName,
            mode=override.Mode,
            customDiscountPercent=float(override.CustomDiscountPercent) if override.CustomDiscountPercent else None,
            updatedAtUtc=override.UpdatedAtUtc,
        ))
    return result


@router.post("/overrides", response_model=ProductOverrideResponse, status_code=201)
def set_override(
    payload: ProductOverrideCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("FarmManager")),
):
    product = db.query(Product).filter(Product.ProductId == payload.productId).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found.")
    if payload.mode not in ("use_global", "excluded", "custom_percent"):
        raise HTTPException(status_code=400, detail="mode must be use_global, excluded, or custom_percent.")
    if payload.mode == "custom_percent" and payload.customDiscountPercent is None:
        raise HTTPException(status_code=400, detail="customDiscountPercent required when mode=custom_percent.")

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    existing = db.query(EmployeeDiscountProductOverride).filter(
        EmployeeDiscountProductOverride.ProductId == payload.productId
    ).first()

    if existing:
        existing.Mode                  = payload.mode
        existing.CustomDiscountPercent = payload.customDiscountPercent
        existing.UpdatedAtUtc          = now
        existing.UpdatedBy             = current_user["user_id"]
        db.commit()
        db.refresh(existing)
        override = existing
    else:
        override = EmployeeDiscountProductOverride(
            ProductId=payload.productId,
            Mode=payload.mode,
            CustomDiscountPercent=payload.customDiscountPercent,
            UpdatedAtUtc=now,
            UpdatedBy=current_user["user_id"],
        )
        db.add(override)
        db.commit()
        db.refresh(override)

    return ProductOverrideResponse(
        overrideId=override.OverrideId,
        productId=override.ProductId,
        productName=product.ProductName,
        mode=override.Mode,
        customDiscountPercent=float(override.CustomDiscountPercent) if override.CustomDiscountPercent else None,
        updatedAtUtc=override.UpdatedAtUtc,
    )


@router.delete("/overrides/{override_id}")
def remove_override(
    override_id: int,
    db: Session = Depends(get_db),
    _: dict = Depends(require_role("FarmManager")),
):
    override = db.query(EmployeeDiscountProductOverride).filter(
        EmployeeDiscountProductOverride.OverrideId == override_id
    ).first()
    if not override:
        raise HTTPException(status_code=404, detail="Override not found.")
    db.delete(override)
    db.commit()
    return {"message": "Override removed. Product will use global employee discount."}
