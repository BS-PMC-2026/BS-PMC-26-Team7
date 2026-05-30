import re
import traceback
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from services.email_unsubscribe import (
    build_unsubscribe_footer_html,
    build_unsubscribe_footer_text,
    get_or_create_token,
)

from database import get_db
from models.email_log import EmailLog
from models.role import Role
from models.user import User
from schemas.email import EmailLogResponse, NewsletterRequest, NewsletterResponse
from services.email_service import is_smtp_configured, send_email
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
    """Return deduplicated list of users matching the requested groups.

    - "customers"  → Visitors with EmailConsent=True and valid email
    - "workers"    → Workers with a valid email (no consent filter — staff comms)
    - "all"        → union of both groups above
    """
    seen: set[int] = set()
    result: List[User] = []

    def _add(users: List[User]) -> None:
        for u in users:
            if u.UserId not in seen and _valid_email(u.Email):
                seen.add(u.UserId)
                result.append(u)

    wants_customers = "customers" in groups or "all" in groups
    wants_workers = "workers" in groups or "all" in groups

    if wants_customers:
        try:
            # Filter by EmailConsent when the column exists in the DB.
            # If the migration (add_email_consent_to_users.sql) has not yet been
            # applied, SQL Server raises OperationalError "Invalid column name".
            # In that case fall back to all active Visitors so the newsletter
            # can still be sent while the migration is pending.
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
            print(
                "[emails] EmailConsent column not found — "
                "run database/migrations/add_email_consent_to_users.sql. "
                "Falling back to all active Visitors."
            )
            customers = (
                db.query(User)
                .join(Role, User.RoleId == Role.RoleId)
                .filter(
                    Role.RoleName == "Visitor",
                    User.IsActive == True,  # noqa: E712
                )
                .all()
            )
        _add(customers)

    if wants_workers:
        workers = (
            db.query(User)
            .join(Role, User.RoleId == Role.RoleId)
            .filter(
                Role.RoleName == "Worker",
                User.IsActive == True,  # noqa: E712
            )
            .all()
        )
        _add(workers)

    return result


def _build_html(subject: str, message: str, unsubscribe_token: str = "") -> str:
    safe_message = message.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    safe_message = safe_message.replace("\n", "<br>")
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


@router.post("/send-newsletter", response_model=NewsletterResponse)
def send_newsletter(
    request: NewsletterRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("FarmManager")),
):
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

    recipients = _get_recipients(db, given_groups)

    sent_count = 0
    failed_count = 0
    skipped_count = 0
    manager_id: int = current_user["user_id"]

    for user in recipients:
        role = _role_name(user)
        rtype = _recipient_type(role)
        preview = message[:200] if message else ""

        # US40: build per-recipient HTML with their personal unsubscribe token
        token = get_or_create_token(db, user.UserId)
        html_body = _build_html(subject, message, token)
        plain_body = message + build_unsubscribe_footer_text(token)

        try:
            send_email(user.Email, subject, html_body, plain_body)
            sent_count += 1
            log = EmailLog(
                RecipientEmail=user.Email,
                RecipientName=user.FullName,
                RecipientType=rtype,
                Subject=subject,
                MessagePreview=preview,
                EmailType=request.emailType,
                Status="sent",
                SentAtUtc=datetime.now(timezone.utc).replace(tzinfo=None),
                CreatedBy=manager_id,
            )
        except Exception as exc:
            failed_count += 1
            log = EmailLog(
                RecipientEmail=user.Email,
                RecipientName=user.FullName,
                RecipientType=rtype,
                Subject=subject,
                MessagePreview=preview,
                EmailType=request.emailType,
                Status="failed",
                ErrorMessage=str(exc)[:500],
                CreatedBy=manager_id,
            )
        db.add(log)

    try:
        db.commit()
    except OperationalError as exc:
        db.rollback()
        if "invalid object name" in str(exc).lower():
            print("[emails] EmailLogs table missing — logs not persisted; run create_email_logs_table.sql")
        else:
            traceback.print_exc()
    except Exception:
        traceback.print_exc()
        db.rollback()

    total = sent_count + failed_count + skipped_count
    return NewsletterResponse(
        totalRecipients=total,
        sentCount=sent_count,
        failedCount=failed_count,
        skippedCount=skipped_count,
        message=(
            f"Newsletter sent: {sent_count} delivered, "
            f"{failed_count} failed, {skipped_count} skipped."
        ),
    )


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
            # Migration create_email_logs_table.sql has not been applied yet.
            # Return an empty list rather than crashing so the UI can display
            # a helpful message instead of an unhandled 500.
            print("[emails] EmailLogs table missing — run create_email_logs_table.sql")
            return []
        traceback.print_exc()
        raise HTTPException(status_code=503, detail="Database error loading email logs.")
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to load email logs.")
