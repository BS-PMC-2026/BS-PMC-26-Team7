from sqlalchemy import Column, Integer, Float, Boolean, DateTime, String
from sqlalchemy.sql import func
from database import Base


class SensorAlert(Base):
    __tablename__ = "SensorAlerts"

    AlertId       = Column(Integer, primary_key=True, autoincrement=True)
    SensorId      = Column(Integer, nullable=False)
    ReadingId     = Column(Integer, nullable=False)
    PepperId      = Column(Integer, nullable=True)
    MetricName    = Column(String(50), nullable=False)
    ActualValue   = Column(Float, nullable=False)
    MinAllowed    = Column(Float, nullable=True)
    MaxAllowed    = Column(Float, nullable=True)
    Severity      = Column(String(20), nullable=False)
    Message       = Column(String(500), nullable=False)
    IsResolved    = Column(Boolean, nullable=False, default=False)
    CreatedAtUtc  = Column(DateTime, nullable=False, server_default=func.sysutcdatetime())
    ResolvedAtUtc = Column(DateTime, nullable=True)
