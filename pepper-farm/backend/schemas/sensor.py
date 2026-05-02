from datetime import datetime
from pydantic import BaseModel, Field
from typing import Optional


class SensorResponse(BaseModel):
    SensorId: int
    MacAddress: str
    DeviceName: Optional[str] = None
    UnitName: Optional[str] = None
    BusinessUnitId: Optional[str] = None
    GatewayId: Optional[str] = None
    SensorType: Optional[str] = None
    IsActive: bool

    class Config:
        from_attributes = True


class SensorReadingResponse(BaseModel):
    ReadingId: int
    SensorId: int
    MacAddress: str
    DeviceName: Optional[str] = None

    Temperature: Optional[float] = None
    Humidity: Optional[float] = None
    Leak: Optional[float] = None
    VibrationSD: Optional[float] = None
    BatteryLevel: Optional[float] = None
    Radiation: Optional[float] = None

    SampleTimeUtc: datetime
    GatewayReadTimeUtc: Optional[datetime] = None
    AtomationCreatedAtUtc: Optional[datetime] = None

    ReadingType: Optional[str] = None
    Latitude: Optional[float] = None
    Longitude: Optional[float] = None

    class Config:
        from_attributes = True


class SensorSyncRequest(BaseModel):
    macAddress: str = Field(..., min_length=5, max_length=50)
    startDate: datetime
    endDate: datetime
    createdAt: bool = False