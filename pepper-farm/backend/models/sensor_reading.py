from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text
from sqlalchemy.sql import func
from database import Base


class SensorReading(Base):
    __tablename__ = "SensorReadings"

    ReadingId             = Column(Integer, primary_key=True, autoincrement=True)
    SensorId              = Column(Integer, nullable=False)
    MacAddress            = Column(String(50), nullable=False)
    DeviceName            = Column(String(100), nullable=True)
    Temperature           = Column(Float, nullable=True)
    Humidity              = Column(Float, nullable=True)
    Leak                  = Column(Float, nullable=True)
    VibrationSD           = Column(Float, nullable=True)
    BatteryLevel          = Column(Float, nullable=True)
    Radiation             = Column(Float, nullable=True)
    SampleTimeUtc         = Column(DateTime, nullable=False, server_default=func.sysutcdatetime())
    GatewayReadTimeUtc    = Column(DateTime, nullable=True)
    AtomationCreatedAtUtc = Column(DateTime, nullable=True)
    ReadingType           = Column(String(50), nullable=True)
    TriggersJson          = Column(Text, nullable=True)
    Latitude              = Column(Float, nullable=True)
    Longitude             = Column(Float, nullable=True)
    RawJson               = Column(Text, nullable=False)
    InsertedAtUtc         = Column(DateTime, nullable=False, server_default=func.sysutcdatetime())
