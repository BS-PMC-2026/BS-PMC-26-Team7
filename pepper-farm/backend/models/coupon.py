from sqlalchemy import Column, Integer, String, Numeric, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
from database import Base


class Coupon(Base):
    __tablename__ = "Coupons"

    CouponId            = Column(Integer, primary_key=True, autoincrement=True)
    Code                = Column(String(50), nullable=False, unique=True)
    Description         = Column(String(300), nullable=True)
    DiscountType        = Column(String(20), nullable=False)    # percentage / fixed_amount
    DiscountValue       = Column(Numeric(10, 2), nullable=False)
    Active              = Column(Boolean, nullable=False, default=True)
    StartsAtUtc         = Column(DateTime, nullable=True)
    EndsAtUtc           = Column(DateTime, nullable=True)
    MaxTotalUses        = Column(Integer, nullable=True)
    MaxUsesPerUser      = Column(Integer, nullable=True)
    CurrentUseCount     = Column(Integer, nullable=False, default=0)
    MinimumOrderAmount  = Column(Numeric(10, 2), nullable=True)
    AppliesToAllProducts = Column(Boolean, nullable=False, default=True)
    CreatedAtUtc        = Column(DateTime, nullable=False, server_default=func.sysutcdatetime())
    UpdatedAtUtc        = Column(DateTime, nullable=False, server_default=func.sysutcdatetime())


class CouponRedemption(Base):
    __tablename__ = "CouponRedemptions"

    RedemptionId    = Column(Integer, primary_key=True, autoincrement=True)
    CouponId        = Column(Integer, ForeignKey("Coupons.CouponId"), nullable=False)
    UserId          = Column(Integer, ForeignKey("Users.UserId"), nullable=False)
    OrderId         = Column(Integer, ForeignKey("Orders.OrderId"), nullable=False)
    DiscountApplied = Column(Numeric(10, 2), nullable=False)
    RedeemedAtUtc   = Column(DateTime, nullable=False, server_default=func.sysutcdatetime())
