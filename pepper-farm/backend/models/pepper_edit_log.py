from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from database import Base


class PepperEditLog(Base):
    __tablename__ = "PepperEditLog"

    LogId         = Column(Integer, primary_key=True, autoincrement=True)
    PepperId      = Column(Integer, ForeignKey("PepperVarieties.PepperId"), nullable=False)
    ChangedFields = Column(String(2000), nullable=True)
    ChangedAt     = Column(DateTime, nullable=False, server_default=func.now())
