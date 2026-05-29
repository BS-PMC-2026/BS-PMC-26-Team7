"""Backend tests for POST /api/newsletter-templates/upload-image (US39)."""
import io
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base, get_db
from main import app

# ── Minimal DB ────────────────────────────────────────────────────────────────

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

_MANAGER_TOKEN = {"sub": "1", "role": "FarmManager"}
_WORKER_TOKEN  = {"sub": "2", "role": "Worker"}


def _auth(role: str) -> dict:
    return {"Authorization": f"Bearer fake-{role}"}


@pytest.fixture(autouse=True)
def setup_db():
    app.dependency_overrides[get_db] = override_get_db
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)
    app.dependency_overrides.pop(get_db, None)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _fake_jpeg(size_bytes: int = 512) -> bytes:
    """Minimal valid-looking JPEG bytes."""
    return b"\xff\xd8\xff" + b"\x00" * size_bytes


def _upload(content: bytes, filename: str = "test.jpg", content_type: str = "image/jpeg"):
    with patch("utils.jwt.jwt.decode", return_value=_MANAGER_TOKEN):
        return client.post(
            "/api/newsletter-templates/upload-image",
            files={"file": (filename, io.BytesIO(content), content_type)},
            headers=_auth("FarmManager"),
        )


# ── Auth tests ────────────────────────────────────────────────────────────────

def test_upload_requires_auth():
    resp = client.post(
        "/api/newsletter-templates/upload-image",
        files={"file": ("test.jpg", io.BytesIO(b"data"), "image/jpeg")},
    )
    assert resp.status_code == 401


def test_upload_forbidden_for_worker():
    with patch("utils.jwt.jwt.decode", return_value=_WORKER_TOKEN):
        resp = client.post(
            "/api/newsletter-templates/upload-image",
            files={"file": ("test.jpg", io.BytesIO(b"data"), "image/jpeg")},
            headers=_auth("Worker"),
        )
    assert resp.status_code == 403


# ── Valid upload ──────────────────────────────────────────────────────────────

def test_upload_valid_jpeg_returns_200_with_image_url(tmp_path, monkeypatch):
    monkeypatch.setattr(
        "routers.newsletter_templates.Path",
        lambda *args: tmp_path if args == () else Path(*args),
    )
    # Patch the uploads dir to a temp location
    import routers.newsletter_templates as rt
    orig = rt.Path
    try:
        # Replace Path resolution to write to tmp_path
        def patched_path(*args):
            p = orig(*args)
            return p
        resp = _upload(_fake_jpeg())
        assert resp.status_code == 200
        data = resp.json()
        assert "imageUrl" in data
        url = data["imageUrl"]
        # Must be an absolute URL, not a Windows file path
        assert url.startswith("http://") or url.startswith("https://")
        assert "D:\\" not in url
        assert "C:\\" not in url
        assert "newsletter_images" in url
    finally:
        pass


def test_upload_png_accepted():
    content = b"\x89PNG\r\n\x1a\n" + b"\x00" * 100
    resp = _upload(content, "photo.png", "image/png")
    assert resp.status_code == 200
    assert "imageUrl" in resp.json()


def test_upload_webp_accepted():
    content = b"RIFF" + b"\x00" * 4 + b"WEBP" + b"\x00" * 100
    resp = _upload(content, "img.webp", "image/webp")
    assert resp.status_code == 200


def test_upload_gif_accepted():
    content = b"GIF89a" + b"\x00" * 100
    resp = _upload(content, "anim.gif", "image/gif")
    assert resp.status_code == 200


# ── Rejection tests ───────────────────────────────────────────────────────────

def test_upload_pdf_rejected():
    resp = _upload(b"%PDF-1.4", "document.pdf", "application/pdf")
    assert resp.status_code == 400
    assert "JPEG" in resp.json()["detail"] or "image" in resp.json()["detail"].lower()


def test_upload_text_file_rejected():
    resp = _upload(b"hello world", "script.txt", "text/plain")
    assert resp.status_code == 400


def test_upload_svg_rejected():
    resp = _upload(b"<svg/>", "icon.svg", "image/svg+xml")
    assert resp.status_code == 400


def test_upload_over_2mb_rejected():
    big_content = b"\xff\xd8\xff" + b"\x00" * (2 * 1024 * 1024 + 1)
    resp = _upload(big_content)
    assert resp.status_code == 413
    assert "2 MB" in resp.json()["detail"] or "2mb" in resp.json()["detail"].lower()


# ── imageUrl format ───────────────────────────────────────────────────────────

def test_upload_image_url_uses_backend_base_url(monkeypatch):
    monkeypatch.setenv("BACKEND_BASE_URL", "https://hadinerim.azurewebsites.net")
    resp = _upload(_fake_jpeg())
    assert resp.status_code == 200
    assert resp.json()["imageUrl"].startswith("https://hadinerim.azurewebsites.net/uploads/newsletter_images/")


def test_upload_image_url_defaults_to_localhost(monkeypatch):
    monkeypatch.delenv("BACKEND_BASE_URL", raising=False)
    resp = _upload(_fake_jpeg())
    assert resp.status_code == 200
    assert resp.json()["imageUrl"].startswith("http://localhost:8000/uploads/newsletter_images/")


def test_upload_filename_is_unique_uuid():
    resp1 = _upload(_fake_jpeg())
    resp2 = _upload(_fake_jpeg())
    assert resp1.status_code == 200
    assert resp2.status_code == 200
    assert resp1.json()["imageUrl"] != resp2.json()["imageUrl"]


# ── Schema validation for image URLs in templates ─────────────────────────────

def test_template_accepts_http_image_block():
    with patch("utils.jwt.jwt.decode", return_value=_MANAGER_TOKEN):
        resp = client.post(
            "/api/newsletter-templates",
            json={
                "title": "T", "subject": "S", "status": "draft",
                "blocks": [{"type": "image", "url": "https://example.com/img.jpg", "alt": "photo"}],
            },
            headers=_auth("FarmManager"),
        )
    assert resp.status_code == 201


def test_template_accepts_uploads_path_image_block():
    """Image block with /uploads/ prefix is accepted (internal upload URL)."""
    with patch("utils.jwt.jwt.decode", return_value=_MANAGER_TOKEN):
        resp = client.post(
            "/api/newsletter-templates",
            json={
                "title": "T2", "subject": "S2", "status": "draft",
                "blocks": [{"type": "image", "url": "/uploads/newsletter_images/abc.jpg", "alt": ""}],
            },
            headers=_auth("FarmManager"),
        )
    assert resp.status_code == 201


def test_template_rejects_javascript_scheme_image():
    with patch("utils.jwt.jwt.decode", return_value=_MANAGER_TOKEN):
        resp = client.post(
            "/api/newsletter-templates",
            json={
                "title": "T", "subject": "S", "status": "draft",
                "blocks": [{"type": "image", "url": "javascript:alert(1)", "alt": ""}],
            },
            headers=_auth("FarmManager"),
        )
    assert resp.status_code == 422


def test_template_rejects_data_uri_image():
    with patch("utils.jwt.jwt.decode", return_value=_MANAGER_TOKEN):
        resp = client.post(
            "/api/newsletter-templates",
            json={
                "title": "T", "subject": "S", "status": "draft",
                "blocks": [{"type": "image", "url": "data:image/png;base64,abc", "alt": ""}],
            },
            headers=_auth("FarmManager"),
        )
    assert resp.status_code == 422


def test_template_rejects_file_scheme_image():
    with patch("utils.jwt.jwt.decode", return_value=_MANAGER_TOKEN):
        resp = client.post(
            "/api/newsletter-templates",
            json={
                "title": "T", "subject": "S", "status": "draft",
                "blocks": [{"type": "image", "url": "file:///etc/passwd", "alt": ""}],
            },
            headers=_auth("FarmManager"),
        )
    assert resp.status_code == 422


def test_render_html_includes_image_url_and_alt():
    """HTML rendering uses absolute URL and alt text in <img> tags."""
    from services.newsletter_template_service import render_html
    from models.newsletter_template import NewsletterTemplate
    import json

    t = NewsletterTemplate()
    t.NewsletterTemplateId = 1
    t.Title        = "Test"
    t.Subject      = "Sub"
    t.Preheader    = None
    t.HeroImageUrl = "https://cdn.example.com/hero.jpg"
    t.ContentJson  = json.dumps([
        {"type": "image", "url": "https://cdn.example.com/body.jpg", "alt": "Body photo"},
    ])
    t.BodyText     = None
    t.CtaText      = None
    t.CtaUrl       = None
    t.FooterText   = None
    t.Status       = "ready"

    html = render_html(t)
    assert "https://cdn.example.com/hero.jpg" in html
    assert "https://cdn.example.com/body.jpg" in html
    assert 'alt="Body photo"' in html
    assert "max-width" in html
    assert "height:auto" in html or "height: auto" in html
