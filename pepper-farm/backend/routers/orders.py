"""
US41 — Order History
GET /api/orders        → own orders list
GET /api/orders/{id}   → own order detail
"""
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models.order import Order, OrderItem
from models.payment import PaymentRecord
from schemas.order import OrderResponse, OrderItemResponse, PaymentRecordResponse
from utils.jwt import get_current_user, require_role

router = APIRouter(prefix="/api/orders", tags=["Orders"])


def _serialize_order(order: Order, items: list, payment: PaymentRecord | None) -> OrderResponse:
    return OrderResponse(
        orderId=order.OrderId,
        orderNumber=order.OrderNumber,
        status=order.Status,
        subtotal=float(order.Subtotal),
        productDiscountTotal=float(order.ProductDiscountTotal),
        employeeDiscountTotal=float(order.EmployeeDiscountTotal),
        couponDiscountTotal=float(order.CouponDiscountTotal),
        totalAmount=float(order.TotalAmount),
        currency=order.Currency,
        couponCode=order.CouponCode,
        paymentMethod=order.PaymentMethod,
        createdAtUtc=order.CreatedAtUtc,
        paidAtUtc=order.PaidAtUtc,
        items=[
            OrderItemResponse(
                orderItemId=i.OrderItemId,
                productId=i.ProductId,
                productNameSnapshot=i.ProductNameSnapshot,
                unitPriceOriginal=float(i.UnitPriceOriginal),
                unitPriceAfterProductDiscount=float(i.UnitPriceAfterProductDiscount),
                unitPriceAfterEmployeeDiscount=float(i.UnitPriceAfterEmployeeDiscount),
                quantity=i.Quantity,
                lineSubtotal=float(i.LineSubtotal),
                lineDiscountTotal=float(i.LineDiscountTotal),
                lineTotal=float(i.LineTotal),
                employeeDiscountAppliedPercent=float(i.EmployeeDiscountAppliedPercent) if i.EmployeeDiscountAppliedPercent else None,
                productDiscountAppliedPercent=float(i.ProductDiscountAppliedPercent) if i.ProductDiscountAppliedPercent else None,
            )
            for i in items
        ],
        payment=PaymentRecordResponse(
            paymentRecordId=payment.PaymentRecordId,
            paymentMethod=payment.PaymentMethod,
            paymentStatus=payment.PaymentStatus,
            amount=float(payment.Amount),
            currency=payment.Currency,
            mockTransactionId=payment.MockTransactionId,
            cardLast4=payment.CardLast4,
            cardBrand=payment.CardBrand,
            invoiceEmailStatus=payment.InvoiceEmailStatus,
            createdAtUtc=payment.CreatedAtUtc,
            paidAtUtc=payment.PaidAtUtc,
        ) if payment else None,
    )


@router.get("", response_model=List[OrderResponse])
def list_my_orders(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    orders = db.query(Order).filter(
        Order.UserId == current_user["user_id"]
    ).order_by(Order.CreatedAtUtc.desc()).all()

    result = []
    for order in orders:
        items   = db.query(OrderItem).filter(OrderItem.OrderId == order.OrderId).all()
        payment = db.query(PaymentRecord).filter(PaymentRecord.OrderId == order.OrderId).first()
        result.append(_serialize_order(order, items, payment))
    return result


@router.get("/all", response_model=List[OrderResponse])
def list_all_orders(
    db: Session = Depends(get_db),
    _: dict = Depends(require_role("FarmManager")),
):
    """FarmManager: see every order from every user."""
    from models.user import User
    orders = (
        db.query(Order)
        .order_by(Order.CreatedAtUtc.desc())
        .limit(500)
        .all()
    )
    result = []
    for order in orders:
        items   = db.query(OrderItem).filter(OrderItem.OrderId == order.OrderId).all()
        payment = db.query(PaymentRecord).filter(PaymentRecord.OrderId == order.OrderId).first()
        serialised = _serialize_order(order, items, payment)
        # Attach buyer name / email so manager UI can display them
        user = db.query(User).filter(User.UserId == order.UserId).first()
        serialised_dict = serialised.model_dump()
        serialised_dict["buyerName"]  = user.FullName if user else "Unknown"
        serialised_dict["buyerEmail"] = user.Email    if user else ""
        result.append(serialised_dict)
    return result


@router.get("/{order_id}", response_model=OrderResponse)
def get_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    order = db.query(Order).filter(
        Order.OrderId == order_id,
        Order.UserId  == current_user["user_id"],   # users can only see their own orders
    ).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found.")

    items   = db.query(OrderItem).filter(OrderItem.OrderId == order.OrderId).all()
    payment = db.query(PaymentRecord).filter(PaymentRecord.OrderId == order.OrderId).first()
    return _serialize_order(order, items, payment)
