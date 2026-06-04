from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class OrderItemResponse(BaseModel):
    orderItemId:                    int
    productId:                      Optional[int]  = None
    productNameSnapshot:            str
    unitPriceOriginal:              float
    unitPriceAfterProductDiscount:  float
    unitPriceAfterEmployeeDiscount: float
    quantity:                       int
    lineSubtotal:                   float
    lineDiscountTotal:              float
    lineTotal:                      float
    employeeDiscountAppliedPercent: Optional[float] = None
    productDiscountAppliedPercent:  Optional[float] = None

    class Config:
        from_attributes = True


class PaymentRecordResponse(BaseModel):
    paymentRecordId:    int
    paymentMethod:      str
    paymentStatus:      str
    amount:             float
    currency:           str
    mockTransactionId:  Optional[str]  = None
    cardLast4:          Optional[str]  = None
    cardBrand:          Optional[str]  = None
    invoiceEmailStatus: str
    createdAtUtc:       datetime
    paidAtUtc:          Optional[datetime] = None

    class Config:
        from_attributes = True


class OrderResponse(BaseModel):
    orderId:                int
    orderNumber:            str
    status:                 str
    subtotal:               float
    productDiscountTotal:   float
    employeeDiscountTotal:  float
    couponDiscountTotal:    float
    totalAmount:            float
    currency:               str
    couponCode:             Optional[str]  = None
    paymentMethod:          str
    createdAtUtc:           datetime
    paidAtUtc:              Optional[datetime] = None
    items:                  List[OrderItemResponse] = []
    payment:                Optional[PaymentRecordResponse] = None
    # Manager-only fields (populated by /api/orders/all)
    buyerName:              Optional[str]  = None
    buyerEmail:             Optional[str]  = None

    class Config:
        from_attributes = True
