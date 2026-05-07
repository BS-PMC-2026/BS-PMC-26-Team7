from pydantic import BaseModel, Field, field_validator
from typing import Optional


class SensorReadingCreate(BaseModel):
    sensorId: int = Field(..., gt=0)
    macAddress: str = Field(..., min_length=1, max_length=50)
    deviceName: Optional[str] = Field(None, max_length=100)
    temperature: Optional[float] = None
    humidity: Optional[float] = None
    leak: Optional[float] = None
    radiation: Optional[float] = None
    batteryLevel: Optional[float] = None
    readingType: Optional[str] = Field(None, max_length=50)
    rawJson: Optional[dict] = None  # serialised to JSON string before DB insert

    @field_validator("macAddress")
    @classmethod
    def validate_mac_address(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("macAddress cannot be empty.")
        return value


class AlertResult(BaseModel):
    metricName: str
    actualValue: float
    minAllowed: Optional[float]
    maxAllowed: Optional[float]
    severity: str
    message: str

    model_config = {"from_attributes": True}


class SensorReadingResponse(BaseModel):
    readingId: int
    alertsCreated: int
    alerts: list[AlertResult]
