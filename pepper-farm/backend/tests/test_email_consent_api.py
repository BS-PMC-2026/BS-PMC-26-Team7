"""Tests for routers/email_consent.py (US40)."""
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
from models.role import Role
from models.user import User

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

_VISITOR_TOKEN   = {"sub": "1", "role": "Visitor"}
_MANAGER_TOKEN   = {"sub": "2", "role": "FarmManager"}

def _auth(role: str) -> dict:
    return {"Authorization": f"Bearer fake-{role}"}

def _seed(db):
    db.execute(text("ALTER TABLE Users ADD COLUMN EmailConsent INTEGER DEFAULT 0"))
    db.execute(text("ALTER TABLE Users ADD COLUMN EmailMarketingConsentUpdatedAtUtc TEXT NULL"))
    db.execute(text("ALTER TABLE Users ADD COLUMN EmailUnsubscribeToken TEXT NULL"))
    db.execute(text("ALTER TABLE Users ADD COLUMN EmailUnsubscribedAtUtc TEXT NULL"))
    db.commit()
    mr = Role(RoleName="FarmManager"); vr = Role(RoleName="Visitor")
    db.add_all([mr, vr]); db.flush()
    visitor = User(FullName="Alice", Email="alice@farm.com", PasswordHash="x", RoleId=vr.RoleId)
    manager = User(FullName="Mgr",   Email="mgr@farm.com",   PasswordHash="x", RoleId=mr.RoleId)
    db.add_all([visitor, manager]); db.commit()

@pytest.fixture(autouse=True)
def setup_db():
    app.dependency_overrides[get_db] = override_get_db
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal(); _seed(db); db.close()
    yield
    Base.metadata.drop_all(bind=engine)
    app.dependency_overrides.pop(get_db, None)


# ── Auth ──────────────────────────────────────────────────────────────────────

def test_get_consent_requires_auth():
    assert client.get("/api/email-consent/me").status_code == 401

def test_update_consent_requires_auth():
    assert client.put("/api/email-consent/me", json={"emailConsent": True}).status_code == 401


# ── GET /api/email-consent/me ─────────────────────────────────────────────────

def test_get_consent_returns_own_status():
    with patch("utils.jwt.jwt.decode", return_value=_VISITOR_TOKEN):
        resp = client.get("/api/email-consent/me", headers=_auth("Visitor"))
    assert resp.status_code == 200
    data = resp.json()
    assert "emailConsent" in data
    assert "userId" in data
    assert data["emailConsent"] is False  # default is 0 = False


# ── PUT /api/email-consent/me ─────────────────────────────────────────────────

def test_update_consent_to_true():
    with patch("utils.jwt.jwt.decode", return_value=_VISITOR_TOKEN):
        resp = client.put("/api/email-consent/me", json={"emailConsent": True}, headers=_auth("Visitor"))
    assert resp.status_code == 200
    assert resp.json()["emailConsent"] is True

def test_update_consent_to_false_sets_unsubscribed_at():
    with patch("utils.jwt.jwt.decode", return_value=_VISITOR_TOKEN):
        # First subscribe
        client.put("/api/email-consent/me", json={"emailConsent": True}, headers=_auth("Visitor"))
        # Then unsubscribe
        resp = client.put("/api/email-consent/me", json={"emailConsent": False}, headers=_auth("Visitor"))
    assert resp.status_code == 200
    data = resp.json()
    assert data["emailConsent"] is False
    assert data["emailUnsubscribedAtUtc"] is not None

def test_user_can_re_subscribe_after_unsubscribe():
    with patch("utils.jwt.jwt.decode", return_value=_VISITOR_TOKEN):
        client.put("/api/email-consent/me", json={"emailConsent": False}, headers=_auth("Visitor"))
        resp = client.put("/api/email-consent/me", json={"emailConsent": True}, headers=_auth("Visitor"))
    assert resp.status_code == 200
    data = resp.json()
    assert data["emailConsent"] is True
    # Re-subscribe clears unsubscribed timestamp
    assert data["emailUnsubscribedAtUtc"] is None


# ── GET /api/email-consent/unsubscribe?token=... ──────────────────────────────

def test_unsubscribe_with_valid_token():
    # Plant a token in the DB
    db = TestingSessionLocal()
    db.execute(text("UPDATE Users SET EmailUnsubscribeToken = 'validtoken123', EmailConsent = 1 WHERE UserId = 1"))
    db.commit(); db.close()

    resp = client.get("/api/email-consent/unsubscribe?token=validtoken123")
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert "unsubscribed" in data["message"].lower()

def test_unsubscribe_sets_consent_false():
    db = TestingSessionLocal()
    db.execute(text("UPDATE Users SET EmailUnsubscribeToken = 'mytoken', EmailConsent = 1 WHERE UserId = 1"))
    db.commit(); db.close()

    client.get("/api/email-consent/unsubscribe?token=mytoken")

    db = TestingSessionLocal()
    row = db.execute(text("SELECT EmailConsent, EmailUnsubscribedAtUtc FROM Users WHERE UserId = 1")).fetchone()
    db.close()
    assert row[0] == 0
    assert row[1] is not None

def test_unsubscribe_invalid_token_returns_success_false():
    resp = client.get("/api/email-consent/unsubscribe?token=badtoken_xyz")
    assert resp.status_code == 200
    assert resp.json()["success"] is False

def test_already_unsubscribed_returns_already_message():
    db = TestingSessionLocal()
    db.execute(text("UPDATE Users SET EmailUnsubscribeToken = 'tok2', EmailConsent = 0, EmailUnsubscribedAtUtc = '2024-01-01' WHERE UserId = 1"))
    db.commit(); db.close()

    resp = client.get("/api/email-consent/unsubscribe?token=tok2")
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert "already" in data["message"].lower()

def test_unsubscribe_missing_token_returns_422():
    resp = client.get("/api/email-consent/unsubscribe")
    assert resp.status_code == 422


# ── Registration with emailConsent field ──────────────────────────────────────

def test_register_default_email_consent_false():
    resp = client.post("/api/auth/register", json={
        "fullName": "New User", "email": "new@farm.com", "password": "Test123",
    })
    assert resp.status_code == 201
    # Check DB — consent should remain 0 (default)
    db = TestingSessionLocal()
    row = db.execute(text("SELECT EmailConsent FROM Users WHERE Email = 'new@farm.com'")).fetchone()
    db.close()
    assert row is not None
    assert row[0] == 0

def test_register_with_email_consent_true_saves_consent():
    resp = client.post("/api/auth/register", json={
        "fullName": "Opted In", "email": "optin@farm.com", "password": "Test123",
        "emailConsent": True,
    })
    assert resp.status_code == 201
    db = TestingSessionLocal()
    row = db.execute(text("SELECT EmailConsent FROM Users WHERE Email = 'optin@farm.com'")).fetchone()
    db.close()
    assert row[0] == 1
