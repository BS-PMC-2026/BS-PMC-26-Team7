from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class NotificationResponse(BaseModel):
    notificationId: int
    userId: int
    title: str
    message: Optional[str] = None
    notificationType: str
    relatedEntityType: Optional[str] = None
    relatedEntityId: Optional[int] = None
    isRead: bool
    createdAtUtc: datetime
    readAtUtc: Optional[datetime] = None

    class Config:
        from_attributes = True


class NotificationCreate(BaseModel):
    userId: int
    title: str
    message: Optional[str] = None
    notificationType: str = "message"
    relatedEntityType: Optional[str] = None
    relatedEntityId: Optional[int] = None


class UnreadCountResponse(BaseModel):
    unreadCount: int
