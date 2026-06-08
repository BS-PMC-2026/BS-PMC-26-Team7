"""Tests for routers/newsletter_templates.py and supporting service (US39 extension)."""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import models  # noqa: F401 — register all ORM models with Base.metadata
import json
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
from services.newsletter_template_service import render_html, render_plain_text
from models.newsletter_template import NewsletterTemplate


# ── DB setup ──────────────────────────────────────────────────────────────────

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


def _manager_token() -> dict:
    return {"sub": "1", "role": "FarmManager"}


def _worker_token() -> dict:
    return {"sub": "2", "role": "Worker"}


def _auth(role: str) -> dict:
    return {"Authorization": f"Bearer fake-{role}"}


def _seed(db):
    # Add EmailConsent to the SQLite test DB (matches production schema after migration).
    try:
        db.execute(text("ALTER TABLE Users ADD COLUMN EmailConsent INTEGER DEFAULT 1"))
        db.commit()
    except Exception:
        db.rollback()

    mr = Role(RoleName="FarmManager")
    vr = Role(RoleName="Visitor")
    wr = Role(RoleName="Worker")
    db.add_all([mr, vr, wr])
    db.flush()
    mgr  = User(FullName="Manager", Email="mgr@farm.com",
                PasswordHash="x", RoleId=mr.RoleId)
    cust = User(FullName="Alice",   Email="alice@example.com",
                PasswordHash="x", RoleId=vr.RoleId)
    wrk  = User(FullName="Bob",     Email="bob@farm.com",
                PasswordHash="x", RoleId=wr.RoleId)
    db.add_all([mgr, cust, wrk])
    db.commit()


@pytest.fixture(autouse=True)
def setup_db():
    app.dependency_overrides[get_db] = override_get_db
    Base.metadata.drop_all(bind=engine)   # clean slate
    Base.metadata.create_all(bind=engine) # create ALL tables (all models registered)
    db = TestingSessionLocal()
    try:
        _seed(db)
        yield
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)
        app.dependency_overrides.pop(get_db, None)


# ── Auth / Role enforcement ───────────────────────────────────────────────────

def test_list_templates_requires_auth():
    resp = client.get("/api/newsletter-templates")
    assert resp.status_code == 401


def test_create_template_requires_auth():
    resp = client.post("/api/newsletter-templates", json={"title": "T", "subject": "S", "blocks": [], "status": "draft"})
    assert resp.status_code == 401


def test_list_templates_forbidden_for_worker():
    with patch("utils.jwt.jwt.decode", return_value=_worker_token()):
        resp = client.get("/api/newsletter-templates", headers=_auth("Worker"))
    assert resp.status_code == 403


def test_create_template_forbidden_for_worker():
    with patch("utils.jwt.jwt.decode", return_value=_worker_token()):
        resp = client.post("/api/newsletter-templates",
                           json={"title": "T", "subject": "S", "blocks": [], "status": "draft"},
                           headers=_auth("Worker"))
    assert resp.status_code == 403


# ── CRUD ─────────────────────────────────────────────────────────────────────

def test_create_and_list_template():
    with patch("utils.jwt.jwt.decode", return_value=_manager_token()):
        create_resp = client.post(
            "/api/newsletter-templates",
            json={"title": "Weekly Update", "subject": "Farm News", "blocks": [], "status": "draft"},
            headers=_auth("FarmManager"),
        )
        assert create_resp.status_code == 201
        data = create_resp.json()
        assert data["title"] == "Weekly Update"
        assert data["status"] == "draft"

        list_resp = client.get("/api/newsletter-templates", headers=_auth("FarmManager"))
        assert list_resp.status_code == 200
        ids = [t["NewsletterTemplateId"] for t in list_resp.json()]
        assert data["NewsletterTemplateId"] in ids


def test_get_template_by_id():
    with patch("utils.jwt.jwt.decode", return_value=_manager_token()):
        created = client.post(
            "/api/newsletter-templates",
            json={"title": "T", "subject": "S", "blocks": [], "status": "draft"},
            headers=_auth("FarmManager"),
        ).json()
        tid = created["NewsletterTemplateId"]
        resp = client.get(f"/api/newsletter-templates/{tid}", headers=_auth("FarmManager"))
        assert resp.status_code == 200
        assert resp.json()["NewsletterTemplateId"] == tid


def test_get_nonexistent_template_returns_404():
    with patch("utils.jwt.jwt.decode", return_value=_manager_token()):
        resp = client.get("/api/newsletter-templates/99999", headers=_auth("FarmManager"))
    assert resp.status_code == 404


def test_update_template():
    with patch("utils.jwt.jwt.decode", return_value=_manager_token()):
        created = client.post(
            "/api/newsletter-templates",
            json={"title": "Old", "subject": "Old Subject", "blocks": [], "status": "draft"},
            headers=_auth("FarmManager"),
        ).json()
        tid = created["NewsletterTemplateId"]

        updated = client.put(
            f"/api/newsletter-templates/{tid}",
            json={"title": "New Title", "subject": "New Subject", "blocks": [{"type": "heading", "text": "Hi"}], "status": "ready"},
            headers=_auth("FarmManager"),
        )
        assert updated.status_code == 200
        body = updated.json()
        assert body["title"] == "New Title"
        assert body["status"] == "ready"
        assert len(body["blocks"]) == 1


def test_archive_template():
    with patch("utils.jwt.jwt.decode", return_value=_manager_token()):
        created = client.post(
            "/api/newsletter-templates",
            json={"title": "T", "subject": "S", "blocks": [], "status": "ready"},
            headers=_auth("FarmManager"),
        ).json()
        tid = created["NewsletterTemplateId"]

        archived = client.delete(f"/api/newsletter-templates/{tid}", headers=_auth("FarmManager"))
        assert archived.status_code == 200
        assert archived.json()["status"] == "archived"

        # Archived templates should not appear in list
        list_resp = client.get("/api/newsletter-templates", headers=_auth("FarmManager"))
        ids = [t["NewsletterTemplateId"] for t in list_resp.json()]
        assert tid not in ids


# ── Preview ───────────────────────────────────────────────────────────────────

def test_preview_template_returns_html_and_text():
    with patch("utils.jwt.jwt.decode", return_value=_manager_token()):
        created = client.post(
            "/api/newsletter-templates",
            json={
                "title": "Preview Test",
                "subject": "Farm Newsletter",
                "blocks": [{"type": "heading", "text": "Welcome"}, {"type": "paragraph", "text": "Hello world"}],
                "status": "draft",
            },
            headers=_auth("FarmManager"),
        ).json()
        tid = created["NewsletterTemplateId"]

        preview = client.get(f"/api/newsletter-templates/{tid}/preview", headers=_auth("FarmManager"))
        assert preview.status_code == 200
        body = preview.json()
        assert "html" in body
        assert "plainText" in body
        assert "Welcome" in body["html"]
        assert "Hello world" in body["html"]
        assert "<!DOCTYPE html" in body["html"].lower() or "<!doctype html" in body["html"].lower()


# ── Send (mocked SMTP) ────────────────────────────────────────────────────────

def test_send_template_requires_smtp():
    with patch("utils.jwt.jwt.decode", return_value=_manager_token()):
        created = client.post(
            "/api/newsletter-templates",
            json={"title": "T", "subject": "S", "blocks": [], "status": "ready"},
            headers=_auth("FarmManager"),
        ).json()
        tid = created["NewsletterTemplateId"]

        with patch("routers.newsletter_templates.is_smtp_configured", return_value=False):
            resp = client.post(f"/api/newsletter-templates/{tid}/send",
                               json={"recipientGroups": ["customers"]},
                               headers=_auth("FarmManager"))
    assert resp.status_code == 503


def test_send_template_uses_mocked_smtp():
    sent_to: list[str] = []

    def mock_send(to, subject, html, text=""):
        sent_to.append(to)

    with patch("utils.jwt.jwt.decode", return_value=_manager_token()):
        created = client.post(
            "/api/newsletter-templates",
            json={"title": "T", "subject": "S", "blocks": [], "status": "ready"},
            headers=_auth("FarmManager"),
        ).json()
        tid = created["NewsletterTemplateId"]

        with patch("routers.newsletter_templates.is_smtp_configured", return_value=True):
            with patch("routers.newsletter_templates.send_email", side_effect=mock_send):
                resp = client.post(f"/api/newsletter-templates/{tid}/send",
                                   json={"recipientGroups": ["customers"]},
                                   headers=_auth("FarmManager"))

    assert resp.status_code == 200
    data = resp.json()
    assert "sentCount" in data
    assert "failedCount" in data


def test_send_template_writes_email_logs():
    with patch("utils.jwt.jwt.decode", return_value=_manager_token()):
        created = client.post(
            "/api/newsletter-templates",
            json={"title": "T", "subject": "Log Test", "blocks": [], "status": "ready"},
            headers=_auth("FarmManager"),
        ).json()
        tid = created["NewsletterTemplateId"]

        with patch("routers.newsletter_templates.is_smtp_configured", return_value=True):
            with patch("routers.newsletter_templates.send_email"):
                with patch("routers.newsletter_templates.SessionLocal", new=TestingSessionLocal):
                    client.post(f"/api/newsletter-templates/{tid}/send",
                                json={"recipientGroups": ["customers"]},
                                headers=_auth("FarmManager"))

        logs_resp = client.get("/api/emails/logs", headers=_auth("FarmManager"))
        assert logs_resp.status_code == 200
        logs = logs_resp.json()
        subjects = [l["Subject"] for l in logs]
        assert "Log Test" in subjects


# ── Block validation ──────────────────────────────────────────────────────────

def test_invalid_image_url_rejected():
    with patch("utils.jwt.jwt.decode", return_value=_manager_token()):
        resp = client.post(
            "/api/newsletter-templates",
            json={
                "title": "T", "subject": "S", "status": "draft",
                "blocks": [{"type": "image", "url": "javascript:alert(1)", "alt": "bad"}],
            },
            headers=_auth("FarmManager"),
        )
    assert resp.status_code == 422


def test_invalid_button_url_rejected():
    with patch("utils.jwt.jwt.decode", return_value=_manager_token()):
        resp = client.post(
            "/api/newsletter-templates",
            json={
                "title": "T", "subject": "S", "status": "draft",
                "blocks": [{"type": "button", "text": "Click", "url": "not-a-url"}],
            },
            headers=_auth("FarmManager"),
        )
    assert resp.status_code == 422


# ── render_html / render_plain_text unit tests ────────────────────────────────

def _make_template(**kwargs) -> NewsletterTemplate:
    defaults = {
        "NewsletterTemplateId": 1,
        "Title": "Test",
        "Subject": "Test Subject",
        "Preheader": None,
        "HeroImageUrl": None,
        "ContentJson": "[]",
        "BodyText": None,
        "CtaText": None,
        "CtaUrl": None,
        "FooterText": None,
        "Status": "draft",
    }
    defaults.update(kwargs)
    t = NewsletterTemplate()
    for k, v in defaults.items():
        setattr(t, k, v)
    return t


def test_render_html_contains_subject():
    t = _make_template(Subject="Summer Sale")
    html = render_html(t)
    assert "Summer Sale" in html


def test_render_html_heading_block():
    blocks = json.dumps([{"type": "heading", "text": "Hello Farm"}])
    t = _make_template(ContentJson=blocks)
    html = render_html(t)
    assert "Hello Farm" in html
    assert "<h2" in html


def test_render_html_button_block():
    blocks = json.dumps([{"type": "button", "text": "Shop Now", "url": "https://farm.com"}])
    t = _make_template(ContentJson=blocks)
    html = render_html(t)
    assert "Shop Now" in html
    assert "https://farm.com" in html


def test_render_html_escapes_xss():
    blocks = json.dumps([{"type": "paragraph", "text": "<script>alert(1)</script>"}])
    t = _make_template(ContentJson=blocks)
    html = render_html(t)
    assert "<script>" not in html
    assert "&lt;script&gt;" in html


def test_render_html_hero_image():
    t = _make_template(HeroImageUrl="https://img.example.com/hero.jpg")
    html = render_html(t)
    assert "https://img.example.com/hero.jpg" in html


def test_render_plain_text_from_blocks():
    blocks = json.dumps([
        {"type": "heading", "text": "Heading"},
        {"type": "paragraph", "text": "Body text here"},
    ])
    t = _make_template(ContentJson=blocks)
    plain = render_plain_text(t)
    assert "Heading" in plain
    assert "Body text here" in plain


def test_render_plain_text_uses_body_text_override():
    t = _make_template(BodyText="Custom plain text override")
    plain = render_plain_text(t)
    assert "Custom plain text override" in plain
