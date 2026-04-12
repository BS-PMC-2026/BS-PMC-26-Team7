from sqlalchemy import Column, Integer, String, Boolean, DateTime, Numeric, ForeignKey
from sqlalchemy.sql import func
from database import Base

class FarmZone(Base):
    __tablename__ = "FarmZones"

    ZoneId           = Column(Integer, primary_key=True, autoincrement=True)
    ZoneName         = Column(String(100), nullable=False, unique=True)
    ZoneCode         = Column(String(50), nullable=True, unique=True)
    PepperId         = Column(Integer, ForeignKey("PepperVarieties.PepperId"), nullable=True)
    AreaSquareMeters = Column(Numeric(10, 2), nullable=True)
    Latitude         = Column(Numeric(9, 6), nullable=True)
    Longitude        = Column(Numeric(9, 6), nullable=True)
    SoilType         = Column(String(100), nullable=True)
    IrrigationMethod = Column(String(100), nullable=True)
    Notes            = Column(String(500), nullable=True)
    IsActive         = Column(Boolean, nullable=False, default=True)
    CreatedAt        = Column(DateTime, nullable=False, server_default=func.sysutcdatetime())
