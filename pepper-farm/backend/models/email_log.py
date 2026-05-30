from sqlalchemy import Column, Integer, String, DateTime, Numeric
from sqlalchemy.sql import func
from database import Base


class EmailLog(Base):
    __tablename__ = "EmailLogs"

    EmailLogId = Column(Integer, primary_key=True, autoincrement=True)
    RecipientEmail = Column(String(200), nullable=False)
    RecipientName = Column(String(100), nullable=True)
    RecipientType = Column(String(20), nullable=False)          # customer/worker/manager/unknown
    Subject = Column(String(500), nullable=False)
    MessagePreview = Column(String(500), nullable=True)
    EmailType = Column(String(50), nullable=False)              # discount_promotion/newsletter/announcement/system
    Status = Column(String(20), nullable=False)                 # pending/sent/failed/skipped
    ErrorMessage = Column(String(1000), nullable=True)
    RelatedProductId = Column(Integer, nullable=True)
    RelatedDiscountPercentage = Column(Numeric(5, 2), nullable=True)
    SentAtUtc = Column(DateTime, nullable=True)
    CreatedAtUtc = Column(DateTime, nullable=False, server_default=func.sysutcdatetime())
    CreatedBy = Column(Integer, nullable=True)                  # UserId of the manager who triggered the send
