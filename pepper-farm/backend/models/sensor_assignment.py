from sqlalchemy import Column, Integer, Boolean, DateTime
from sqlalchemy.sql import func
from database import Base


class SensorAssignment(Base):
    __tablename__ = "SensorAssignments"

    AssignmentId    = Column(Integer, primary_key=True, autoincrement=True)
    SensorId        = Column(Integer, nullable=False)
    PlantId         = Column(Integer, nullable=True)
    PepperId        = Column(Integer, nullable=True)
    ZoneId          = Column(Integer, nullable=True)
    AssignedFromUtc = Column(DateTime, nullable=False, server_default=func.sysutcdatetime())
    AssignedToUtc   = Column(DateTime, nullable=True)
    IsActive        = Column(Boolean, nullable=False, default=True)
