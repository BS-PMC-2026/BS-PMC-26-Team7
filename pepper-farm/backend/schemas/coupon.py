from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class CouponCreate(BaseModel):
    code:               str             = Field(..., min_length=1, max_length=50)
    description:        Optional[str]   = None
    discountType:       str             = "percentage"   # percentage / fixed_amount
    discountValue:      float           = Field(..., gt=0)
    active:             bool            = True
    startsAtUtc:        Optional[datetime] = None
    endsAtUtc:          Optional[datetime] = None
    maxTotalUses:       Optional[int]   = None
    maxUsesPerUser:     Optional[int]   = None
    minimumOrderAmount: Optional[float] = None


class CouponResponse(BaseModel):
    couponId:           int
    code:               str
    description:        Optional[str]   = None
    discountType:       str
    discountValue:      float
    active:             bool
    startsAtUtc:        Optional[datetime] = None
    endsAtUtc:          Optional[datetime] = None
    maxTotalUses:       Optional[int]   = None
    maxUsesPerUser:     Optional[int]   = None
    currentUseCount:    int
    minimumOrderAmount: Optional[float] = None
    createdAtUtc:       datetime
    updatedAtUtc:       datetime

    class Config:
        from_attributes = True


class CouponValidateRequest(BaseModel):
    code:       str
    subtotal:   float = Field(..., ge=0)
