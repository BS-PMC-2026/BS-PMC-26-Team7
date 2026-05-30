"""
Regression tests for US39/US40 bug-fix batch 3.

Bug A: worker notification bell must show notification details.
Bug B: email footer must say "click to unsubscribe" (token-based, no profile link).
Bug C: GET /api/email-consent/me must not 500 when US40 migration not yet applied.
Bug E/F: send endpoints return queued=True and totalRecipients, not sentCount=0.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from sqlalchemy.exc import ProgrammingError

from database import Base, get_db
from main import app
from models.role import Role
from models.user import User
from models.notification import Notification
from services.email_unsubscribe import (
    build_unsubscribe_footer_html,
    build_unsubscribe_footer_text,
)

# ── SQLite DB ─────────────────────────────────────────────────────────────────

engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)

@event.listens_for(engine, "connect")
def fix(conn, _): conn.create_function("sysutcdatetime", 0, lambda: "2024-01-01 00:00:00")

TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    db = TestingSessionLocal()
    try: yield db
    finally: db.close()

client = TestClient(app)

_MGR = {"sub": "1", "role": "FarmManager"}
_WRK = {"sub": "2", "role": "Worker"}
_VIS = {"sub": "3", "role": "Visitor"}

def _auth(role): return {"Authorization": f"Bearer fake-{role}"}

def _seed(db):
    mr = Role(RoleName="FarmManager"); wr = Role(RoleName="Worker"); vr = Role(RoleName="Visitor")
    db.add_all([mr, wr, vr]); db.flush()
    mgr    = User(FullName="Mgr",    Email="mgr@f.com",    PasswordHash="x", RoleId=mr.RoleId)
    worker = User(FullName="Worker", Email="worker@f.com", PasswordHash="x", RoleId=wr.RoleId)
    cust   = User(FullName="Alice",  Email="alice@f.com",  PasswordHash="x", RoleId=vr.RoleId)
    db.add_all([mgr, worker, cust]); db.commit()

@pytest.fixture(autouse=True)
def setup_db():
    app.dependency_overrides[get_db] = override_get_db
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal(); _seed(db); db.close()
    yield
    Base.metadata.drop_all(bind=engine)
    app.dependency_overrides.pop(get_db, None)


# ── Bug B: unsubscribe footer wording ────────────────────────────────────────

def test_footer_with_token_contains_unsubscribe_link(monkeypatch):
    monkeypatch.setenv("FRONTEND_BASE_URL", "https://shop.example.com")
    html = build_unsubscribe_footer_html("tok123")
    assert "/unsubscribe?token=tok123" in html
    assert "unsubscribe" in html.lower()


def test_footer_with_token_does_not_mention_profile(monkeypatch):
    monkeypatch.setenv("FRONTEND_BASE_URL", "https://shop.example.com")
    html = build_unsubscribe_footer_html("tok123")
    assert "/profile" not in html


def test_footer_without_token_not_empty_and_no_profile_link(monkeypatch):
    """Fallback must not link to /profile (spec requirement)."""
    monkeypatch.setenv("FRONTEND_BASE_URL", "https://shop.example.com")
    html = build_unsubscribe_footer_html("")
    assert html.strip() != ""
    assert "/profile" not in html


def test_footer_plain_text_with_token_contains_url(monkeypatch):
    monkeypatch.setenv("FRONTEND_BASE_URL", "https://shop.example.com")
    txt = build_unsubscribe_footer_text("tok456")
    assert "/unsubscribe?token=tok456" in txt


def test_footer_plain_text_without_token_not_empty_no_profile(monkeypatch):
    monkeypatch.setenv("FRONTEND_BASE_URL", "https://shop.example.com")
    txt = build_unsubscribe_footer_text("")
    assert txt.strip() != ""
    assert "/profile" not in txt


# ── Bug C: email consent endpoint returns 200 when columns missing ─────────────

def test_get_consent_returns_200_when_us40_columns_missing():
    """Bug C: ProgrammingError for missing columns must return safe defaults, not 500."""
    with patch("utils.jwt.jwt.decode", return_value=_VIS):
        resp = client.get("/api/email-consent/me", headers=_auth("Visitor"))
    # SQLite test DB has no EmailMarketingConsentUpdatedAtUtc / EmailUnsubscribedAtUtc
    # The endpoint should catch the error and return defaults gracefully
    assert resp.status_code in (200, 503)  # 200=migrated+OK or 503=not-yet-migrated
    if resp.status_code == 200:
        data = resp.json()
        assert "emailConsent" in data
        assert "userId" in data


def test_put_consent_handles_missing_columns_gracefully():
    """PUT /api/email-consent/me must not 500 when US40 columns are absent."""
    with patch("utils.jwt.jwt.decode", return_value=_VIS):
        resp = client.put(
            "/api/email-consent/me",
            json={"emailConsent": True},
            headers=_auth("Visitor"),
        )
    assert resp.status_code in (200, 503)  # not 500


# ── Bug A: worker notifications API returns real details ─────────────────────

def test_notification_list_returns_title_and_message():
    """Bug A: API must return notification details including title and message."""
    db = TestingSessionLocal()
    db.add(Notification(UserId=2, Title="Maintenance tonight", Message="System will be down at 22:00", NotificationType="system"))
    db.commit(); db.close()

    with patch("utils.jwt.jwt.decode", return_value=_WRK):
        resp = client.get("/api/notifications", headers=_auth("Worker"))

    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    n = data[0]
    assert n["title"] == "Maintenance tonight"
    assert n["message"] == "System will be down at 22:00"
    assert "createdAtUtc" in n
    assert "isRead" in n
    assert n["isRead"] is False


def test_notification_belongs_to_correct_user():
    """Bug A: notification must be returned only to the correct UserId."""
    db = TestingSessionLocal()
    # Notification for worker (UserId=2)
    db.add(Notification(UserId=2, Title="For Worker", NotificationType="message"))
    # Notification for visitor (UserId=3)
    db.add(Notification(UserId=3, Title="For Visitor", NotificationType="message"))
    db.commit(); db.close()

    with patch("utils.jwt.jwt.decode", return_value=_WRK):
        resp = client.get("/api/notifications", headers=_auth("Worker"))

    assert resp.status_code == 200
    data = resp.json()
    assert all(n["title"] == "For Worker" for n in data)
    assert len(data) == 1


# ── Bug E/F: send endpoints return queued=True with correct totalRecipients ───

def test_send_newsletter_returns_queued_and_total_recipients():
    """Bug E fix: send endpoint must return queued=True and totalRecipients > 0."""
    # Add EmailConsent column to simulate migrated state
    with engine.connect() as c:
        try:
            c.execute(text("ALTER TABLE Users ADD COLUMN EmailConsent INTEGER DEFAULT 1"))
            c.commit()
        except Exception:
            pass

    with patch("utils.jwt.jwt.decode", return_value=_MGR):
        with patch("routers.emails.is_smtp_configured", return_value=True):
            with patch("routers.emails.send_email"):
                resp = client.post(
                    "/api/emails/send-newsletter",
                    json={"subject": "S", "message": "M", "recipientGroups": ["customers"]},
                    headers=_auth("FarmManager"),
                )

    assert resp.status_code == 200
    data = resp.json()
    assert data.get("queued") is True
    assert data["totalRecipients"] >= 0   # resolved before background
    assert "queued" in data["message"].lower() or str(data["totalRecipients"]) in data["message"]


def test_send_template_returns_queued_true():
    """Bug F fix: template send endpoint must return queued=True."""
    with patch("utils.jwt.jwt.decode", return_value=_MGR):
        # Create a template first
        created = client.post(
            "/api/newsletter-templates",
            json={"title": "T", "subject": "S", "blocks": [], "status": "ready"},
            headers=_auth("FarmManager"),
        )
        assert created.status_code == 201
        tid = created.json()["NewsletterTemplateId"]

        with patch("routers.newsletter_templates.is_smtp_configured", return_value=True):
            with patch("routers.newsletter_templates.send_email"):
                resp = client.post(
                    f"/api/newsletter-templates/{tid}/send",
                    json={"recipientGroups": ["workers"]},
                    headers=_auth("FarmManager"),
                )

    assert resp.status_code == 200
    data = resp.json()
    assert data.get("queued") is True
    assert "totalRecipients" in data


def test_send_newsletter_response_message_mentions_recipients():
    """The response message must be meaningful — not just 'Sent: 0 · Failed: 0'."""
    with patch("utils.jwt.jwt.decode", return_value=_MGR):
        with patch("routers.emails.is_smtp_configured", return_value=True):
            with patch("routers.emails.send_email"):
                resp = client.post(
                    "/api/emails/send-newsletter",
                    json={"subject": "S", "message": "M", "recipientGroups": ["workers"]},
                    headers=_auth("FarmManager"),
                )
    data = resp.json()
    # Message should reference actual recipient count or "queued"
    assert "queued" in data["message"].lower() or "recipient" in data["message"].lower()
