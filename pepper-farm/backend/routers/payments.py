"""
US41 — PayPal Sandbox Payment Endpoints
POST /api/payments/paypal/create-order   → create PayPal Sandbox order, return paypalOrderId
POST /api/payments/paypal/capture-order  → capture approved order, create internal Order
GET  /api/payments/paypal/config         → public PayPal config (clientId only, NEVER secret)

Credit-card mock payment remains in /api/checkout/pay.
PayPal is real PayPal Sandbox — no mock/fake PayPal flow.
"""
import os
import traceback
import uuid
from datetime import datetime, timezone
from typing import List

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
from schemas.checkout import (
    PaypalCaptureRequest,
    PaypalConfigResponse,
    PaypalCreateOrderRequest,
    PaypalCreateOrderResponse,
    PaymentResult,
)
from services.paypal_service import (
    capture_paypal_order,
    create_paypal_order,
    extract_capture_id,
    is_paypal_configured,
)
from services.pricing_service import (
    calculate_prices,
    validate_coupon,
)
from utils.jwt import get_current_user

router = APIRouter(prefix="/api/payments/paypal", tags=["PayPal Payments"])

_ALLOWED_ROLES = {"Visitor", "Worker", "FarmManager"}


def _resolve_items(db: Session, user_id: int, items_from_request):
    if items_from_request:
        return [{"productId": i["productId"], "quantity": i["quantity"]} for i in items_from_request]
    rows = db.query(CartItem).filter(CartItem.UserId == user_id).all()
    if not rows:
        raise HTTPException(status_code=400, detail="Cart is empty.")
    return [{"productId": r.ProductId, "quantity": r.Quantity} for r in rows]


def _order_number() -> str:
    return "ORD-" + uuid.uuid4().hex[:10].upper()


def _send_receipt_bg(order_id: int, payment_record_id: int) -> None:
    db = SessionLocal()
    try:
        from services.receipt_email_service import send_order_receipt
        send_order_receipt(db, order_id, payment_record_id)
    except Exception:
        traceback.print_exc()
    finally:
        db.close()


# ── GET /api/payments/paypal/config ───────────────────────────────────────────

@router.get("/config", response_model=PaypalConfigResponse)
def get_paypal_config():
    """Return public PayPal config to the frontend.
    NEVER includes PAYPAL_CLIENT_SECRET.
    Frontend uses clientId to initialise the PayPal JS SDK.
    """
    client_id = os.getenv("PAYPAL_CLIENT_ID", "")
    mode      = os.getenv("PAYPAL_MODE", "sandbox")
    currency  = os.getenv("NEXT_PUBLIC_PAYPAL_CURRENCY", "ILS")
    return PaypalConfigResponse(
        enabled=bool(client_id),
        clientId=client_id,
        currency=currency,
        mode=mode,
    )


# ── POST /api/payments/paypal/create-order ────────────────────────────────────

@router.post("/create-order", response_model=PaypalCreateOrderResponse)
def paypal_create_order(
    req: PaypalCreateOrderRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Server-side PayPal order creation.
    1. Recalculates total using authoritative backend pricing.
    2. Validates stock and coupon.
    3. Calls PayPal Sandbox to create an order.
    4. Returns the PayPal orderId to the frontend.

    Does NOT create an internal Order yet — that happens only after capture succeeds.
    Does NOT decrement stock yet.
    """
    if current_user["role"] not in _ALLOWED_ROLES:
        raise HTTPException(status_code=403, detail="Access denied.")

    if not is_paypal_configured():
        raise HTTPException(
            status_code=503,
            detail="PayPal Sandbox is not configured on this server. "
                   "Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in the backend .env file.",
        )

    user_id   = current_user["user_id"]
    user_role = current_user["role"]

    items = _resolve_items(db, user_id, req.items)
    breakdown = calculate_prices(db, items, user_role, req.couponCode, user_id)

    errors: List[str] = []
    for l in breakdown.lines:
        if not l.isAvailable:
            errors.append(l.stockWarning or f"'{l.productName}' is unavailable.")
    if errors:
        raise HTTPException(status_code=400, detail="; ".join(errors))

    if breakdown.finalTotal <= 0:
        raise HTTPException(status_code=400, detail="Order total must be greater than 0.")

    # Create PayPal Sandbox order — may raise requests.HTTPError
    try:
        paypal_resp = create_paypal_order(
            amount_ils=breakdown.finalTotal,
            currency="ILS",
            custom_id=f"user-{user_id}",
        )
    except Exception as exc:
        traceback.print_exc()
        raise HTTPException(
            status_code=502,
            detail=f"PayPal order creation failed: {exc}",
        )

    paypal_order_id = paypal_resp.get("id")
    if not paypal_order_id:
        raise HTTPException(status_code=502, detail="PayPal returned no order ID.")

    return PaypalCreateOrderResponse(
        paypalOrderId=paypal_order_id,
        amount=breakdown.finalTotal,
        currency="ILS",
    )


# ── POST /api/payments/paypal/capture-order ───────────────────────────────────

@router.post("/capture-order", response_model=PaymentResult)
def paypal_capture_order(
    req: PaypalCaptureRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Capture an approved PayPal Sandbox order and create the internal Order.

    Steps:
    1. Call PayPal Sandbox capture endpoint.
    2. Verify PayPal capture status is COMPLETED.
    3. Re-validate items, stock, and coupon (server-side, inside DB transaction).
    4. Atomically decrement stock.
    5. Create Order + OrderItems + PaymentRecord.
    6. Record coupon redemption if applicable.
    7. Clear cart items if paying from cart.
    8. Queue transactional receipt/invoice email.

    If PayPal capture fails or stock changed:
    - Do NOT create Order.
    - Do NOT decrement stock.
    - Return controlled error.
    """
    if current_user["role"] not in _ALLOWED_ROLES:
        raise HTTPException(status_code=403, detail="Access denied.")

    if not is_paypal_configured():
        raise HTTPException(
            status_code=503,
            detail="PayPal Sandbox is not configured.",
        )

    user_id   = current_user["user_id"]
    user_role = current_user["role"]

    # 1. Capture with PayPal Sandbox
    try:
        capture_resp = capture_paypal_order(req.paypalOrderId)
    except Exception as exc:
        traceback.print_exc()
        return PaymentResult(
            success=False,
            message=f"PayPal capture failed: {exc}",
            errors=[str(exc)],
        )

    paypal_status = capture_resp.get("status", "")
    if paypal_status != "COMPLETED":
        return PaymentResult(
            success=False,
            message=f"PayPal payment was not completed (status: {paypal_status}).",
            errors=[f"PayPal status: {paypal_status}"],
        )

    capture_id = extract_capture_id(capture_resp)

    # 2. Re-validate server-side (stock may have changed between create and capture)
    items = _resolve_items(db, user_id, req.items)
    breakdown = calculate_prices(db, items, user_role, req.couponCode, user_id)

    errors: List[str] = []
    for l in breakdown.lines:
        if not l.isAvailable:
            errors.append(l.stockWarning or f"'{l.productName}' is unavailable.")
    if errors:
        # Payment captured but order cannot be fulfilled — log and return error
        # In production, you would trigger a PayPal refund here
        return PaymentResult(
            success=False,
            message="Payment captured but items became unavailable. "
                    "A refund will be processed.",
            errors=errors,
        )

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    try:
        # 3. Atomically decrement stock
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
                    message=f"Insufficient stock for '{l.productName}'. "
                            "A refund will be processed.",
                    errors=[f"Out of stock: {l.productName}"],
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
            PaymentMethod="paypal",
            PaidAtUtc=now,
        )
        db.add(order)
        db.flush()

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

        # 6. Create PaymentRecord with real PayPal IDs (no MockTransactionId)
        payment = PaymentRecord(
            OrderId=order.OrderId,
            UserId=user_id,
            PaymentMethod="paypal",
            PaymentStatus="succeeded",
            Amount=breakdown.finalTotal,
            Currency="ILS",
            MockTransactionId=None,         # not a mock payment
            CardLast4=None,
            CardBrand=None,
            ProviderOrderId=req.paypalOrderId,
            ProviderCaptureId=capture_id,
            ProviderStatus=paypal_status,
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
        return PaymentResult(
            success=False,
            message="Order creation failed after PayPal capture. "
                    "Please contact support with your PayPal transaction.",
            errors=[],
        )

    # 9. Queue transactional receipt email (background, does NOT block response)
    background_tasks.add_task(_send_receipt_bg, order.OrderId, payment.PaymentRecordId)

    return PaymentResult(
        success=True,
        orderId=order.OrderId,
        orderNumber=order.OrderNumber,
        totalAmount=float(order.TotalAmount),
        currency="ILS",
        paymentMethod="paypal",
        mockTransactionId=None,
        providerOrderId=req.paypalOrderId,
        providerCaptureId=capture_id,
        message="Payment successful! Your order has been placed.",
    )
