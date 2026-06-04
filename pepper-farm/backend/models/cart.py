from sqlalchemy import Column, Integer, ForeignKey, DateTime
from sqlalchemy.sql import func
from database import Base


class CartItem(Base):
    __tablename__ = "CartItems"

    CartItemId  = Column(Integer, primary_key=True, autoincrement=True)
    UserId      = Column(Integer, ForeignKey("Users.UserId"), nullable=False)
    ProductId   = Column(Integer, ForeignKey("Products.ProductId"), nullable=False)
    Quantity    = Column(Integer, nullable=False, default=1)
    CreatedAtUtc = Column(DateTime, nullable=False, server_default=func.sysutcdatetime())
    UpdatedAtUtc = Column(DateTime, nullable=False, server_default=func.sysutcdatetime())
