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


class AnnounceRequest(BaseModel):
    """Broadcast an in-app announcement to all users of the given roles.

    This creates Notification rows — it does NOT send emails.
    Separate from newsletter/discount emails which do NOT create notifications.
    """
    title: str
    message: Optional[str] = None
    recipientRoles: list[str] = ["workers"]  # "workers" | "visitors" | "all"


class AnnounceResponse(BaseModel):
    notificationsCreated: int
    message: str
