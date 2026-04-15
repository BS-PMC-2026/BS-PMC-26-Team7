from pydantic import BaseModel, Field, field_validator
from typing import Optional


class ProductCreate(BaseModel):
    ProductName: str = Field(..., min_length=1, max_length=150)
    ProductDescription: Optional[str] = Field(None, max_length=1000)
    Category: Optional[str] = Field(None, max_length=100)
    Price: float = Field(..., ge=0)
    ImageUrl: Optional[str] = Field(None, max_length=500)
    PepperId: Optional[int] = Field(None, ge=1)
    IsActive: bool = True

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


class ProductResponse(BaseModel):
    ProductId: int
    ProductName: str
    ProductDescription: Optional[str] = None
    Category: Optional[str] = None
    Price: float
    ImageUrl: Optional[str] = None
    PepperId: Optional[int] = None
    IsActive: bool

    class Config:
        from_attributes = True