from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Optional
from datetime import datetime, timezone


class ProductCreate(BaseModel):
    ProductName: str = Field(..., min_length=1, max_length=150)
    ProductDescription: Optional[str] = Field(None, max_length=1000)
    Category: Optional[str] = Field(None, max_length=100)
    Price: float = Field(..., ge=0)
    ImageUrl: Optional[str] = Field(None, max_length=500)
    PepperId: Optional[int] = Field(None, ge=1)
    IsActive: bool = True
    DiscountPercentage: float = Field(default=0.0, ge=0, le=100)
    DiscountActive: bool = False
    DiscountStartDate: Optional[datetime] = None
    DiscountEndDate: Optional[datetime] = None

    @field_validator("ProductName")
    @classmethod
    def validate_product_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("ProductName cannot be empty.")
        return value

    @field_validator("ProductDescription")
    @classmethod
    def validate_description(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        value = value.strip()
        return value or None

    @field_validator("Category")
    @classmethod
    def validate_category(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        value = value.strip()
        return value or None

    @field_validator("ImageUrl")
    @classmethod
    def validate_image_url(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        value = value.strip()
        if value and not (
            value.startswith("http://")
            or value.startswith("https://")
            or value.startswith("/uploads/")
        ):
            raise ValueError("ImageUrl must start with http://, https://, or /uploads/")
        return value or None

    @model_validator(mode="after")
    def validate_discount_rules(self) -> "ProductCreate":
        if self.DiscountActive and self.DiscountPercentage <= 0:
            raise ValueError(
                "DiscountPercentage must be greater than 0 when discount is active."
            )
        if self.DiscountStartDate and self.DiscountEndDate:
            if self.DiscountEndDate <= self.DiscountStartDate:
                raise ValueError("DiscountEndDate must be after DiscountStartDate.")
        return self


class ProductResponse(BaseModel):
    ProductId: int
    ProductName: str
    ProductDescription: Optional[str] = None
    Category: Optional[str] = None
    Price: float
    FinalPrice: float = 0.0
    ImageUrl: Optional[str] = None
    PepperId: Optional[int] = None
    IsActive: bool
    AllocatedQuantity: int = 0
    DiscountPercentage: float = 0.0
    DiscountActive: bool = False
    DiscountStartDate: Optional[datetime] = None
    DiscountEndDate: Optional[datetime] = None
    DiscountIsCurrentlyValid: bool = False

    class Config:
        from_attributes = True

    @field_validator("DiscountPercentage", mode="before")
    @classmethod
    def coerce_discount_percentage(cls, v):
        if v is None:
            return 0.0
        return float(v)

    @model_validator(mode="after")
    def compute_discount_validity(self) -> "ProductResponse":
        pct = float(self.DiscountPercentage or 0)
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        valid = (
            self.DiscountActive
            and pct > 0
            and (self.DiscountStartDate is None or self.DiscountStartDate <= now)
            and (self.DiscountEndDate is None or self.DiscountEndDate >= now)
        )
        self.DiscountIsCurrentlyValid = valid
        if valid:
            self.FinalPrice = round(float(self.Price) * (1 - pct / 100), 2)
        else:
            self.FinalPrice = float(self.Price)
        return self
