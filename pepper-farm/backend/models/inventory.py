from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from database import Base


class Inventory(Base):
    __tablename__ = "Inventory"

    InventoryId = Column(Integer, primary_key=True, autoincrement=True)
    ProductId = Column(
        Integer,
        ForeignKey("Products.ProductId"),
        nullable=True,  # warehouse-only items do not need a product
    )
    ItemName = Column(String(200), nullable=True)   # used when ProductId is NULL
    Location = Column(String(200), nullable=True)   # e.g. "Aisle 3, Shelf B"
    WarehouseQuantity = Column(Integer, nullable=False, default=0)
    AllocatedQuantity = Column(Integer, nullable=False, default=0)
    LastUpdatedAt = Column(
        DateTime,
        nullable=False,
        server_default=func.sysutcdatetime(),
        onupdate=func.sysutcdatetime(),
    )