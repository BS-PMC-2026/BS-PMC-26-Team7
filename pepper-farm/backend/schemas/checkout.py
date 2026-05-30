from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
import re


# ── Credit-card input ─────────────────────────────────────────────────────────

class CreditCardPayload(BaseModel):
    cardholderName: str = Field(..., min_length=2, max_length=100)
    cardNumber:     str = Field(..., min_length=16, max_length=16)  # exactly 16 digits after stripping spaces
    expiryMonth:    int = Field(..., ge=1, le=12)
    expiryYear:     int = Field(..., ge=2000)
    cvv:            str = Field(..., min_length=3, max_length=4)

    @field_validator("cardNumber")
    @classmethod
    def digits_only(cls, v: str) -> str:
        cleaned = re.sub(r"\s|-", "", v)
        if not cleaned.isdigit():
            raise ValueError("Card number must contain only digits.")
        return cleaned

    @field_validator("cvv")
    @classmethod
    def cvv_digits(cls, v: str) -> str:
        if not v.isdigit():
            raise ValueError("CVV must contain only digits.")
        return v


# ── Checkout request — mock credit card only ──────────────────────────────────

class CheckoutRequest(BaseModel):
    couponCode:    Optional[str]               = None
    paymentMethod: str                         = "credit_card"
    creditCard:    Optional[CreditCardPayload] = None
    items:         Optional[List[dict]]        = None


# ── PayPal-specific request schemas ──────────────────────────────────────────

class PaypalCreateOrderRequest(BaseModel):
    couponCode: Optional[str]        = None
    items:      Optional[List[dict]] = None


class PaypalCaptureRequest(BaseModel):
    paypalOrderId: str = Field(..., min_length=1)
    couponCode:    Optional[str]        = None
    items:         Optional[List[dict]] = None


class PaypalCreateOrderResponse(BaseModel):
    paypalOrderId: str
    amount:        float
    currency:      str = "ILS"


class PaypalConfigResponse(BaseModel):
    enabled:  bool
    clientId: str
    currency: str
    mode:     str


# ── Preview / breakdown ───────────────────────────────────────────────────────

class CheckoutLineItem(BaseModel):
    productId:                      int
    productName:                    str
    quantity:                       int
    unitPriceOriginal:              float
    unitPriceAfterProductDiscount:  float
    unitPriceAfterEmployeeDiscount: float
    lineTotal:                      float
    productDiscountPct:             Optional[float] = None
    employeeDiscountPct:            Optional[float] = None


class CheckoutPreview(BaseModel):
    items:                  List[CheckoutLineItem]
    originalSubtotal:       float
    productDiscountTotal:   float
    employeeDiscountTotal:  float
    couponDiscountTotal:    float
    finalTotal:             float
    couponCode:             Optional[str]   = None
    currency:               str             = "ILS"
    isValid:                bool            = True
    errors:                 List[str]       = []


# ── Payment response ──────────────────────────────────────────────────────────

class PaymentResult(BaseModel):
    success:           bool
    orderId:           Optional[int]   = None
    orderNumber:       Optional[str]   = None
    totalAmount:       Optional[float] = None
    currency:          str             = "ILS"
    paymentMethod:     Optional[str]   = None
    mockTransactionId: Optional[str]   = None
    providerOrderId:   Optional[str]   = None
    providerCaptureId: Optional[str]   = None
    message:           str             = ""
    errors:            List[str]       = []
