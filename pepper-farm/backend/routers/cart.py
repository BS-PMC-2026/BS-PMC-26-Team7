"""
US41 — Shopping Cart
GET    /api/cart              → view cart with live prices and stock
POST   /api/cart/items        → add item to cart
PUT    /api/cart/items/{id}   → update quantity
DELETE /api/cart/items/{id}   → remove item
DELETE /api/cart/clear        → empty cart
"""
import traceback
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.orm import Session

from database import get_db
from models.cart import CartItem
from schemas.cart import CartItemAdd, CartItemUpdate, CartSummary, CartLineItem
from services.pricing_service import calculate_prices
from utils.jwt import get_current_user

router = APIRouter(prefix="/api/cart", tags=["Cart"])

_ALLOWED_ROLES = {"Visitor", "Worker", "FarmManager"}


def _assert_cart_role(current_user: dict) -> None:
    if current_user["role"] not in _ALLOWED_ROLES:
        raise HTTPException(status_code=403, detail="Access denied.")


def _build_summary(db: Session, user_id: int, user_role: str, coupon_code: str | None = None) -> CartSummary:
    rows = db.query(CartItem).filter(CartItem.UserId == user_id).all()
    items = [{"productId": r.ProductId, "quantity": r.Quantity} for r in rows]
    if not items:
        return CartSummary(
            items=[],
            originalSubtotal=0, productDiscountTotal=0, employeeDiscountTotal=0,
            couponDiscountTotal=0, finalTotal=0, hasBlockingIssues=False,
        )

    breakdown = calculate_prices(db, items, user_role, coupon_code, user_id)

    line_items: List[CartLineItem] = []
    for l in breakdown.lines:
        # Map cart item id
        cart_row = next((r for r in rows if r.ProductId == l.productId), None)
        line_items.append(CartLineItem(
            cartItemId=cart_row.CartItemId if cart_row else 0,
            productId=l.productId,
            productName=l.productName,
            quantity=l.quantity,
            unitPriceOriginal=l.unitPriceOriginal,
            unitPriceAfterDiscount=l.unitPriceAfterProductDiscount,
            unitPriceForUser=l.unitPriceAfterEmployeeDiscount,
            lineTotal=l.lineTotal,
            availableStock=l.availableStock,
            isAvailable=l.isAvailable,
            stockWarning=l.stockWarning,
            discountPct=l.productDiscountPct,
            employeeDiscountPct=l.employeeDiscountPct,
        ))

    from schemas.cart import CouponValidation
    coupon_info = None
    if breakdown.coupon:
        coupon_info = CouponValidation(
            valid=True,
            couponCode=breakdown.coupon.Code,
            discountType=breakdown.coupon.DiscountType,
            discountValue=float(breakdown.coupon.DiscountValue),
            discountAmount=breakdown.couponDiscountTotal,
        )
    elif coupon_code:
        coupon_info = CouponValidation(valid=False, message="Invalid or expired coupon.")

    return CartSummary(
        items=line_items,
        originalSubtotal=breakdown.originalSubtotal,
        productDiscountTotal=breakdown.productDiscountTotal,
        employeeDiscountTotal=breakdown.employeeDiscountTotal,
        couponDiscountTotal=breakdown.couponDiscountTotal,
        finalTotal=breakdown.finalTotal,
        coupon=coupon_info,
        hasBlockingIssues=breakdown.hasBlockingIssues,
    )


@router.get("", response_model=CartSummary)
def get_cart(
    coupon: str | None = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    _assert_cart_role(current_user)
    return _build_summary(db, current_user["user_id"], current_user["role"], coupon)


@router.post("/items", response_model=CartSummary, status_code=201)
def add_to_cart(
    payload: CartItemAdd,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    _assert_cart_role(current_user)
    user_id = current_user["user_id"]

    existing = db.query(CartItem).filter(
        CartItem.UserId    == user_id,
        CartItem.ProductId == payload.productId,
    ).first()

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    if existing:
        existing.Quantity    = existing.Quantity + payload.quantity
        existing.UpdatedAtUtc = now
    else:
        db.add(CartItem(UserId=user_id, ProductId=payload.productId, Quantity=payload.quantity))

    try:
        db.commit()
    except (IntegrityError, OperationalError) as e:
        db.rollback()
        if "foreign key" in str(e).lower() or "reference" in str(e).lower():
            raise HTTPException(status_code=404, detail="Product not found.")
        raise HTTPException(status_code=400, detail="Could not add item to cart.")
    except Exception:
        db.rollback()
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Unexpected error.")

    return _build_summary(db, user_id, current_user["role"])


@router.put("/items/{cart_item_id}", response_model=CartSummary)
def update_cart_item(
    cart_item_id: int,
    payload: CartItemUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    _assert_cart_role(current_user)
    user_id = current_user["user_id"]

    item = db.query(CartItem).filter(
        CartItem.CartItemId == cart_item_id,
        CartItem.UserId     == user_id,
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Cart item not found.")

    item.Quantity     = payload.quantity
    item.UpdatedAtUtc = datetime.now(timezone.utc).replace(tzinfo=None)
    db.commit()
    return _build_summary(db, user_id, current_user["role"])


@router.delete("/items/{cart_item_id}", response_model=CartSummary)
def remove_cart_item(
    cart_item_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    _assert_cart_role(current_user)
    user_id = current_user["user_id"]

    item = db.query(CartItem).filter(
        CartItem.CartItemId == cart_item_id,
        CartItem.UserId     == user_id,
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Cart item not found.")

    db.delete(item)
    db.commit()
    return _build_summary(db, user_id, current_user["role"])


@router.delete("/clear")
def clear_cart(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    _assert_cart_role(current_user)
    db.query(CartItem).filter(CartItem.UserId == current_user["user_id"]).delete()
    db.commit()
    return {"message": "Cart cleared."}
