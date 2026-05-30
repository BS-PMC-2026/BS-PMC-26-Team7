from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
from database import Base


class Notification(Base):
    __tablename__ = "Notifications"

    NotificationId    = Column(Integer, primary_key=True, autoincrement=True)
    UserId            = Column(Integer, ForeignKey("Users.UserId"), nullable=False)
    Title             = Column(String(200), nullable=False)
    Message           = Column(String(2000), nullable=True)
    NotificationType  = Column(String(30), nullable=False, default="message")  # message / system
    RelatedEntityType = Column(String(50), nullable=True)
    RelatedEntityId   = Column(Integer, nullable=True)
    IsRead            = Column(Boolean, nullable=False, default=False)
    CreatedAtUtc      = Column(DateTime, nullable=False, server_default=func.sysutcdatetime())
    ReadAtUtc         = Column(DateTime, nullable=True)
