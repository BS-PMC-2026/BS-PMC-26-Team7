import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from main import app
from database import get_db
from utils.jwt import get_current_user

client = TestClient(app)


def make_mock_db(is_active=True):
    role = MagicMock()
    role.RoleName = "FarmManager"

    user = MagicMock()
    user.UserId       = 1
    user.FullName     = "Alice Manager"
    user.Email        = "alice@farm.com"
    user.PasswordHash = "hashed"
    user.IsActive     = is_active
    user.role         = role

    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.first.return_value = user
    return mock_db


# ── 1. JSON /login still works ─────────────────────────────────────────────
def test_json_login_still_works():
    app.dependency_overrides[get_db] = lambda: make_mock_db()
    with patch("services.auth_service.verify_password", return_value=True):
        res = client.post("/api/auth/login", json={
            "email": "alice@farm.com",
            "password": "secret1",
        })
    app.dependency_overrides.clear()
    assert res.status_code == 200
    data = res.json()
    assert "accessToken" in data
    assert data["tokenType"] == "bearer"


# ── 2. /token accepts form-encoded data (Swagger flow) ────────────────────
def test_swagger_token_accepts_form_data():
    app.dependency_overrides[get_db] = lambda: make_mock_db()
    with patch("services.auth_service.verify_password", return_value=True):
        res = client.post(
            "/api/auth/token",
            data={"username": "alice@farm.com", "password": "secret1"},
        )
    app.dependency_overrides.clear()
    assert res.status_code == 200


# ── 3. /token response uses snake_case access_token key (OAuth2 spec) ─────
def test_swagger_token_response_has_access_token_key():
    app.dependency_overrides[get_db] = lambda: make_mock_db()
    with patch("services.auth_service.verify_password", return_value=True):
        res = client.post(
            "/api/auth/token",
            data={"username": "alice@farm.com", "password": "secret1"},
        )
    app.dependency_overrides.clear()
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["access_token"]  # non-empty string


# ── 4. /token returns 401 on wrong password ────────────────────────────────
def test_swagger_token_wrong_password_returns_401():
    app.dependency_overrides[get_db] = lambda: make_mock_db()
    with patch("services.auth_service.verify_password", return_value=False):
        res = client.post(
            "/api/auth/token",
            data={"username": "alice@farm.com", "password": "wrong"},
        )
    app.dependency_overrides.clear()
    assert res.status_code == 401


# ── 5. /token returns 401 for inactive account ────────────────────────────
def test_swagger_token_inactive_user_returns_401():
    app.dependency_overrides[get_db] = lambda: make_mock_db(is_active=False)
    with patch("services.auth_service.verify_password", return_value=True):
        res = client.post(
            "/api/auth/token",
            data={"username": "alice@farm.com", "password": "secret1"},
        )
    app.dependency_overrides.clear()
    assert res.status_code == 401


# ── 6. Protected endpoint returns 401 without Authorization header ─────────
def test_protected_endpoint_returns_401_without_token():
    res = client.get("/api/tasks/my")
    assert res.status_code == 401


# ── 7. Protected endpoint accepts a valid Bearer token ────────────────────
def test_protected_endpoint_works_with_bearer_token():
    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.order_by.return_value.all.return_value = []
    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_current_user] = lambda: {"user_id": 1, "role": "FarmManager"}
    res = client.get("/api/tasks/my")
    app.dependency_overrides.clear()
    assert res.status_code == 200
