import os
import re
import traceback
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile
from sqlalchemy import text
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from database import SessionLocal, get_db
from models.email_log import EmailLog
from models.role import Role
from models.user import User
from schemas.newsletter_template import (
    SendTemplateRequest,
    SendTemplateResponse,
    TemplateCreate,
    TemplateResponse,
)
from services.email_service import is_smtp_configured, send_email
from services.email_unsubscribe import (
    build_unsubscribe_footer_text,
    get_or_create_token,
)
from services.newsletter_template_service import (
    archive_template,
    create_template,
    get_template,
    list_templates,
    render_html,
    render_plain_text,
    update_template,
)
from utils.jwt import require_role

router = APIRouter(prefix="/api/newsletter-templates", tags=["Newsletter Templates"])

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _valid_email(email: Optional[str]) -> bool:
    return bool(email and _EMAIL_RE.match(email))


def _get_recipients(db: Session, groups: List[str]) -> List[User]:
    seen: set[int] = set()
    result: List[User] = []

    def _add(users: List[User]) -> None:
        for u in users:
            if u.UserId not in seen and _valid_email(u.Email):
                seen.add(u.UserId)
                result.append(u)

    if "customers" in groups or "all" in groups:
        try:
            customers = (
                db.query(User)
                .join(Role, User.RoleId == Role.RoleId)
                .filter(
                    Role.RoleName == "Visitor",
                    text("Users.EmailConsent = 1"),
                    User.IsActive == True,       # noqa: E712
                )
                .all()
            )
        except OperationalError:
            db.rollback()
            customers = (
                db.query(User)
                .join(Role, User.RoleId == Role.RoleId)
                .filter(Role.RoleName == "Visitor", User.IsActive == True)  # noqa: E712
                .all()
            )
        _add(customers)

    if "workers" in groups or "all" in groups:
        workers = (
            db.query(User)
            .join(Role, User.RoleId == Role.RoleId)
            .filter(Role.RoleName == "Worker", User.IsActive == True)  # noqa: E712
            .all()
        )
        _add(workers)

    return result


def _role_name(user: User) -> str:
    try:
        return user.role.RoleName if user.role else "unknown"
    except Exception:
        return "unknown"


def _recipient_type(role: str) -> str:
    return {"Visitor": "customer", "Worker": "worker", "FarmManager": "manager"}.get(role, "unknown")


# ── Image upload ───────────────────────────────────────────────────────────────

_ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif", "image/jpg"}
_MAX_IMAGE_BYTES = 2 * 1024 * 1024   # 2 MB
_SAFE_EXTENSION = {".jpg", ".jpeg", ".png", ".webp", ".gif"}


@router.post("/upload-image")
async def upload_newsletter_image(
    file: UploadFile = File(...),
    _: dict = Depends(require_role("FarmManager")),
):
    """Upload an image for use in newsletter templates.

    Stores the file under uploads/newsletter_images/ (same static-file mount as
    pepper_images) and returns an *absolute* URL so email clients can embed it.
    Set BACKEND_BASE_URL in the backend .env to the public host
    (e.g. https://hadinerim.azurewebsites.net).  Defaults to http://localhost:8000
    for local development.
    """
    if file.content_type not in _ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Only JPEG, PNG, WEBP, and GIF images are accepted.",
        )

    content = await file.read()
    if len(content) > _MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=413,
            detail="Image must not exceed 2 MB.",
        )

    extension = Path(file.filename or "image").suffix.lower()
    if extension not in _SAFE_EXTENSION:
        extension = ".jpg"
    unique_filename = f"newsletter_{uuid4().hex}{extension}"

    uploads_dir = Path(__file__).resolve().parent.parent / "uploads" / "newsletter_images"
    uploads_dir.mkdir(parents=True, exist_ok=True)

    file_path = uploads_dir / unique_filename
    with open(file_path, "wb") as buf:
        buf.write(content)

    # Return an absolute URL so email <img src> works outside the browser.
    base = os.getenv("BACKEND_BASE_URL", "http://localhost:8000").rstrip("/")
    image_url = f"{base}/uploads/newsletter_images/{unique_filename}"

    return {"imageUrl": image_url}


# ── CRUD endpoints ─────────────────────────────────────────────────────────────

@router.get("", response_model=List[TemplateResponse])
def list_newsletter_templates(
    db: Session = Depends(get_db),
    _: dict = Depends(require_role("FarmManager")),
):
    try:
        return list_templates(db)
    except OperationalError:
        db.rollback()
        raise HTTPException(
            status_code=503,
            detail="NewsletterTemplates table not found. "
                   "Run database/migrations/create_newsletter_templates_table.sql.",
        )
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to load newsletter templates.")


@router.get("/{template_id}", response_model=TemplateResponse)
def get_newsletter_template(
    template_id: int,
    db: Session = Depends(get_db),
    _: dict = Depends(require_role("FarmManager")),
):
    try:
        t = get_template(db, template_id)
        from services.newsletter_template_service import _to_response
        return _to_response(t)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to load template.")


@router.post("", response_model=TemplateResponse, status_code=201)
def create_newsletter_template(
    data: TemplateCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("FarmManager")),
):
    try:
        return create_template(db, data, current_user["user_id"])
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except OperationalError:
        db.rollback()
        raise HTTPException(
            status_code=503,
            detail="NewsletterTemplates table not found. "
                   "Run database/migrations/create_newsletter_templates_table.sql.",
        )
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to create template.")


@router.put("/{template_id}", response_model=TemplateResponse)
def update_newsletter_template(
    template_id: int,
    data: TemplateCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("FarmManager")),
):
    try:
        return update_template(db, template_id, data, current_user["user_id"])
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to update template.")


@router.delete("/{template_id}", response_model=TemplateResponse)
def archive_newsletter_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("FarmManager")),
):
    try:
        return archive_template(db, template_id, current_user["user_id"])
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to archive template.")


# ── Preview endpoint ───────────────────────────────────────────────────────────

@router.get("/{template_id}/preview")
def preview_newsletter_template(
    template_id: int,
    db: Session = Depends(get_db),
    _: dict = Depends(require_role("FarmManager")),
):
    try:
        t = get_template(db, template_id)
        return {"html": render_html(t), "plainText": render_plain_text(t)}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to render preview.")


# ── Background sender ─────────────────────────────────────────────────────────

def _send_template_bg(
    template_id: int,
    manager_id: int,
    recipients: List[dict],   # plain dicts: {user_id, email, name, rtype}
) -> None:
    """Background task: renders template per-recipient and sends via SMTP.
    Uses its own DB session.  Does NOT create in-app Notification rows.
    """
    db = SessionLocal()
    try:
        t = get_template(db, template_id)
        plain_base = render_plain_text(t)

        for r in recipients:
            token      = get_or_create_token(db, r["user_id"])
            html_body  = render_html(t, unsubscribe_token=token)
            plain_text = plain_base + build_unsubscribe_footer_text(token)
            try:
                send_email(r["email"], t.Subject, html_body, plain_text)
                log = EmailLog(
                    RecipientEmail=r["email"],
                    RecipientName=r["name"],
                    RecipientType=r["rtype"],
                    Subject=t.Subject,
                    MessagePreview=plain_text[:200],
                    EmailType="newsletter",
                    Status="sent",
                    SentAtUtc=datetime.now(timezone.utc).replace(tzinfo=None),
                    CreatedBy=manager_id,
                )
            except Exception as exc:
                log = EmailLog(
                    RecipientEmail=r["email"],
                    RecipientName=r["name"],
                    RecipientType=r["rtype"],
                    Subject=t.Subject,
                    MessagePreview=plain_text[:200],
                    EmailType="newsletter",
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


# ── Send endpoint ──────────────────────────────────────────────────────────────

@router.post("/{template_id}/send", response_model=SendTemplateResponse)
def send_newsletter_template(
    template_id: int,
    request: SendTemplateRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("FarmManager")),
):
    """Queue template email delivery in background.

    Returns immediately with queued=True and recipient count.
    This endpoint does NOT create in-app Notification rows.
    """
    given_groups = [g.lower() for g in request.recipientGroups]
    valid = {"customers", "workers", "all"}
    if not given_groups or not any(g in valid for g in given_groups):
        raise HTTPException(
            status_code=400,
            detail="At least one valid recipient group is required: customers, workers, all.",
        )

    if not is_smtp_configured():
        raise HTTPException(
            status_code=503,
            detail="Email service is not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASSWORD.",
        )

    try:
        t = get_template(db, template_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    recipients = _get_recipients(db, given_groups)
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
        _send_template_bg,
        template_id=template_id,
        manager_id=current_user["user_id"],
        recipients=recipient_data,
    )

    return SendTemplateResponse(
        totalRecipients=len(recipient_data),
        sentCount=0,
        failedCount=0,
        skippedCount=0,
        message=f"Newsletter queued for {len(recipient_data)} recipient(s). "
                "Check email logs for delivery status.",
        queued=True,
    )
