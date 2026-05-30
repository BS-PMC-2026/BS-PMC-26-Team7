"""
Shared utility for per-user unsubscribe tokens and link generation.
Used by newsletter, discount, and template email sends.
"""
import os
from uuid import uuid4

from sqlalchemy import text
from sqlalchemy.orm import Session


def get_frontend_base_url() -> str:
    return os.getenv("FRONTEND_BASE_URL", "http://localhost:3000").rstrip("/")


def get_or_create_token(db: Session, user_id: int) -> str:
    """Return the user's EmailUnsubscribeToken, generating one if missing.

    Returns an empty string when the US40 columns have not been migrated yet —
    callers should simply omit the unsubscribe link in that case rather than crash.
    """
    try:
        row = db.execute(
            text("SELECT EmailUnsubscribeToken FROM Users WHERE UserId = :uid"),
            {"uid": user_id},
        ).fetchone()
        if not row:
            return ""
        if row[0]:
            return str(row[0])

        # Generate a fresh 64-char token
        token = uuid4().hex + uuid4().hex
        db.execute(
            text("UPDATE Users SET EmailUnsubscribeToken = :tok WHERE UserId = :uid"),
            {"tok": token, "uid": user_id},
        )
        db.commit()
        return token
    except Exception:
        return ""


def build_unsubscribe_url(token: str) -> str:
    """Return the frontend unsubscribe page URL with the token as a query param."""
    if not token:
        return ""
    return f"{get_frontend_base_url()}/unsubscribe?token={token}"


def build_unsubscribe_footer_html(token: str) -> str:
    """Return a ready-to-embed HTML footer with the unsubscribe link.

    Spec (Bug B fix): the word 'unsubscribe' must be a clickable link.
    The link must be token-based and must NOT point to the profile page.
    When no token is available yet (US40 migration pending), show a plain
    note without any link rather than linking to the wrong destination.
    """
    url = build_unsubscribe_url(token)
    if url:
        return (
            f'<p style="margin:8px 0 0;font-size:11px;color:#aaa">'
            f'To stop receiving promotional emails and newsletters, '
            f'<a href="{url}" style="color:#aaa;text-decoration:underline">click here to unsubscribe</a>.</p>'
        )
    # No token yet (migration pending) — plain text, no profile link
    return (
        '<p style="margin:8px 0 0;font-size:11px;color:#aaa">'
        "You are receiving this email because you subscribed to Pepper Farm updates.</p>"
    )


def build_unsubscribe_footer_text(token: str) -> str:
    """Return a plain-text unsubscribe line."""
    url = build_unsubscribe_url(token)
    if url:
        return f"\n---\nTo stop receiving promotional emails, unsubscribe here: {url}"
    return "\n---\nYou are receiving this email because you subscribed to Pepper Farm updates."
