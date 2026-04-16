from sqlalchemy import Column, Integer, String, Boolean, DateTime, Numeric, ForeignKey
from sqlalchemy.sql import func
from database import Base


class Product(Base):
    __tablename__ = "Products"

    ProductId = Column(Integer, primary_key=True, autoincrement=True)
    ProductName = Column(String(150), nullable=False, unique=True)
    ProductDescription = Column(String(1000), nullable=True)
    Category = Column(String(100), nullable=True)
    Price = Column(Numeric(10, 2), nullable=False)
    ImageUrl = Column(String(500), nullable=True)
    PepperId = Column(Integer, ForeignKey("PepperVarieties.PepperId"), nullable=True)
    IsActive = Column(Boolean, nullable=False, default=True)
    CreatedAt = Column(DateTime, nullable=False, server_default=func.sysutcdatetime())