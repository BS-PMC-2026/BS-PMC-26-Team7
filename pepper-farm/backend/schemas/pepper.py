from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Optional


class PepperCreate(BaseModel):
    PepperName: str = Field(..., min_length=1, max_length=100)
    ScientificName: Optional[str] = Field(None, max_length=150)
    HeatLevelScovilleMin: Optional[int] = None
    HeatLevelScovilleMax: Optional[int] = None
    OptimalSoilMoistureMin: Optional[float] = None
    OptimalSoilMoistureMax: Optional[float] = None
    OptimalTempMinC: Optional[float] = None
    OptimalTempMaxC: Optional[float] = None
    OptimalSunlightHours: Optional[float] = None
    ImageUrl: Optional[str] = Field(None, max_length=500)
    Zone: Optional[str] = Field(None, max_length=500)
    GeneralDescription: Optional[str] = Field(None, max_length=1000)
    IsActive: bool = True

    @field_validator("PepperName")
    @classmethod
    def validate_pepper_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("PepperName cannot be empty.")
        return value

    @field_validator("ScientificName")
    @classmethod
    def validate_scientific_name(cls, value: Optional[str]) -> Optional[str]:
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

    @field_validator("Zone")
    @classmethod
    def validate_zone(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        value = value.strip()
        return value or None

    @field_validator("GeneralDescription")
    @classmethod
    def validate_description(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        value = value.strip()
        return value or None

    @field_validator("HeatLevelScovilleMin", "HeatLevelScovilleMax")
    @classmethod
    def validate_scoville(cls, value: Optional[int]) -> Optional[int]:
        if value is not None and value < 0:
            raise ValueError("Scoville values cannot be negative.")
        return value

    @field_validator("OptimalSoilMoistureMin", "OptimalSoilMoistureMax")
    @classmethod
    def validate_soil_moisture(cls, value: Optional[float]) -> Optional[float]:
        if value is not None and (value < 0 or value > 100):
            raise ValueError("Soil moisture must be between 0 and 100.")
        return value

    @field_validator("OptimalTempMinC", "OptimalTempMaxC")
    @classmethod
    def validate_temperature(cls, value: Optional[float]) -> Optional[float]:
        if value is not None and (value < -50 or value > 80):
            raise ValueError("Temperature must be between -50 and 80 Celsius.")
        return value

    @field_validator("OptimalSunlightHours")
    @classmethod
    def validate_sunlight_hours(cls, value: Optional[float]) -> Optional[float]:
        if value is not None and (value < 0 or value > 24):
            raise ValueError("Sunlight hours must be between 0 and 24.")
        return value

    @model_validator(mode="after")
    def validate_ranges(self):
        if (
            self.HeatLevelScovilleMin is not None
            and self.HeatLevelScovilleMax is not None
            and self.HeatLevelScovilleMin > self.HeatLevelScovilleMax
        ):
            raise ValueError("HeatLevelScovilleMin cannot be greater than HeatLevelScovilleMax.")

        if (
            self.OptimalSoilMoistureMin is not None
            and self.OptimalSoilMoistureMax is not None
            and self.OptimalSoilMoistureMin > self.OptimalSoilMoistureMax
        ):
            raise ValueError("OptimalSoilMoistureMin cannot be greater than OptimalSoilMoistureMax.")

        if (
            self.OptimalTempMinC is not None
            and self.OptimalTempMaxC is not None
            and self.OptimalTempMinC > self.OptimalTempMaxC
        ):
            raise ValueError("OptimalTempMinC cannot be greater than OptimalTempMaxC.")

        return self


class PepperResponse(BaseModel):
    PepperId: int
    PepperName: str
    ScientificName: Optional[str] = None
    HeatLevelScovilleMin: Optional[int] = None
    HeatLevelScovilleMax: Optional[int] = None
    OptimalSoilMoistureMin: Optional[float] = None
    OptimalSoilMoistureMax: Optional[float] = None
    OptimalTempMinC: Optional[float] = None
    OptimalTempMaxC: Optional[float] = None
    OptimalSunlightHours: Optional[float] = None
    ImageUrl: Optional[str] = None
    Zone: Optional[str] = None
    GeneralDescription: Optional[str] = None
    IsActive: bool

    class Config:
        from_attributes = True