from sqlalchemy import Column, Integer, String, Numeric, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
from database import Base


class EmployeeDiscountSetting(Base):
    __tablename__ = "EmployeeDiscountSettings"

    SettingId               = Column(Integer, primary_key=True, autoincrement=True)
    GlobalDiscountPercent   = Column(Numeric(5, 2), nullable=False, default=40)
    Active                  = Column(Boolean, nullable=False, default=True)
    UpdatedAtUtc            = Column(DateTime, nullable=False, server_default=func.sysutcdatetime())
    UpdatedBy               = Column(Integer, nullable=True)   # UserId of FarmManager


class EmployeeDiscountProductOverride(Base):
    __tablename__ = "EmployeeDiscountProductOverrides"

    OverrideId              = Column(Integer, primary_key=True, autoincrement=True)
    ProductId               = Column(Integer, ForeignKey("Products.ProductId"), nullable=False, unique=True)
    Mode                    = Column(String(20), nullable=False, default="use_global")  # use_global/excluded/custom_percent
    CustomDiscountPercent   = Column(Numeric(5, 2), nullable=True)
    UpdatedAtUtc            = Column(DateTime, nullable=False, server_default=func.sysutcdatetime())
    UpdatedBy               = Column(Integer, nullable=True)
