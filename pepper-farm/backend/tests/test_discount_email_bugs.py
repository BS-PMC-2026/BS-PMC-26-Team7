"""
Regression tests for the US39/US40 discount-email bug fixes.
Bug A: catalog button used href="#" — must now be an absolute URL.
Bug B: unsubscribe footer was absent before migration — must always appear.
Bug C: discount email sending blocked product update response — must run in background.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import json
from datetime import datetime
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base, get_db
from main import app
from models.role import Role
from models.user import User
from routers.products import _build_discount_html

# ── SQLite DB ─────────────────────────────────────────────────────────────────

engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)

@event.listens_for(engine, "connect")
def fix(conn, _):
    conn.create_function("sysutcdatetime", 0, lambda: "2024-01-01 00:00:00")

TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    db = TestingSessionLocal()
    try: yield db
    finally: db.close()

client = TestClient(app)

_MANAGER = {"sub": "1", "role": "FarmManager"}
_VISITOR = {"sub": "2", "role": "Visitor"}

def _auth(role): return {"Authorization": f"Bearer fake-{role}"}

def _seed(db):
    db.execute(text("ALTER TABLE Users ADD COLUMN EmailConsent INTEGER DEFAULT 1"))
    db.commit()
    mr = Role(RoleName="FarmManager"); vr = Role(RoleName="Visitor")
    db.add_all([mr, vr]); db.flush()
    mgr   = User(FullName="Mgr",   Email="mgr@f.com",   PasswordHash="x", RoleId=mr.RoleId)
    cust  = User(FullName="Alice", Email="a@f.com",      PasswordHash="x", RoleId=vr.RoleId)
    db.add_all([mgr, cust]); db.commit()

@pytest.fixture(autouse=True)
def setup_db():
    app.dependency_overrides[get_db] = override_get_db
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal(); _seed(db); db.close()
    yield
    Base.metadata.drop_all(bind=engine)
    app.dependency_overrides.pop(get_db, None)


# ── Bug A: catalog button href must be absolute ───────────────────────────────

def test_discount_html_button_is_not_hash(monkeypatch):
    """Bug A fix: email button must NOT use href='#'."""
    monkeypatch.setenv("FRONTEND_BASE_URL", "https://myshop.example.com")
    html = _build_discount_html("Chili Oil", 100.0, 20.0, None, "")
    assert 'href="#"' not in html
    assert "https://myshop.example.com/visitor/products" in html


def test_discount_html_button_uses_frontend_base_url(monkeypatch):
    monkeypatch.setenv("FRONTEND_BASE_URL", "https://hadinerim.example.com")
    html = _build_discount_html("Pepper", 50.0, 10.0, None, "")
    assert "https://hadinerim.example.com/visitor/products" in html


def test_discount_html_button_defaults_to_localhost(monkeypatch):
    monkeypatch.delenv("FRONTEND_BASE_URL", raising=False)
    html = _build_discount_html("Pepper", 50.0, 10.0, None, "")
    assert "localhost:3000/visitor/products" in html


# ── Bug B: unsubscribe footer must always appear ──────────────────────────────

def test_discount_html_with_token_has_unsubscribe_link(monkeypatch):
    """With a valid token, href must point to /unsubscribe?token=..."""
    monkeypatch.setenv("FRONTEND_BASE_URL", "https://shop.example.com")
    html = _build_discount_html("Pepper", 50.0, 10.0, None, "mytoken123")
    assert "/unsubscribe?token=mytoken123" in html


def test_discount_html_without_token_has_fallback_footer(monkeypatch):
    """Bug B fix: footer must never be empty; spec says no profile link in fallback."""
    monkeypatch.setenv("FRONTEND_BASE_URL", "https://shop.example.com")
    html = _build_discount_html("Pepper", 50.0, 10.0, None, "")
    # Must have SOME footer content — but no profile link per spec
    assert "<p" in html.lower()
    assert "/profile" not in html


def test_discount_html_includes_price_details():
    html = _build_discount_html("Chili Oil", 100.0, 25.0, None, "tok")
    assert "75.00" in html        # final price
    assert "25% OFF" in html or "25.00" in html   # discount


def test_discount_html_with_expiry_date():
    end = datetime(2025, 12, 31)
    html = _build_discount_html("Oil", 50.0, 10.0, end, "tok")
    assert "2025-12-31" in html


# ── Bug C: product update must return quickly (BackgroundTasks) ───────────────

def test_product_create_with_discount_queues_email_not_blocks(monkeypatch):
    """Bug C fix: create endpoint must schedule email in background, return immediately."""
    monkeypatch.setenv("FRONTEND_BASE_URL", "http://localhost:3000")

    with patch("utils.jwt.jwt.decode", return_value=_MANAGER):
        with patch("routers.products.is_smtp_configured", return_value=True):
            smtp_calls = []
            with patch("routers.products.send_email", side_effect=lambda *a, **kw: smtp_calls.append(a)):
                # The endpoint schedules email in background — FastAPI TestClient
                # runs background tasks synchronously in test mode.
                resp = client.post(
                    "/api/products",
                    json={
                        "ProductName": "DiscountPepper",
                        "Price": 100.0,
                        "DiscountActive": True,
                        "DiscountPercentage": 20.0,
                        "IsActive": True,
                    },
                    headers=_auth("FarmManager"),
                )

    assert resp.status_code == 201
    data = resp.json()
    # The response should confirm email was queued
    assert data.get("emailNotificationSent") is True


def test_product_update_succeeds_even_if_smtp_fails(monkeypatch):
    """Bug C fix: product update must not fail if SMTP errors in background."""
    monkeypatch.setenv("FRONTEND_BASE_URL", "http://localhost:3000")

    # First create a product
    with patch("utils.jwt.jwt.decode", return_value=_MANAGER):
        created = client.post(
            "/api/products",
            json={"ProductName": "BackgroundTest", "Price": 50.0, "IsActive": True},
            headers=_auth("FarmManager"),
        )
    assert created.status_code == 201
    pid = created.json()["ProductId"]

    # Update with a discount — SMTP will raise an exception
    with patch("utils.jwt.jwt.decode", return_value=_MANAGER):
        with patch("routers.products.is_smtp_configured", return_value=True):
            with patch("routers.products.send_email", side_effect=Exception("SMTP down")):
                resp = client.put(
                    f"/api/products/{pid}",
                    json={
                        "ProductName": "BackgroundTest",
                        "Price": 50.0,
                        "DiscountActive": True,
                        "DiscountPercentage": 15.0,
                        "IsActive": True,
                    },
                    headers=_auth("FarmManager"),
                )

    # Product update must succeed regardless of SMTP failure
    assert resp.status_code == 200
    assert resp.json()["DiscountActive"] is True


# ── Newsletter email also includes unsubscribe link ───────────────────────────

def test_newsletter_send_includes_unsubscribe_link():
    """Both newsletter and template sends must include an unsubscribe-related footer."""
    from routers.emails import _build_html
    import os
    os.environ["FRONTEND_BASE_URL"] = "https://shop.example.com"
    html = _build_html("Test Subject", "Test message", "mytoken")
    assert "unsubscribe" in html.lower() or "/unsubscribe?token=mytoken" in html


# ── Notifications table missing → controlled response ────────────────────────

def test_notifications_unread_count_returns_zero_when_table_missing():
    """Bug F fix: missing Notifications table must return 0, not crash with 500."""
    with patch("utils.jwt.jwt.decode", return_value=_VISITOR):
        # SQLite DB has Notifications table from create_all — drop it to simulate missing
        with engine.connect() as c:
            try: c.execute(text("DROP TABLE IF EXISTS Notifications")); c.commit()
            except Exception: pass
        resp = client.get("/api/notifications/unread-count", headers=_auth("Visitor"))
    # Must return 0 (graceful), not 500
    assert resp.status_code == 200
    assert resp.json()["unreadCount"] == 0


def test_notifications_list_returns_empty_when_table_missing():
    with patch("utils.jwt.jwt.decode", return_value=_VISITOR):
        with engine.connect() as c:
            try: c.execute(text("DROP TABLE IF EXISTS Notifications")); c.commit()
            except Exception: pass
        resp = client.get("/api/notifications", headers=_auth("Visitor"))
    assert resp.status_code == 200
    assert resp.json() == []
