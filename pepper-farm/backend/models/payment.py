from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey
from sqlalchemy.sql import func
from database import Base


class PaymentRecord(Base):
    __tablename__ = "PaymentRecords"

    PaymentRecordId     = Column(Integer, primary_key=True, autoincrement=True)
    OrderId             = Column(Integer, ForeignKey("Orders.OrderId"), nullable=False)
    UserId              = Column(Integer, ForeignKey("Users.UserId"), nullable=False)
    # credit_card = mock credit card; paypal = real PayPal Sandbox
    PaymentMethod       = Column(String(30), nullable=False)
    PaymentStatus       = Column(String(20), nullable=False)    # succeeded / failed / pending
    Amount              = Column(Numeric(10, 2), nullable=False)
    Currency            = Column(String(3), nullable=False, default="ILS")
    # Mock credit card only — NULL for PayPal
    MockTransactionId   = Column(String(100), nullable=True)
    CardLast4           = Column(String(4), nullable=True)      # never store full card number
    CardBrand           = Column(String(30), nullable=True)
    # Legacy field (unused) — kept for schema compatibility
    PaypalMockAccount   = Column(String(200), nullable=True)
    # Real PayPal Sandbox fields (added by migration add_paypal_fields_to_payment_records.sql)
    ProviderOrderId     = Column(String(100), nullable=True)    # PayPal order ID
    ProviderCaptureId   = Column(String(100), nullable=True)    # PayPal capture ID
    ProviderStatus      = Column(String(50),  nullable=True)    # PayPal status e.g. COMPLETED
    FailureReason       = Column(String(500), nullable=True)
    InvoiceEmailStatus  = Column(String(20), nullable=False, default="not_sent")  # not_sent/queued/sent/failed
    CreatedAtUtc        = Column(DateTime, nullable=False, server_default=func.sysutcdatetime())
    PaidAtUtc           = Column(DateTime, nullable=True)
