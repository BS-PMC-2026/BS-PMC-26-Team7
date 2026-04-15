import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch
from main import app
from database import get_db

client = TestClient(app)


def make_mock_user(is_active=True):
    visitor_role = MagicMock()
    visitor_role.RoleId   = 4
    visitor_role.RoleName = "Visitor"

    mock_user = MagicMock()
    mock_user.UserId       = 1
    mock_user.FullName     = "Test User"
    mock_user.Email        = "test@farm.com"
    mock_user.PasswordHash = "hashed"
    mock_user.IsActive     = is_active
    mock_user.role         = visitor_role
    return mock_user


def test_login_success_returns_token():
    mock = MagicMock()
    mock.query.return_value.filter.return_value.first.return_value = make_mock_user()

    with patch("services.auth_service.verify_password", return_value=True):
        app.dependency_overrides[get_db] = lambda: mock
        res = client.post("/api/auth/login", json={
            "email":    "test@farm.com",
            "password": "pass123"
        })
        app.dependency_overrides.clear()

    assert res.status_code == 200
    data = res.json()
    assert "accessToken" in data
    assert data["tokenType"] == "bearer"


def test_login_returns_correct_role():
    mock = MagicMock()
    mock.query.return_value.filter.return_value.first.return_value = make_mock_user()

    with patch("services.auth_service.verify_password", return_value=True):
        app.dependency_overrides[get_db] = lambda: mock
        res = client.post("/api/auth/login", json={
            "email":    "test@farm.com",
            "password": "pass123"
        })
        app.dependency_overrides.clear()

    assert res.json()["role"] == "Visitor"


def test_login_returns_full_name():
    mock = MagicMock()
    mock.query.return_value.filter.return_value.first.return_value = make_mock_user()

    with patch("services.auth_service.verify_password", return_value=True):
        app.dependency_overrides[get_db] = lambda: mock
        res = client.post("/api/auth/login", json={
            "email":    "test@farm.com",
            "password": "pass123"
        })
        app.dependency_overrides.clear()

    assert res.json()["fullName"] == "Test User"


def test_login_wrong_password_returns_401():
    mock = MagicMock()
    mock.query.return_value.filter.return_value.first.return_value = make_mock_user()

    with patch("services.auth_service.verify_password", return_value=False):
        app.dependency_overrides[get_db] = lambda: mock
        res = client.post("/api/auth/login", json={
            "email":    "test@farm.com",
            "password": "wrongpass"
        })
        app.dependency_overrides.clear()

    assert res.status_code == 401
    assert "Invalid" in res.json()["detail"]


def test_login_user_not_found_returns_401():
    mock = MagicMock()
    mock.query.return_value.filter.return_value.first.return_value = None

    app.dependency_overrides[get_db] = lambda: mock
    res = client.post("/api/auth/login", json={
        "email":    "ghost@farm.com",
        "password": "pass123"
    })
    app.dependency_overrides.clear()

    assert res.status_code == 401


def test_login_inactive_user_returns_403():
    mock = MagicMock()
    mock.query.return_value.filter.return_value.first.return_value = make_mock_user(is_active=False)

    with patch("services.auth_service.verify_password", return_value=True):
        app.dependency_overrides[get_db] = lambda: mock
        res = client.post("/api/auth/login", json={
            "email":    "test@farm.com",
            "password": "pass123"
        })
        app.dependency_overrides.clear()

    assert res.status_code == 401
    assert "disabled" in res.json()["detail"]


def test_login_missing_password_returns_422():
    res = client.post("/api/auth/login", json={"email": "test@farm.com"})
    assert res.status_code == 422


def test_login_missing_email_returns_422():
    res = client.post("/api/auth/login", json={"password": "pass123"})
    assert res.status_code == 422


def test_login_invalid_email_format_returns_422():
    res = client.post("/api/auth/login", json={
        "email":    "not-an-email",
        "password": "pass123"
    })
    assert res.status_code == 422