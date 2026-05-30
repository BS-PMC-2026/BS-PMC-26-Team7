from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey
from sqlalchemy.sql import func
from database import Base


class Order(Base):
    __tablename__ = "Orders"

    OrderId                 = Column(Integer, primary_key=True, autoincrement=True)
    UserId                  = Column(Integer, ForeignKey("Users.UserId"), nullable=False)
    OrderNumber             = Column(String(50), nullable=False, unique=True)
    Status                  = Column(String(20), nullable=False, default="pending")  # pending/paid/cancelled/failed
    Subtotal                = Column(Numeric(10, 2), nullable=False)
    ProductDiscountTotal    = Column(Numeric(10, 2), nullable=False, default=0)
    EmployeeDiscountTotal   = Column(Numeric(10, 2), nullable=False, default=0)
    CouponDiscountTotal     = Column(Numeric(10, 2), nullable=False, default=0)
    TotalAmount             = Column(Numeric(10, 2), nullable=False)
    Currency                = Column(String(3), nullable=False, default="ILS")
    CouponCode              = Column(String(50), nullable=True)
    PaymentMethod           = Column(String(30), nullable=False)  # mock_credit_card/mock_paypal
    CreatedAtUtc            = Column(DateTime, nullable=False, server_default=func.sysutcdatetime())
    PaidAtUtc               = Column(DateTime, nullable=True)
    CancelledAtUtc          = Column(DateTime, nullable=True)


class OrderItem(Base):
    __tablename__ = "OrderItems"

    OrderItemId                     = Column(Integer, primary_key=True, autoincrement=True)
    OrderId                         = Column(Integer, ForeignKey("Orders.OrderId"), nullable=False)
    ProductId                       = Column(Integer, nullable=True)   # nullable in case product later deleted
    ProductNameSnapshot             = Column(String(150), nullable=False)
    UnitPriceOriginal               = Column(Numeric(10, 2), nullable=False)
    UnitPriceAfterProductDiscount   = Column(Numeric(10, 2), nullable=False)
    UnitPriceAfterEmployeeDiscount  = Column(Numeric(10, 2), nullable=False)
    Quantity                        = Column(Integer, nullable=False)
    LineSubtotal                    = Column(Numeric(10, 2), nullable=False)
    LineDiscountTotal               = Column(Numeric(10, 2), nullable=False, default=0)
    LineTotal                       = Column(Numeric(10, 2), nullable=False)
    EmployeeDiscountAppliedPercent  = Column(Numeric(5, 2), nullable=True)
    ProductDiscountAppliedPercent   = Column(Numeric(5, 2), nullable=True)
