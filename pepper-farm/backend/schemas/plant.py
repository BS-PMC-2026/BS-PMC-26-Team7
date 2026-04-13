from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import datetime


class PlantCreate(BaseModel):
    PlantCode: str = Field(..., min_length=1, max_length=100)
    PepperId: int
    ZoneId: Optional[int] = None
    PlantedAt: Optional[datetime] = None
    Status: Optional[str] = Field(None, max_length=50)
    Notes: Optional[str] = Field(None, max_length=500)
    IsActive: bool = True

    @field_validator("PlantCode")
    @classmethod
    def validate_plant_code(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("PlantCode cannot be empty.")
        return value

    @field_validator("PepperId")
    @classmethod
    def validate_pepper_id(cls, value: int) -> int:
        if value <= 0:
            raise ValueError("PepperId must be a positive integer.")
        return value

    @field_validator("ZoneId")
    @classmethod
    def validate_zone_id(cls, value: Optional[int]) -> Optional[int]:
        if value is not None and value <= 0:
            raise ValueError("ZoneId must be a positive integer.")
        return value

    @field_validator("Status")
    @classmethod
    def validate_status(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        value = value.strip()
        return value or None

    @field_validator("Notes")
    @classmethod
    def validate_notes(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        value = value.strip()
        return value or None


class PlantResponse(BaseModel):
    PlantId: int
    PlantCode: str
    PepperId: int
    ZoneId: Optional[int] = None
    PlantedAt: Optional[datetime] = None
    Status: Optional[str] = None
    Notes: Optional[str] = None
    IsActive: bool

    model_config = {"from_attributes": True}