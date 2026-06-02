from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class EmployeeDiscountSettingResponse(BaseModel):
    settingId:              int
    globalDiscountPercent:  float
    active:                 bool
    updatedAtUtc:           datetime

    class Config:
        from_attributes = True


class EmployeeDiscountSettingUpdate(BaseModel):
    globalDiscountPercent: float = Field(..., ge=0, le=100)
    active:                bool  = True


class ProductOverrideCreate(BaseModel):
    productId:              int  = Field(..., ge=1)
    mode:                   str  = "use_global"   # use_global / excluded / custom_percent
    customDiscountPercent:  Optional[float] = Field(None, ge=0, le=100)


class ProductOverrideResponse(BaseModel):
    overrideId:             int
    productId:              int
    productName:            Optional[str]   = None
    mode:                   str
    customDiscountPercent:  Optional[float] = None
    updatedAtUtc:           datetime

    class Config:
        from_attributes = True


class EmployeeDiscountInfoResponse(BaseModel):
    """Returned to workers showing what discount applies to each product in their cart."""
    globalDiscountPercent:  float
    productOverrides:       List[ProductOverrideResponse] = []
