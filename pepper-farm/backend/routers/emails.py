"""
Bulk-newsletter email router.
IMPORTANT: SMTP sends happen in BackgroundTasks so the HTTP response returns
immediately.  Newsletters do NOT create in-app Notification rows — only real
app messages/announcements do (see routers/notifications.py).
"""
import re
import traceback
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from database import SessionLocal, get_db
from models.email_log import EmailLog
from models.role import Role
from models.user import User
from schemas.email import EmailLogResponse, NewsletterRequest, NewsletterResponse
from services.email_service import is_smtp_configured, send_email
from services.email_unsubscribe import (
    build_unsubscribe_footer_html,
    build_unsubscribe_footer_text,
    get_or_create_token,
)
from utils.jwt import require_role

router = APIRouter(prefix="/api/emails", tags=["Emails"])

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _valid_email(email: str | None) -> bool:
    return bool(email and _EMAIL_RE.match(email))


def _role_name(user: User) -> str:
    try:
        return user.role.RoleName if user.role else "unknown"
    except Exception:
        return "unknown"


def _recipient_type(role: str) -> str:
    return {"Visitor": "customer", "Worker": "worker", "FarmManager": "manager"}.get(role, "unknown")


def _get_recipients(db: Session, groups: List[str]) -> List[User]:
    """Return deduplicated list of users matching the requested groups."""
    seen: set[int] = set()
    result: List[User] = []

    def _add(users: List[User]) -> None:
        for u in users:
            if u.UserId not in seen and _valid_email(u.Email):
                seen.add(u.UserId)
                result.append(u)

    wants_customers = "customers" in groups or "all" in groups
    wants_workers   = "workers"   in groups or "all" in groups

    if wants_customers:
        try:
            customers = (
                db.query(User)
                .join(Role, User.RoleId == Role.RoleId)
                .filter(
                    Role.RoleName == "Visitor",
                    text("Users.EmailConsent = 1"),
                    User.IsActive == True,  # noqa: E712
                )
                .all()
            )
        except OperationalError:
            db.rollback()
            print("[emails] EmailConsent column not found — falling back to all active Visitors.")
            customers = (
                db.query(User)
                .join(Role, User.RoleId == Role.RoleId)
                .filter(Role.RoleName == "Visitor", User.IsActive == True)  # noqa: E712
                .all()
            )
        _add(customers)

    if wants_workers:
        workers = (
            db.query(User)
            .join(Role, User.RoleId == Role.RoleId)
            .filter(Role.RoleName == "Worker", User.IsActive == True)  # noqa: E712
            .all()
        )
        _add(workers)

    return result


def _build_html(subject: str, message: str, unsubscribe_token: str = "") -> str:
    safe_message = message.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    safe_message = safe_message.replace("\n", "<br>")
    # build_unsubscribe_footer_html always returns a footer (profile fallback if no token)
    unsubscribe_html = build_unsubscribe_footer_html(unsubscribe_token)
    return f"""<!DOCTYPE html>
<html lang="en">
<body style="font-family:Arial,sans-serif;color:#222;max-width:600px;margin:auto;padding:24px">
  <h2 style="color:#2d6a4f">{subject}</h2>
  <p>{safe_message}</p>
  <hr style="border:none;border-top:1px solid #ddd;margin:24px 0">
  <p style="font-size:12px;color:#888">
    You are receiving this email as a registered member of Pepper Farm.
  </p>
  {unsubscribe_html}
</body>
</html>"""


# ── Background sender ─────────────────────────────────────────────────────────

def _send_newsletter_bg(
    subject: str,
    message: str,
    email_type: str,
    manager_id: int,
    recipients: List[dict],   # plain dicts: {user_id, email, name, rtype}
) -> None:
    """Background task: sends emails and writes EmailLogs.
    Uses its own DB session — the request session is already closed.
    Does NOT create in-app Notification rows (newsletters ≠ app announcements).
    """
    db = SessionLocal()
    try:
        for r in recipients:
            token     = get_or_create_token(db, r["user_id"])
            html_body = _build_html(subject, message, token)
            plain_body = message + build_unsubscribe_footer_text(token)
            try:
                send_email(r["email"], subject, html_body, plain_body)
                log = EmailLog(
                    RecipientEmail=r["email"],
                    RecipientName=r["name"],
                    RecipientType=r["rtype"],
                    Subject=subject,
                    MessagePreview=message[:200],
                    EmailType=email_type,
                    Status="sent",
                    SentAtUtc=datetime.now(timezone.utc).replace(tzinfo=None),
                    CreatedBy=manager_id,
                )
            except Exception as exc:
                log = EmailLog(
                    RecipientEmail=r["email"],
                    RecipientName=r["name"],
                    RecipientType=r["rtype"],
                    Subject=subject,
                    MessagePreview=message[:200],
                    EmailType=email_type,
                    Status="failed",
                    ErrorMessage=str(exc)[:500],
                    CreatedBy=manager_id,
                )
            db.add(log)

        try:
            db.commit()
        except Exception:
            db.rollback()
            traceback.print_exc()
    except Exception:
        traceback.print_exc()
    finally:
        db.close()


# ── Send newsletter endpoint ───────────────────────────────────────────────────

@router.post("/send-newsletter", response_model=NewsletterResponse)
def send_newsletter(
    request: NewsletterRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("FarmManager")),
):
    """Queue bulk newsletter email delivery in background.

    Returns immediately with queued=True and recipient count.
    SMTP sends happen asynchronously — check /api/emails/logs for delivery status.
    This endpoint does NOT create in-app Notification rows.
    """
    subject = request.subject.strip()
    message = request.message.strip()

    if not subject:
        raise HTTPException(status_code=400, detail="Subject is required.")
    if not message:
        raise HTTPException(status_code=400, detail="Message body is required.")

    valid_groups = {"customers", "workers", "all"}
    given_groups = [g.lower() for g in request.recipientGroups]
    if not given_groups or not any(g in valid_groups for g in given_groups):
        raise HTTPException(
            status_code=400,
            detail="At least one valid recipient group is required: customers, workers, all.",
        )
    if not is_smtp_configured():
        raise HTTPException(
            status_code=503,
            detail="Email service is not configured on this server. "
                   "Set SMTP_HOST, SMTP_USER, SMTP_PASSWORD in the backend .env file.",
        )

    # Resolve recipients in the request session (fast DB query only)
    recipients = _get_recipients(db, given_groups)

    # Serialize to plain dicts before handing off to the background task
    # (ORM objects cannot be shared across sessions/threads)
    recipient_data = [
        {
            "user_id": u.UserId,
            "email":   u.Email,
            "name":    u.FullName,
            "rtype":   _recipient_type(_role_name(u)),
        }
        for u in recipients
    ]

    background_tasks.add_task(
        _send_newsletter_bg,
        subject=subject,
        message=message,
        email_type=request.emailType,
        manager_id=current_user["user_id"],
        recipients=recipient_data,
    )

    return NewsletterResponse(
        totalRecipients=len(recipient_data),
        sentCount=0,
        failedCount=0,
        skippedCount=0,
        message=f"Newsletter queued for {len(recipient_data)} recipient(s). "
                f"Check email logs for delivery status.",
        queued=True,
    )


# ── Email logs ─────────────────────────────────────────────────────────────────

@router.get("/logs", response_model=List[EmailLogResponse])
def get_email_logs(
    db: Session = Depends(get_db),
    _: dict = Depends(require_role("FarmManager")),
):
    try:
        logs = (
            db.query(EmailLog)
            .order_by(EmailLog.CreatedAtUtc.desc())
            .limit(500)
            .all()
        )
        return logs
    except OperationalError as exc:
        db.rollback()
        msg = str(exc).lower()
        if "invalid object name" in msg or "no such table" in msg:
            print("[emails] EmailLogs table missing — run create_email_logs_table.sql")
            return []
        traceback.print_exc()
        raise HTTPException(status_code=503, detail="Database error loading email logs.")
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to load email logs.")
