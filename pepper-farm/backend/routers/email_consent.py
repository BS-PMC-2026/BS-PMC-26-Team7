"""
US40 — Email Consent Management
GET  /api/email-consent/me          → retrieve own consent status (authenticated)
PUT  /api/email-consent/me          → update own consent status (authenticated)
GET  /api/email-consent/unsubscribe → one-click unsubscribe via token (public, no auth)
"""
import traceback
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.exc import OperationalError, ProgrammingError
from sqlalchemy.orm import Session

from database import get_db
from schemas.email_consent import ConsentStatusResponse, ConsentUpdateRequest, UnsubscribeResponse
from utils.jwt import get_current_user

router = APIRouter(prefix="/api/email-consent", tags=["Email Consent"])


def _read_consent(db: Session, user_id: int) -> dict:
    """Return consent fields from DB, handling pre-migration state gracefully."""
    try:
        row = db.execute(
            text("""
                SELECT EmailConsent,
                       EmailMarketingConsentUpdatedAtUtc,
                       EmailUnsubscribedAtUtc
                FROM Users WHERE UserId = :uid
            """),
            {"uid": user_id},
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="User not found.")
        return {
            "emailConsent":                      bool(row[0]) if row[0] is not None else False,
            "emailMarketingConsentUpdatedAtUtc": row[1],
            "emailUnsubscribedAtUtc":            row[2],
        }
    except (OperationalError, ProgrammingError):
        # Bug C fix: SQL Server raises ProgrammingError for "Invalid column name".
        # Both exception types indicate columns haven't been migrated yet.
        db.rollback()
        return {
            "emailConsent":                      False,
            "emailMarketingConsentUpdatedAtUtc": None,
            "emailUnsubscribedAtUtc":            None,
        }


# ── GET /api/email-consent/me ─────────────────────────────────────────────────

@router.get("/me", response_model=ConsentStatusResponse)
def get_my_consent(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user["user_id"]
    data = _read_consent(db, user_id)
    return ConsentStatusResponse(userId=user_id, **data)


# ── PUT /api/email-consent/me ─────────────────────────────────────────────────

@router.put("/me", response_model=ConsentStatusResponse)
def update_my_consent(
    payload: ConsentUpdateRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user["user_id"]
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    try:
        if payload.emailConsent:
            db.execute(
                text("""
                    UPDATE Users
                    SET EmailConsent = 1,
                        EmailMarketingConsentUpdatedAtUtc = :now,
                        EmailUnsubscribedAtUtc = NULL
                    WHERE UserId = :uid
                """),
                {"now": now, "uid": user_id},
            )
        else:
            db.execute(
                text("""
                    UPDATE Users
                    SET EmailConsent = 0,
                        EmailMarketingConsentUpdatedAtUtc = :now,
                        EmailUnsubscribedAtUtc = :now
                    WHERE UserId = :uid
                """),
                {"now": now, "uid": user_id},
            )
        db.commit()
    except (OperationalError, ProgrammingError):
        db.rollback()
        raise HTTPException(
            status_code=503,
            detail="Consent columns not yet available. "
                   "Run database/migrations/add_email_consent_us40_fields.sql.",
        )
    except Exception:
        db.rollback()
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to update consent.")

    data = _read_consent(db, user_id)
    return ConsentStatusResponse(userId=user_id, **data)


# ── GET /api/email-consent/unsubscribe?token=... ──────────────────────────────

@router.get("/unsubscribe", response_model=UnsubscribeResponse)
def unsubscribe_by_token(
    token: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
):
    """One-click unsubscribe from marketing emails via the footer link.
    Public endpoint — no authentication required.
    Does not reveal whether an email address exists.
    """
    try:
        row = db.execute(
            text("""
                SELECT UserId, EmailConsent, EmailUnsubscribedAtUtc
                FROM Users WHERE EmailUnsubscribeToken = :token
            """),
            {"token": token},
        ).fetchone()
    except (OperationalError, ProgrammingError):
        db.rollback()
        # Columns don't exist yet — return generic success to avoid information leak
        return UnsubscribeResponse(success=True, message="You have been unsubscribed.")

    if not row:
        # Invalid token — return generic response (no user-existence leak)
        return UnsubscribeResponse(
            success=False,
            message="This unsubscribe link is invalid or has already been used.",
        )

    user_id, email_consent, unsubscribed_at = row[0], row[1], row[2]

    if not email_consent and unsubscribed_at:
        return UnsubscribeResponse(
            success=True,
            message="You are already unsubscribed from marketing emails.",
        )

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    try:
        db.execute(
            text("""
                UPDATE Users
                SET EmailConsent = 0,
                    EmailUnsubscribedAtUtc = :now,
                    EmailMarketingConsentUpdatedAtUtc = :now
                WHERE UserId = :uid
            """),
            {"now": now, "uid": user_id},
        )
        db.commit()
    except Exception:
        db.rollback()
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to process unsubscribe.")

    return UnsubscribeResponse(success=True, message="You have been unsubscribed from marketing emails.")
