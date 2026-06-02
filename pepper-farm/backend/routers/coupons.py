"""
US41 — Coupon Management
GET    /api/coupons              → FarmManager: list all coupons
POST   /api/coupons              → FarmManager: create coupon
PUT    /api/coupons/{id}         → FarmManager: update coupon
DELETE /api/coupons/{id}         → FarmManager: deactivate coupon
POST   /api/coupons/validate     → Customer/Worker: validate coupon against a subtotal
"""
import traceback
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models.coupon import Coupon
from schemas.coupon import CouponCreate, CouponResponse, CouponValidateRequest
from services.pricing_service import validate_coupon, compute_coupon_discount
from utils.jwt import get_current_user, require_role

router = APIRouter(prefix="/api/coupons", tags=["Coupons"])


def _serialize(c: Coupon) -> CouponResponse:
    return CouponResponse(
        couponId=c.CouponId,
        code=c.Code,
        description=c.Description,
        discountType=c.DiscountType,
        discountValue=float(c.DiscountValue),
        active=bool(c.Active),
        startsAtUtc=c.StartsAtUtc,
        endsAtUtc=c.EndsAtUtc,
        maxTotalUses=c.MaxTotalUses,
        maxUsesPerUser=c.MaxUsesPerUser,
        currentUseCount=int(c.CurrentUseCount),
        minimumOrderAmount=float(c.MinimumOrderAmount) if c.MinimumOrderAmount else None,
        createdAtUtc=c.CreatedAtUtc,
        updatedAtUtc=c.UpdatedAtUtc,
    )


@router.get("", response_model=List[CouponResponse])
def list_coupons(
    db: Session = Depends(get_db),
    _: dict = Depends(require_role("FarmManager")),
):
    return [_serialize(c) for c in db.query(Coupon).order_by(Coupon.CreatedAtUtc.desc()).all()]


@router.post("", response_model=CouponResponse, status_code=201)
def create_coupon(
    payload: CouponCreate,
    db: Session = Depends(get_db),
    _: dict = Depends(require_role("FarmManager")),
):
    if db.query(Coupon).filter(Coupon.Code == payload.code.upper().strip()).first():
        raise HTTPException(status_code=409, detail="Coupon code already exists.")
    if payload.discountType not in ("percentage", "fixed_amount"):
        raise HTTPException(status_code=400, detail="discountType must be 'percentage' or 'fixed_amount'.")
    if payload.discountType == "percentage" and payload.discountValue > 100:
        raise HTTPException(status_code=400, detail="Percentage discount cannot exceed 100%.")

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    coupon = Coupon(
        Code=payload.code.upper().strip(),
        Description=payload.description,
        DiscountType=payload.discountType,
        DiscountValue=payload.discountValue,
        Active=payload.active,
        StartsAtUtc=payload.startsAtUtc,
        EndsAtUtc=payload.endsAtUtc,
        MaxTotalUses=payload.maxTotalUses,
        MaxUsesPerUser=payload.maxUsesPerUser,
        MinimumOrderAmount=payload.minimumOrderAmount,
        UpdatedAtUtc=now,
    )
    db.add(coupon)
    db.commit()
    db.refresh(coupon)
    return _serialize(coupon)


@router.put("/{coupon_id}", response_model=CouponResponse)
def update_coupon(
    coupon_id: int,
    payload: CouponCreate,
    db: Session = Depends(get_db),
    _: dict = Depends(require_role("FarmManager")),
):
    coupon = db.query(Coupon).filter(Coupon.CouponId == coupon_id).first()
    if not coupon:
        raise HTTPException(status_code=404, detail="Coupon not found.")
    if payload.discountType not in ("percentage", "fixed_amount"):
        raise HTTPException(status_code=400, detail="discountType must be 'percentage' or 'fixed_amount'.")

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    coupon.Code              = payload.code.upper().strip()
    coupon.Description       = payload.description
    coupon.DiscountType      = payload.discountType
    coupon.DiscountValue     = payload.discountValue
    coupon.Active            = payload.active
    coupon.StartsAtUtc       = payload.startsAtUtc
    coupon.EndsAtUtc         = payload.endsAtUtc
    coupon.MaxTotalUses      = payload.maxTotalUses
    coupon.MaxUsesPerUser    = payload.maxUsesPerUser
    coupon.MinimumOrderAmount = payload.minimumOrderAmount
    coupon.UpdatedAtUtc      = now
    db.commit()
    db.refresh(coupon)
    return coupon


@router.delete("/{coupon_id}")
def deactivate_coupon(
    coupon_id: int,
    db: Session = Depends(get_db),
    _: dict = Depends(require_role("FarmManager")),
):
    coupon = db.query(Coupon).filter(Coupon.CouponId == coupon_id).first()
    if not coupon:
        raise HTTPException(status_code=404, detail="Coupon not found.")
    coupon.Active = False
    coupon.UpdatedAtUtc = datetime.now(timezone.utc).replace(tzinfo=None)
    db.commit()
    return {"message": "Coupon deactivated."}


@router.post("/validate")
def validate_coupon_endpoint(
    payload: CouponValidateRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    coupon, error = validate_coupon(db, payload.code, current_user["user_id"], payload.subtotal)
    if error or not coupon:
        return {"valid": False, "message": error or "Invalid coupon."}
    discount = compute_coupon_discount(coupon, payload.subtotal)
    return {
        "valid":          True,
        "couponCode":     coupon.Code,
        "discountType":   coupon.DiscountType,
        "discountValue":  float(coupon.DiscountValue),
        "discountAmount": discount,
        "message":        f"Coupon applied: -{discount:.2f} ILS",
    }
