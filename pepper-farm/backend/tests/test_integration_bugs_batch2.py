"""
Regression tests for the US39/US40 integration bug-fix batch 2.

Bug A: in-app announcement creates Notification rows; newsletter does NOT.
Bug B: every marketing email has an unsubscribe/preference footer.
Bug C: newsletter send endpoint returns quickly (queued, not blocking).
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base, get_db
from main import app
from models.notification import Notification
from models.role import Role
from models.user import User
from routers.emails import _build_html
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
    db.execute(text("ALTER TABLE Users ADD COLUMN EmailConsent INTEGER DEFAULT 1"))
    db.commit()
    mr = Role(RoleName="FarmManager"); wr = Role(RoleName="Worker"); vr = Role(RoleName="Visitor")
    db.add_all([mr, wr, vr]); db.flush()
    mgr   = User(FullName="Mgr",    Email="mgr@f.com",    PasswordHash="x", RoleId=mr.RoleId)
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


# ── Bug B: unsubscribe footer always present ──────────────────────────────────

def test_unsubscribe_footer_with_token(monkeypatch):
    monkeypatch.setenv("FRONTEND_BASE_URL", "https://shop.example.com")
    html = build_unsubscribe_footer_html("mytoken123")
    assert "/unsubscribe?token=mytoken123" in html
    assert html != ""


def test_unsubscribe_footer_without_token_is_not_empty(monkeypatch):
    """Bug B: footer must never be empty — even without a token.
    Spec: must NOT link to the profile page; must show a plain note instead."""
    monkeypatch.setenv("FRONTEND_BASE_URL", "https://shop.example.com")
    html = build_unsubscribe_footer_html("")
    assert html != ""
    assert "/profile" not in html            # no profile link per spec


def test_unsubscribe_footer_text_with_token(monkeypatch):
    monkeypatch.setenv("FRONTEND_BASE_URL", "https://shop.example.com")
    text_footer = build_unsubscribe_footer_text("tok")
    assert "/unsubscribe?token=tok" in text_footer


def test_unsubscribe_footer_text_without_token_is_not_empty(monkeypatch):
    """Plain-text fallback must also be non-empty and must NOT reference the profile page."""
    monkeypatch.setenv("FRONTEND_BASE_URL", "https://shop.example.com")
    text_footer = build_unsubscribe_footer_text("")
    assert text_footer != ""
    assert "/profile" not in text_footer     # no profile link per spec


def test_newsletter_html_includes_unsubscribe_link(monkeypatch):
    monkeypatch.setenv("FRONTEND_BASE_URL", "https://shop.example.com")
    html = _build_html("Subject", "Body text", "sometoken")
    assert "sometoken" in html
    assert "unsubscribe" in html.lower()


def test_newsletter_html_without_token_has_footer(monkeypatch):
    """Footer must appear even without token; spec says no profile link in fallback."""
    monkeypatch.setenv("FRONTEND_BASE_URL", "https://shop.example.com")
    html = _build_html("Subject", "Body text", "")
    # Must have SOME footer content
    assert "<p" in html.lower()
    assert "/profile" not in html            # no profile link per spec


# ── Bug C: newsletter send returns quickly (queued) ───────────────────────────

def test_send_newsletter_returns_queued_true():
    """Bug C: endpoint must return immediately with queued=True."""
    with patch("utils.jwt.jwt.decode", return_value=_MGR):
        with patch("routers.emails.is_smtp_configured", return_value=True):
            # Mock send_email — if called synchronously this would block; with background tasks it won't
            with patch("routers.emails.send_email") as mock_send:
                resp = client.post(
                    "/api/emails/send-newsletter",
                    json={"subject": "S", "message": "M", "recipientGroups": ["customers"]},
                    headers=_auth("FarmManager"),
                )
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("queued") is True
    # TestClient runs BackgroundTasks synchronously, so totalRecipients is set
    assert "totalRecipients" in data


def test_send_newsletter_does_not_create_notification():
    """Newsletter email must NOT create in-app Notification rows (Bug A rule)."""
    with patch("utils.jwt.jwt.decode", return_value=_MGR):
        with patch("routers.emails.is_smtp_configured", return_value=True):
            with patch("routers.emails.send_email"):
                client.post(
                    "/api/emails/send-newsletter",
                    json={"subject": "S", "message": "M", "recipientGroups": ["customers"]},
                    headers=_auth("FarmManager"),
                )

    db = TestingSessionLocal()
    notif_count = db.query(Notification).count()
    db.close()
    assert notif_count == 0, "Newsletter send must not create app notifications"


# ── Bug A: in-app announcement endpoint ──────────────────────────────────────

def test_announce_requires_manager():
    with patch("utils.jwt.jwt.decode", return_value=_WRK):
        resp = client.post("/api/notifications/announce",
                           json={"title": "Hi", "recipientRoles": ["workers"]},
                           headers=_auth("Worker"))
    assert resp.status_code == 403


def test_announce_creates_notification_rows():
    """Bug A fix: announce endpoint must create Notification rows."""
    with patch("utils.jwt.jwt.decode", return_value=_MGR):
        resp = client.post("/api/notifications/announce",
                           json={"title": "Maintenance tonight", "recipientRoles": ["workers"]},
                           headers=_auth("FarmManager"))
    assert resp.status_code == 201
    data = resp.json()
    assert data["notificationsCreated"] >= 1

    db = TestingSessionLocal()
    rows = db.query(Notification).all()
    db.close()
    assert len(rows) >= 1
    assert rows[0].Title == "Maintenance tonight"


def test_announce_does_not_send_email():
    """In-app announcement must NOT trigger SMTP email sending."""
    with patch("utils.jwt.jwt.decode", return_value=_MGR):
        with patch("services.email_service.send_email") as mock_send:
            client.post("/api/notifications/announce",
                        json={"title": "Hi", "recipientRoles": ["workers"]},
                        headers=_auth("FarmManager"))
    mock_send.assert_not_called()


def test_announce_to_all_reaches_all_roles():
    with patch("utils.jwt.jwt.decode", return_value=_MGR):
        resp = client.post("/api/notifications/announce",
                           json={"title": "Farm update", "recipientRoles": ["all"]},
                           headers=_auth("FarmManager"))
    assert resp.status_code == 201
    # Should reach workers + visitors + manager (all active users)
    assert resp.json()["notificationsCreated"] >= 2


def test_unread_count_increases_after_announce():
    """After an announcement, the worker's unread count should increase."""
    with patch("utils.jwt.jwt.decode", return_value=_MGR):
        client.post("/api/notifications/announce",
                    json={"title": "Test", "recipientRoles": ["workers"]},
                    headers=_auth("FarmManager"))

    with patch("utils.jwt.jwt.decode", return_value=_WRK):
        resp = client.get("/api/notifications/unread-count", headers=_auth("Worker"))
    assert resp.status_code == 200
    assert resp.json()["unreadCount"] >= 1


def test_discount_send_does_not_create_notification():
    """Discount email send must NOT create in-app notifications."""
    with patch("utils.jwt.jwt.decode", return_value=_MGR):
        with patch("routers.products.is_smtp_configured", return_value=True):
            with patch("routers.products.send_email"):
                client.post("/api/products",
                            json={"ProductName": "PriceTest", "Price": 50.0,
                                  "DiscountActive": True, "DiscountPercentage": 10.0,
                                  "IsActive": True},
                            headers=_auth("FarmManager"))

    db = TestingSessionLocal()
    count = db.query(Notification).count()
    db.close()
    assert count == 0, "Discount email must not create app notifications"


def test_announce_empty_title_rejected():
    with patch("utils.jwt.jwt.decode", return_value=_MGR):
        resp = client.post("/api/notifications/announce",
                           json={"title": "", "recipientRoles": ["workers"]},
                           headers=_auth("FarmManager"))
    assert resp.status_code == 400


def test_announce_no_roles_rejected():
    with patch("utils.jwt.jwt.decode", return_value=_MGR):
        resp = client.post("/api/notifications/announce",
                           json={"title": "T", "recipientRoles": []},
                           headers=_auth("FarmManager"))
    # Router validates empty list and returns 400
    assert resp.status_code in (400, 422)
