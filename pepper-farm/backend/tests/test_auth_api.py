import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch
from main import app
from database import get_db

client = TestClient(app)

def make_mock_db(user_exists=False):
    mock = MagicMock()

    visitor_role = MagicMock()
    visitor_role.RoleId   = 4
    visitor_role.RoleName = "Visitor"

    mock_user = MagicMock()
    mock_user.UserId       = 1
    mock_user.FullName     = "Test User"
    mock_user.Email        = "test@farm.com"
    mock_user.PasswordHash = "hashed"
    mock_user.IsActive     = True
    mock_user.role         = visitor_role

    if user_exists:
        mock.query.return_value.filter.return_value.first.return_value = mock_user
    else:
        mock.query.return_value.filter.return_value.first.side_effect = [
            None,
            visitor_role,
        ]
        def fake_refresh(obj):
            obj.UserId   = 1
            obj.FullName = "Test User"
            obj.Email    = "test@farm.com"
            obj.role     = visitor_role
        mock.refresh.side_effect = fake_refresh

    return mock

def test_register_returns_201():
    app.dependency_overrides[get_db] = lambda: make_mock_db()
    res = client.post("/api/auth/register", json={
        "fullName": "Test User",
        "email":    "test@farm.com",
        "password": "pass123"
    })
    app.dependency_overrides.clear()
    assert res.status_code == 201


def test_register_duplicate_email_returns_409():
    app.dependency_overrides[get_db] = lambda: make_mock_db(user_exists=True)
    res = client.post("/api/auth/register", json={
        "fullName": "Test User",
        "email":    "test@farm.com",
        "password": "pass123"
    })
    app.dependency_overrides.clear()
    assert res.status_code == 409
    assert "already registered" in res.json()["detail"]


def test_register_short_password_returns_422():
    res = client.post("/api/auth/register", json={
        "fullName": "Test User",
        "email":    "test@farm.com",
        "password": "12"
    })
    assert res.status_code == 422


def test_register_invalid_email_returns_422():
    res = client.post("/api/auth/register", json={
        "fullName": "Test User",
        "email":    "not-an-email",
        "password": "pass123"
    })
    assert res.status_code == 422


def test_register_missing_name_returns_422():
    res = client.post("/api/auth/register", json={
        "email":    "test@farm.com",
        "password": "pass123"
    })
    assert res.status_code == 422


def test_register_response_contains_role():
    app.dependency_overrides[get_db] = lambda: make_mock_db()
    res = client.post("/api/auth/register", json={
        "fullName": "Test User",
        "email":    "test@farm.com",
        "password": "pass123"
    })
    app.dependency_overrides.clear()
    assert res.status_code == 201
    assert res.json()["role"] == "Visitor"


def test_login_wrong_password_returns_401():
    mock = MagicMock()
    mock_user = MagicMock()
    mock_user.PasswordHash = "hashed"
    mock_user.IsActive     = True
    mock.query.return_value.filter.return_value.first.return_value = mock_user

    with patch("services.auth_service.verify_password", return_value=False):
        app.dependency_overrides[get_db] = lambda: mock
        res = client.post("/api/auth/login", json={
            "email":    "test@farm.com",
            "password": "wrongpass"
        })
        app.dependency_overrides.clear()

    assert res.status_code == 401


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


def test_login_missing_email_returns_422():
    res = client.post("/api/auth/login", json={
        "password": "pass123"
    })
    assert res.status_code == 422