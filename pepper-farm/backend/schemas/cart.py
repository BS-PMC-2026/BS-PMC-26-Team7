from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class CartItemAdd(BaseModel):
    productId: int = Field(..., ge=1)
    quantity:  int = Field(..., ge=1, le=999)


class CartItemUpdate(BaseModel):
    quantity: int = Field(..., ge=1, le=999)


class CartLineItem(BaseModel):
    cartItemId:             int
    productId:              int
    productName:            str
    imageUrl:               Optional[str]  = None
    quantity:               int
    unitPriceOriginal:      float          # base price from DB
    unitPriceAfterDiscount: float          # after US38 product discount
    unitPriceForUser:       float          # after employee discount (if Worker)
    lineTotal:              float
    availableStock:         int            # current AllocatedQuantity from Inventory
    isAvailable:            bool           # product IsActive and stock > 0
    stockWarning:           Optional[str]  = None  # "out of stock" / "only N left" etc.
    discountPct:            Optional[float]= None  # product discount % if active
    employeeDiscountPct:    Optional[float]= None  # employee discount % if Worker


class CouponValidation(BaseModel):
    valid:          bool
    couponCode:     Optional[str]   = None
    discountType:   Optional[str]   = None  # percentage / fixed_amount
    discountValue:  Optional[float] = None
    discountAmount: Optional[float] = None  # computed against current subtotal
    message:        Optional[str]   = None


class CartSummary(BaseModel):
    items:                  List[CartLineItem]
    originalSubtotal:       float
    productDiscountTotal:   float
    employeeDiscountTotal:  float
    couponDiscountTotal:    float
    finalTotal:             float
    coupon:                 Optional[CouponValidation] = None
    hasBlockingIssues:      bool  = False   # True if any item cannot be purchased
    currency:               str   = "ILS"
