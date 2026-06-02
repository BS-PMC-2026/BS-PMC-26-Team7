"""
US41 — Checkout
POST /api/checkout/preview  → price breakdown + validation (no side effects)
POST /api/checkout/pay      → create order, decrement stock, record payment,
                              queue receipt email
"""
import traceback
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from database import SessionLocal, get_db
from models.cart import CartItem
from models.coupon import Coupon, CouponRedemption
from models.inventory import Inventory
from models.order import Order, OrderItem
from models.payment import PaymentRecord
from models.product import Product
from schemas.checkout import CheckoutPreview, CheckoutLineItem, CheckoutRequest, PaymentResult
from services.pricing_service import (
    calculate_prices,
    luhn_check,
    detect_card_brand,
    validate_coupon,
)
from utils.jwt import get_current_user

router = APIRouter(prefix="/api/checkout", tags=["Checkout"])

_MOCK_DECLINE_NUMBERS = {"4000000000000002"}   # always-decline test card


# ── Helper: generate order number ─────────────────────────────────────────────

def _order_number() -> str:
    return "ORD-" + uuid.uuid4().hex[:10].upper()


# ── Helper: validate credit card ──────────────────────────────────────────────

def _validate_credit_card(cc, errors: List[str]) -> None:
    from datetime import date
    today = date.today()

    if cc.cardNumber in _MOCK_DECLINE_NUMBERS:
        errors.append("Card was declined (mock decline card number).")
        return

    if not luhn_check(cc.cardNumber):
        errors.append("Card number failed Luhn check — please check the card number.")

    if cc.expiryYear < today.year or (
        cc.expiryYear == today.year and cc.expiryMonth < today.month
    ):
        errors.append("Card has expired.")

    if len(cc.cvv) not in (3, 4):
        errors.append("CVV must be 3 or 4 digits.")


# ── Helper: resolve items from cart or explicit list ──────────────────────────

def _resolve_items(db: Session, user_id: int, req: CheckoutRequest) -> List[dict]:
    if req.items:
        return [{"productId": i["productId"], "quantity": i["quantity"]} for i in req.items]
    rows = db.query(CartItem).filter(CartItem.UserId == user_id).all()
    if not rows:
        raise HTTPException(status_code=400, detail="Cart is empty.")
    return [{"productId": r.ProductId, "quantity": r.Quantity} for r in rows]


# ── POST /api/checkout/preview ─────────────────────────────────────────────────

@router.post("/preview", response_model=CheckoutPreview)
def preview_checkout(
    req: CheckoutRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """No side effects — recalculates prices server-side and validates stock + coupon."""
    items = _resolve_items(db, current_user["user_id"], req)
    breakdown = calculate_prices(db, items, current_user["role"], req.couponCode, current_user["user_id"])

    errors: List[str] = []
    for l in breakdown.lines:
        if not l.isAvailable:
            errors.append(l.stockWarning or f"'{l.productName}' is unavailable.")

    if req.couponCode and not breakdown.coupon:
        _, coupon_error = validate_coupon(
            db, req.couponCode, current_user["user_id"],
            sum(l.lineTotal for l in breakdown.lines),
        )
        errors.append(coupon_error or "Invalid coupon.")

    line_items = [
        CheckoutLineItem(
            productId=l.productId,
            productName=l.productName,
            quantity=l.quantity,
            unitPriceOriginal=l.unitPriceOriginal,
            unitPriceAfterProductDiscount=l.unitPriceAfterProductDiscount,
            unitPriceAfterEmployeeDiscount=l.unitPriceAfterEmployeeDiscount,
            lineTotal=l.lineTotal,
            productDiscountPct=l.productDiscountPct,
            employeeDiscountPct=l.employeeDiscountPct,
        )
        for l in breakdown.lines
    ]

    return CheckoutPreview(
        items=line_items,
        originalSubtotal=breakdown.originalSubtotal,
        productDiscountTotal=breakdown.productDiscountTotal,
        employeeDiscountTotal=breakdown.employeeDiscountTotal,
        couponDiscountTotal=breakdown.couponDiscountTotal,
        finalTotal=breakdown.finalTotal,
        couponCode=breakdown.coupon.Code if breakdown.coupon else None,
        isValid=len(errors) == 0,
        errors=errors,
    )


# ── Receipt email background task ─────────────────────────────────────────────

def _send_receipt_bg(order_id: int, payment_record_id: int) -> None:
    """Queue and send order receipt email. Uses its own DB session (background task)."""
    db = SessionLocal()
    try:
        from services.receipt_email_service import send_order_receipt
        send_order_receipt(db, order_id, payment_record_id)
    except Exception:
        traceback.print_exc()
    finally:
        db.close()


# ── POST /api/checkout/pay ──────────────────────────────────────────────────────

@router.post("/pay", response_model=PaymentResult)
def pay(
    req: CheckoutRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Execute mock payment and create order.
    Stock is decremented atomically inside a DB transaction.
    Receipt email is queued as a background task (does not block response).
    """
    user_id   = current_user["user_id"]
    user_role = current_user["role"]

    # 1. Validate payment method fields
    # Only mock credit card is accepted here.
    # Real PayPal Sandbox uses /api/payments/paypal/create-order + capture-order.
    errors: List[str] = []
    if req.paymentMethod in ("credit_card", "mock_credit_card"):
        if not req.creditCard:
            raise HTTPException(status_code=400, detail="Credit card details required.")
        _validate_credit_card(req.creditCard, errors)
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown payment method: {req.paymentMethod}. "
                   "Use 'credit_card' for mock credit card, or use "
                   "/api/payments/paypal/* for real PayPal Sandbox.",
        )

    if errors:
        return PaymentResult(success=False, message="Payment validation failed.", errors=errors)

    # 2. Resolve and price items (authoritative — server-side only)
    items = _resolve_items(db, user_id, req)
    breakdown = calculate_prices(db, items, user_role, req.couponCode, user_id)

    for l in breakdown.lines:
        if not l.isAvailable:
            errors.append(l.stockWarning or f"'{l.productName}' is unavailable.")

    if errors:
        return PaymentResult(success=False, message="Some items cannot be purchased.", errors=errors)

    # 3. Atomically decrement stock inside transaction
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    try:
        for l in breakdown.lines:
            result = db.execute(
                text("""
                    UPDATE Inventory
                    SET AllocatedQuantity = AllocatedQuantity - :qty
                    WHERE ProductId = :pid AND AllocatedQuantity >= :qty
                """),
                {"qty": l.quantity, "pid": l.productId},
            )
            if result.rowcount == 0:
                db.rollback()
                return PaymentResult(
                    success=False,
                    message=f"Not enough stock for '{l.productName}'. "
                            "Another customer may have just purchased it.",
                    errors=[f"Insufficient stock for '{l.productName}'."],
                )

        # 4. Create Order
        order = Order(
            UserId=user_id,
            OrderNumber=_order_number(),
            Status="paid",
            Subtotal=breakdown.originalSubtotal,
            ProductDiscountTotal=breakdown.productDiscountTotal,
            EmployeeDiscountTotal=breakdown.employeeDiscountTotal,
            CouponDiscountTotal=breakdown.couponDiscountTotal,
            TotalAmount=breakdown.finalTotal,
            Currency="ILS",
            CouponCode=breakdown.coupon.Code if breakdown.coupon else None,
            PaymentMethod="credit_card",
            PaidAtUtc=now,
        )
        db.add(order)
        db.flush()   # get OrderId

        # 5. Create OrderItems (price snapshots)
        for l in breakdown.lines:
            db.add(OrderItem(
                OrderId=order.OrderId,
                ProductId=l.productId,
                ProductNameSnapshot=l.productName,
                UnitPriceOriginal=l.unitPriceOriginal,
                UnitPriceAfterProductDiscount=l.unitPriceAfterProductDiscount,
                UnitPriceAfterEmployeeDiscount=l.unitPriceAfterEmployeeDiscount,
                Quantity=l.quantity,
                LineSubtotal=l.lineSubtotal,
                LineDiscountTotal=l.lineDiscountTotal,
                LineTotal=l.lineTotal,
                EmployeeDiscountAppliedPercent=l.employeeDiscountPct,
                ProductDiscountAppliedPercent=l.productDiscountPct,
            ))

        # 6. Create PaymentRecord (mock credit card only)
        mock_tx    = "MOCK-CC-" + uuid.uuid4().hex.upper()
        card_last4 = req.creditCard.cardNumber[-4:]
        card_brand = detect_card_brand(req.creditCard.cardNumber)

        payment = PaymentRecord(
            OrderId=order.OrderId,
            UserId=user_id,
            PaymentMethod="credit_card",
            PaymentStatus="succeeded",
            Amount=breakdown.finalTotal,
            Currency="ILS",
            MockTransactionId=mock_tx,
            CardLast4=card_last4,
            CardBrand=card_brand,
            ProviderOrderId=None,
            ProviderCaptureId=None,
            ProviderStatus=None,
            InvoiceEmailStatus="queued",
            PaidAtUtc=now,
        )
        db.add(payment)
        db.flush()

        # 7. Record coupon redemption
        if breakdown.coupon:
            db.add(CouponRedemption(
                CouponId=breakdown.coupon.CouponId,
                UserId=user_id,
                OrderId=order.OrderId,
                DiscountApplied=breakdown.couponDiscountTotal,
            ))
            breakdown.coupon.CurrentUseCount += 1

        # 8. Clear purchased cart items (if paying from cart, not quick-buy)
        if not req.items:
            db.query(CartItem).filter(CartItem.UserId == user_id).delete()

        db.commit()

    except Exception:
        db.rollback()
        traceback.print_exc()
        return PaymentResult(success=False, message="Payment processing failed. Please try again.", errors=[])

    # 9. Queue receipt email in background (does NOT block this response)
    background_tasks.add_task(_send_receipt_bg, order.OrderId, payment.PaymentRecordId)

    return PaymentResult(
        success=True,
        orderId=order.OrderId,
        orderNumber=order.OrderNumber,
        totalAmount=float(order.TotalAmount),
        currency="ILS",
        paymentMethod="credit_card",
        mockTransactionId=mock_tx,
        providerOrderId=None,
        providerCaptureId=None,
        message="Payment successful! Your order has been placed.",
    )
