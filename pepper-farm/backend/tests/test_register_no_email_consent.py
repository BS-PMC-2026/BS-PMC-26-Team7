"""
Regression tests for POST /api/auth/register — verifies that:
  - EmailConsent is NOT referenced in INSERT or RETURNING.
  - Valid registration returns 201 with the user details.
  - Duplicate email returns 409.
  - Invalid input (bad password) returns 422 with readable detail.
  - These tests run against a real SQLite DB that does NOT have an
    EmailConsent column, simulating SQL Server before the migration runs.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base, get_db
from main import app
from models.role import Role


# ── SQLite test DB WITHOUT EmailConsent column ────────────────────────────────

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


def _seed(db):
    visitor_role = Role(RoleName="Visitor")
    db.add(visitor_role)
    db.commit()
    # Intentionally do NOT add EmailConsent column —
    # simulates SQL Server state before migration.


@pytest.fixture(autouse=True)
def setup_db():
    app.dependency_overrides[get_db] = override_get_db
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    _seed(db)
    db.close()
    yield
    Base.metadata.drop_all(bind=engine)
    app.dependency_overrides.pop(get_db, None)


# ── Register ──────────────────────────────────────────────────────────────────

def test_register_valid_user_returns_201():
    """Valid registration must succeed even without EmailConsent column in DB."""
    resp = client.post("/api/auth/register", json={
        "fullName": "Alice Farm",
        "email":    "alice@pepper.com",
        "password": "Secure1",
    })
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["fullName"] == "Alice Farm"
    assert data["email"]    == "alice@pepper.com"
    assert data["role"]     == "Visitor"
    assert "userId" in data


def test_register_inserts_without_email_consent_column():
    """INSERT must not reference EmailConsent — no 500 from missing column."""
    sqls: list[str] = []

    @event.listens_for(engine, "before_cursor_execute")
    def capture(conn, cursor, stmt, params, ctx, many):
        sqls.append(stmt)

    resp = client.post("/api/auth/register", json={
        "fullName": "Bob Farm",
        "email":    "bob@pepper.com",
        "password": "Password1",
    })
    assert resp.status_code == 201, resp.text

    email_consent_sqls = [s for s in sqls if "EmailConsent" in s or "emailconsent" in s.lower()]
    assert email_consent_sqls == [], (
        f"EmailConsent was referenced in a SQL statement: {email_consent_sqls}"
    )

    # Clean up listener
    from sqlalchemy import event as sa_event
    sa_event.remove(engine, "before_cursor_execute", capture)


def test_register_duplicate_email_returns_409():
    client.post("/api/auth/register", json={
        "fullName": "Alice Farm",
        "email":    "dup@pepper.com",
        "password": "Secure1",
    })
    resp = client.post("/api/auth/register", json={
        "fullName": "Alice Farm",
        "email":    "dup@pepper.com",
        "password": "Secure1",
    })
    assert resp.status_code == 409
    assert "already registered" in resp.json()["detail"].lower()


def test_register_invalid_password_only_letters_returns_422():
    """Password with only letters (no digit) must return 422, never 500."""
    resp = client.post("/api/auth/register", json={
        "fullName": "Carol Farm",
        "email":    "carol@pepper.com",
        "password": "abcdefgh",       # no digit → fails Pydantic validator
    })
    assert resp.status_code == 422
    detail = resp.json()["detail"]
    assert isinstance(detail, list), "detail should be a Pydantic validation array"
    msgs = [item.get("msg", "") for item in detail]
    assert any("digit" in m.lower() or "letter" in m.lower() or "character" in m.lower() for m in msgs)


def test_register_invalid_password_only_digits_returns_422():
    """Password with only digits (no letter) must return 422, never 500."""
    resp = client.post("/api/auth/register", json={
        "fullName": "Dave Farm",
        "email":    "dave@pepper.com",
        "password": "12345678",       # no letter → fails Pydantic validator
    })
    assert resp.status_code == 422


def test_register_short_password_returns_422():
    resp = client.post("/api/auth/register", json={
        "fullName": "Eve Farm",
        "email":    "eve@pepper.com",
        "password": "Ab1",            # < 6 chars
    })
    assert resp.status_code == 422


def test_register_missing_fields_returns_422():
    resp = client.post("/api/auth/register", json={"fullName": "No Email"})
    assert resp.status_code == 422


def test_register_response_never_500_for_validation_errors():
    """Any invalid input must return 4xx, never 500."""
    bad_payloads = [
        {"fullName": "", "email": "a@b.com", "password": "Valid1"},  # empty name
        {"fullName": "X", "email": "a@b.com", "password": "Valid1"}, # name too short
        {"fullName": "Alice", "email": "not-email", "password": "Valid1"},  # bad email
        {"fullName": "Alice", "email": "a@b.com", "password": "nod1git"},   # Actually valid? check
    ]
    for payload in bad_payloads:
        resp = client.post("/api/auth/register", json=payload)
        assert resp.status_code != 500, f"Got 500 for payload: {payload}, body: {resp.text}"
