from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
from database import Base


class Plant(Base):
    __tablename__ = "Plants"

    PlantId = Column(Integer, primary_key=True, autoincrement=True)
    PlantCode = Column(String(100), nullable=False, unique=True)
    PepperId = Column(Integer, ForeignKey("PepperVarieties.PepperId"), nullable=False)
    ZoneId = Column(Integer, ForeignKey("FarmZones.ZoneId"), nullable=True)
    PlantedAt    = Column(DateTime, nullable=True)
    TransferredAt = Column(DateTime, nullable=True)
    Status = Column(String(50), nullable=True)
    Notes = Column(String(500), nullable=True)
    IsActive = Column(Boolean, nullable=False, default=True)
    CreatedAt = Column(DateTime, nullable=False, server_default=func.now())