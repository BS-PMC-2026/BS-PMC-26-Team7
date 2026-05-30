"""
US40 — In-App Notifications (messages / system announcements only)
Newsletters and promotional emails do NOT create rows here.

GET  /api/notifications              → own notifications list (authenticated)
GET  /api/notifications/unread-count → unread count (authenticated)
PUT  /api/notifications/{id}/read    → mark single as read (authenticated, own only)
PUT  /api/notifications/mark-all-read → mark all own as read (authenticated)
POST /api/notifications/broadcast    → FarmManager creates system announcement for all/role
"""
import traceback
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import OperationalError, ProgrammingError, SQLAlchemyError
from sqlalchemy.orm import Session

from database import get_db
from models.notification import Notification
from schemas.notification import (
    NotificationCreate,
    NotificationResponse,
    UnreadCountResponse,
)
from utils.jwt import get_current_user, require_role

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])


def _is_table_missing(exc: Exception) -> bool:
    """Return True for 'Notifications table does not exist' errors.

    SQL Server raises these as ProgrammingError (pyodbc) in some driver versions
    and OperationalError in others.  Checking the message is more reliable than
    catching only one exception class.
    """
    msg = str(exc).lower()
    return "invalid object name" in msg or "no such table" in msg


def _assert_owns(notification: Notification, user_id: int) -> None:
    if notification.UserId != user_id:
        raise HTTPException(status_code=403, detail="Access denied.")


# ── List own notifications ────────────────────────────────────────────────────

@router.get("", response_model=List[NotificationResponse])
def get_my_notifications(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    try:
        rows = (
            db.query(Notification)
            .filter(Notification.UserId == current_user["user_id"])
            .order_by(Notification.CreatedAtUtc.desc())
            .limit(100)
            .all()
        )
        return [
            NotificationResponse(
                notificationId=r.NotificationId,
                userId=r.UserId,
                title=r.Title,
                message=r.Message,
                notificationType=r.NotificationType,
                relatedEntityType=r.RelatedEntityType,
                relatedEntityId=r.RelatedEntityId,
                isRead=bool(r.IsRead),
                createdAtUtc=r.CreatedAtUtc,
                readAtUtc=r.ReadAtUtc,
            )
            for r in rows
        ]
    except (OperationalError, ProgrammingError) as exc:
        db.rollback()
        if _is_table_missing(exc):
            return []   # migration not yet applied — graceful empty list
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to load notifications.")
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to load notifications.")


# ── Unread count ──────────────────────────────────────────────────────────────

@router.get("/unread-count", response_model=UnreadCountResponse)
def get_unread_count(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    try:
        count = (
            db.query(Notification)
            .filter(
                Notification.UserId == current_user["user_id"],
                Notification.IsRead == False,  # noqa: E712
            )
            .count()
        )
        return UnreadCountResponse(unreadCount=count)
    except (OperationalError, ProgrammingError) as exc:
        db.rollback()
        if _is_table_missing(exc):
            return UnreadCountResponse(unreadCount=0)
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to get unread count.")
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to get unread count.")


# ── Mark all as read ──────────────────────────────────────────────────────────

@router.put("/mark-all-read")
def mark_all_read(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    try:
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        (
            db.query(Notification)
            .filter(
                Notification.UserId == current_user["user_id"],
                Notification.IsRead == False,  # noqa: E712
            )
            .update({"IsRead": True, "ReadAtUtc": now})
        )
        db.commit()
        return {"message": "All notifications marked as read."}
    except (OperationalError, ProgrammingError) as exc:
        db.rollback()
        if _is_table_missing(exc):
            return {"message": "No notifications table yet."}
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to mark all as read.")
    except Exception:
        db.rollback()
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to mark all as read.")


# ── Mark single as read ───────────────────────────────────────────────────────

@router.put("/{notification_id}/read")
def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    try:
        n = db.query(Notification).filter(Notification.NotificationId == notification_id).first()
        if not n:
            raise HTTPException(status_code=404, detail="Notification not found.")
        _assert_owns(n, current_user["user_id"])
        n.IsRead   = True
        n.ReadAtUtc = datetime.now(timezone.utc).replace(tzinfo=None)
        db.commit()
        return {"message": "Notification marked as read."}
    except HTTPException:
        raise
    except (OperationalError, ProgrammingError) as exc:
        db.rollback()
        if _is_table_missing(exc):
            raise HTTPException(status_code=503, detail="Notifications table not yet available. Run create_notifications_table.sql.")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to mark notification as read.")
    except Exception:
        db.rollback()
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to mark notification as read.")


# ── FarmManager broadcast announcement ────────────────────────────────────────

@router.post("/broadcast", status_code=201)
def broadcast_notification(
    payload: NotificationCreate,
    db: Session = Depends(get_db),
    _: dict = Depends(require_role("FarmManager")),
):
    """Create an in-app notification for a specific user (FarmManager only).
    Use for system announcements or direct messages — NOT for newsletter sends.
    """
    try:
        n = Notification(
            UserId=payload.userId,
            Title=payload.title,
            Message=payload.message,
            NotificationType=payload.notificationType,
            RelatedEntityType=payload.relatedEntityType,
            RelatedEntityId=payload.relatedEntityId,
        )
        db.add(n)
        db.commit()
        db.refresh(n)
        return NotificationResponse(
            notificationId=n.NotificationId,
            userId=n.UserId,
            title=n.Title,
            message=n.Message,
            notificationType=n.NotificationType,
            relatedEntityType=n.RelatedEntityType,
            relatedEntityId=n.RelatedEntityId,
            isRead=bool(n.IsRead),
            createdAtUtc=n.CreatedAtUtc,
            readAtUtc=n.ReadAtUtc,
        )
    except (OperationalError, ProgrammingError) as exc:
        db.rollback()
        if _is_table_missing(exc):
            raise HTTPException(
                status_code=503,
                detail="Notifications table not yet available. "
                       "Run database/migrations/create_notifications_table.sql.",
            )
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to create notification.")
    except Exception:
        db.rollback()
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to create notification.")
