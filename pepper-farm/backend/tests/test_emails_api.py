"""Integration tests for routers/emails.py (US39)."""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import models  # noqa: F401 — register all ORM models with Base.metadata
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from sqlalchemy import text
from database import Base, get_db
from main import app
from models.role import Role
from models.user import User


# ── In-memory SQLite DB (StaticPool so all connections share the same DB) ─────

engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)


@event.listens_for(engine, "connect")
def sqlite_fix(dbapi_connection, connection_record):
    dbapi_connection.create_function("sysutcdatetime", 0, lambda: "2024-01-01 00:00:00")


TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


client = TestClient(app)


# ── Fixtures ──────────────────────────────────────────────────────────────────

def _manager_token() -> dict:
    return {"sub": "1", "role": "FarmManager"}


def _worker_token() -> dict:
    return {"sub": "2", "role": "Worker"}


def _get_auth(role: str) -> dict:
    token = "fake-manager" if role == "FarmManager" else "fake-worker"
    return {"Authorization": f"Bearer {token}"}


def _seed_db(db):
    """Insert minimal roles + users for tests.

    EmailConsent is NOT a mapped ORM column (it's added by migration in production).
    We simulate it in SQLite by:
      1. Adding the column via ALTER TABLE after create_all.
      2. Setting it to 0 for Bob (opted-out) via raw SQL UPDATE.
    All other users default to EmailConsent = 1 (from the DEFAULT constraint).
    """
    # Add EmailConsent column to the SQLite test DB to match the production schema.
    try:
        db.execute(text("ALTER TABLE Users ADD COLUMN EmailConsent INTEGER DEFAULT 1"))
        db.execute(text("UPDATE Users SET EmailConsent = 1"))
        db.commit()
    except Exception:
        db.rollback()

    manager_role = Role(RoleName="FarmManager")
    visitor_role = Role(RoleName="Visitor")
    worker_role  = Role(RoleName="Worker")
    db.add_all([manager_role, visitor_role, worker_role])
    db.flush()

    manager      = User(FullName="Manager", Email="manager@farm.com",
                        PasswordHash="x", RoleId=manager_role.RoleId)
    customer_yes = User(FullName="Alice",   Email="alice@example.com",
                        PasswordHash="x", RoleId=visitor_role.RoleId)
    customer_no  = User(FullName="Bob",     Email="bob@example.com",
                        PasswordHash="x", RoleId=visitor_role.RoleId)
    worker       = User(FullName="Worker1", Email="worker1@farm.com",
                        PasswordHash="x", RoleId=worker_role.RoleId)
    db.add_all([manager, customer_yes, customer_no, worker])
    db.commit()

    # Bob (customer_no) opts out of email notifications.
    db.execute(text("UPDATE Users SET EmailConsent = 0 WHERE Email = 'bob@example.com'"))
    db.commit()


@pytest.fixture(autouse=True)
def setup_db():
    app.dependency_overrides[get_db] = override_get_db
    Base.metadata.drop_all(bind=engine)   # clean slate (in case a previous run left tables)
    Base.metadata.create_all(bind=engine) # create ALL tables (all models are now registered)
    db = TestingSessionLocal()
    try:
        _seed_db(db)
        yield
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)
        app.dependency_overrides.pop(get_db, None)


# ── Authentication / Authorization ───────────────────────────────────────────

def test_send_newsletter_requires_auth():
    resp = client.post("/api/emails/send-newsletter", json={
        "subject": "Hello",
        "message": "World",
        "recipientGroups": ["customers"],
    })
    assert resp.status_code == 401


def test_get_logs_requires_auth():
    resp = client.get("/api/emails/logs")
    assert resp.status_code == 401


def test_send_newsletter_forbidden_for_worker():
    with patch("utils.jwt.jwt.decode", return_value=_worker_token()):
        resp = client.post(
            "/api/emails/send-newsletter",
            json={"subject": "Hi", "message": "Body", "recipientGroups": ["customers"]},
            headers=_get_auth("Worker"),
        )
    assert resp.status_code == 403


def test_get_logs_forbidden_for_worker():
    with patch("utils.jwt.jwt.decode", return_value=_worker_token()):
        resp = client.get("/api/emails/logs", headers=_get_auth("Worker"))
    assert resp.status_code == 403


# ── Validation ────────────────────────────────────────────────────────────────

def test_send_newsletter_empty_subject_rejected():
    with patch("utils.jwt.jwt.decode", return_value=_manager_token()):
        with patch("routers.emails.is_smtp_configured", return_value=True):
            resp = client.post(
                "/api/emails/send-newsletter",
                json={"subject": "", "message": "Body", "recipientGroups": ["customers"]},
                headers=_get_auth("FarmManager"),
            )
    assert resp.status_code in (400, 422)


def test_send_newsletter_empty_message_rejected():
    with patch("utils.jwt.jwt.decode", return_value=_manager_token()):
        with patch("routers.emails.is_smtp_configured", return_value=True):
            resp = client.post(
                "/api/emails/send-newsletter",
                json={"subject": "Subject", "message": "", "recipientGroups": ["customers"]},
                headers=_get_auth("FarmManager"),
            )
    assert resp.status_code in (400, 422)


def test_send_newsletter_no_groups_rejected():
    with patch("utils.jwt.jwt.decode", return_value=_manager_token()):
        with patch("routers.emails.is_smtp_configured", return_value=True):
            resp = client.post(
                "/api/emails/send-newsletter",
                json={"subject": "Subj", "message": "Body", "recipientGroups": []},
                headers=_get_auth("FarmManager"),
            )
    assert resp.status_code in (400, 422)


def test_send_newsletter_smtp_not_configured_returns_503():
    with patch("utils.jwt.jwt.decode", return_value=_manager_token()):
        with patch("routers.emails.is_smtp_configured", return_value=False):
            resp = client.post(
                "/api/emails/send-newsletter",
                json={"subject": "Hi", "message": "Body", "recipientGroups": ["customers"]},
                headers=_get_auth("FarmManager"),
            )
    assert resp.status_code == 503


# ── Recipient filtering ───────────────────────────────────────────────────────

def test_send_newsletter_only_opted_in_customers_emailed():
    sent_to: list[str] = []

    def mock_send(to, subject, html, text=""):
        sent_to.append(to)

    with patch("utils.jwt.jwt.decode", return_value=_manager_token()):
        with patch("routers.emails.is_smtp_configured", return_value=True):
            with patch("routers.emails.send_email", side_effect=mock_send):
                resp = client.post(
                    "/api/emails/send-newsletter",
                    json={"subject": "Promo", "message": "Big sale", "recipientGroups": ["customers"]},
                    headers=_get_auth("FarmManager"),
                )

    assert resp.status_code == 200
    data = resp.json()
    # Only alice (consent=True) should be emailed; bob (consent=False) should not.
    assert "alice@example.com" in sent_to
    assert "bob@example.com" not in sent_to
    # The endpoint queues sends via BackgroundTasks and returns sentCount=0 immediately.
    # Verify via totalRecipients that exactly one recipient was resolved.
    assert data["totalRecipients"] == 1


def test_send_newsletter_workers_group_includes_workers():
    sent_to: list[str] = []

    def mock_send(to, subject, html, text=""):
        sent_to.append(to)

    with patch("utils.jwt.jwt.decode", return_value=_manager_token()):
        with patch("routers.emails.is_smtp_configured", return_value=True):
            with patch("routers.emails.send_email", side_effect=mock_send):
                resp = client.post(
                    "/api/emails/send-newsletter",
                    json={"subject": "Staff note", "message": "Meeting", "recipientGroups": ["workers"]},
                    headers=_get_auth("FarmManager"),
                )

    assert resp.status_code == 200
    assert "worker1@farm.com" in sent_to
    assert "alice@example.com" not in sent_to


# ── Email logs ────────────────────────────────────────────────────────────────

def test_send_newsletter_creates_logs_for_sent():
    with patch("utils.jwt.jwt.decode", return_value=_manager_token()):
        with patch("routers.emails.is_smtp_configured", return_value=True):
            with patch("routers.emails.send_email"):
                with patch("routers.emails.SessionLocal", new=TestingSessionLocal):
                    client.post(
                        "/api/emails/send-newsletter",
                        json={"subject": "Test", "message": "Hello", "recipientGroups": ["customers"]},
                        headers=_get_auth("FarmManager"),
                    )

        resp = client.get("/api/emails/logs", headers=_get_auth("FarmManager"))

    assert resp.status_code == 200
    logs = resp.json()
    sent_logs = [l for l in logs if l["Status"] == "sent"]
    assert len(sent_logs) >= 1
    assert sent_logs[0]["RecipientEmail"] == "alice@example.com"


def test_send_newsletter_creates_logs_for_failed():
    def boom(to, subject, html, text=""):
        raise Exception("SMTP error")

    with patch("utils.jwt.jwt.decode", return_value=_manager_token()):
        with patch("routers.emails.is_smtp_configured", return_value=True):
            with patch("routers.emails.send_email", side_effect=boom):
                with patch("routers.emails.SessionLocal", new=TestingSessionLocal):
                    client.post(
                        "/api/emails/send-newsletter",
                        json={"subject": "Fail", "message": "Body", "recipientGroups": ["customers"]},
                        headers=_get_auth("FarmManager"),
                    )

        resp = client.get("/api/emails/logs", headers=_get_auth("FarmManager"))

    assert resp.status_code == 200
    logs = resp.json()
    failed_logs = [l for l in logs if l["Status"] == "failed"]
    assert len(failed_logs) >= 1
    assert "SMTP error" in failed_logs[0]["ErrorMessage"]


def test_get_logs_returns_list():
    with patch("utils.jwt.jwt.decode", return_value=_manager_token()):
        resp = client.get("/api/emails/logs", headers=_get_auth("FarmManager"))
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


# ── Summary response fields ───────────────────────────────────────────────────

def test_send_newsletter_response_has_summary_fields():
    with patch("utils.jwt.jwt.decode", return_value=_manager_token()):
        with patch("routers.emails.is_smtp_configured", return_value=True):
            with patch("routers.emails.send_email"):
                resp = client.post(
                    "/api/emails/send-newsletter",
                    json={"subject": "S", "message": "M", "recipientGroups": ["customers"]},
                    headers=_get_auth("FarmManager"),
                )
    assert resp.status_code == 200
    data = resp.json()
    assert "totalRecipients" in data
    assert "sentCount" in data
    assert "failedCount" in data
    assert "skippedCount" in data
    assert "message" in data
