from sqlalchemy import Column, Integer, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database import Base


class Inventory(Base):
    __tablename__ = "Inventory"

    InventoryId = Column(Integer, primary_key=True, autoincrement=True)
    ProductId = Column(
        Integer,
        ForeignKey("Products.ProductId"),
        nullable=False,
        unique=True,  # 1:1 with Product — inventory row per product
    )
    WarehouseQuantity = Column(Integer, nullable=False, default=0)
    AllocatedQuantity = Column(Integer, nullable=False, default=0)
    LastUpdatedAt = Column(
        DateTime,
        nullable=False,
        server_default=func.sysutcdatetime(),
        onupdate=func.sysutcdatetime(),
    )