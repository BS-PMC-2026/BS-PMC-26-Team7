from sqlalchemy import Column, Integer, Float, Boolean, DateTime
from sqlalchemy.sql import func
from database import Base


class PepperThreshold(Base):
    __tablename__ = "PepperThresholds"

    ThresholdId    = Column(Integer, primary_key=True, autoincrement=True)
    PepperId       = Column(Integer, nullable=False)
    MinTemperature = Column(Float, nullable=True)
    MaxTemperature = Column(Float, nullable=True)
    MinHumidity    = Column(Float, nullable=True)
    MaxHumidity    = Column(Float, nullable=True)
    MaxLeak        = Column(Float, nullable=True)
    MinRadiation   = Column(Float, nullable=True)
    MaxRadiation   = Column(Float, nullable=True)
    IsActive       = Column(Boolean, nullable=False, default=True)
    CreatedAtUtc   = Column(DateTime, nullable=False, server_default=func.sysutcdatetime())
    UpdatedAtUtc   = Column(DateTime, nullable=True)
