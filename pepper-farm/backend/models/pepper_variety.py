from sqlalchemy import Column, Integer, String, Boolean, DateTime, Numeric
from sqlalchemy.sql import func
from database import Base

class PepperVariety(Base):
    __tablename__ = "PepperVarieties"

    PepperId               = Column(Integer, primary_key=True, autoincrement=True)
    PepperName             = Column(String(100), nullable=False, unique=True)
    ScientificName         = Column(String(150), nullable=True)
    HeatLevelScovilleMin   = Column(Integer, nullable=True)
    HeatLevelScovilleMax   = Column(Integer, nullable=True)
    OptimalSoilMoistureMin = Column(Numeric(5, 2), nullable=True)
    OptimalSoilMoistureMax = Column(Numeric(5, 2), nullable=True)
    OptimalTempMinC        = Column(Numeric(5, 2), nullable=True)
    OptimalTempMaxC        = Column(Numeric(5, 2), nullable=True)
    OptimalPARMin          = Column(Numeric(7, 2), nullable=True)
    OptimalPARMax          = Column(Numeric(7, 2), nullable=True)
    ImageUrl               = Column(String(500), nullable=True)
    Zone                   = Column(String(500), nullable=True)
    GeneralDescription     = Column(String(1000), nullable=True)
    IsActive               = Column(Boolean, nullable=False, default=True)
    CreatedAt              = Column(DateTime, nullable=False, server_default=func.sysutcdatetime())
