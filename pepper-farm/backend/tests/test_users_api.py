import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from main import app
from database import get_db


# ======================================================================
# Shared helpers
# ======================================================================

def _mock_user(
    user_id: int = 1,
    full_name: str = "Test User",
    email: str = "test@example.com",
    role_name: str = "Visitor",
    is_active: bool = True,
) -> SimpleNamespace:
    """
    Return a plain namespace that satisfies WorkerResponse
    (from_attributes=True).
    """
    return SimpleNamespace(
        UserId=user_id,
        FullName=full_name,
        Email=email,
        IsActive=is_active,
        role=SimpleNamespace(RoleName=role_name),
    )


def _override_manager_dependency():
    """
    Fake authenticated FarmManager user.
    """
    return {"role": "FarmManager", "fullName": "Manager"}


def _install_users_auth_override():
    """
    Override the require_role("FarmManager") dependency
    used by /api/users and /api/users/search and /api/users/{id}/role.
    """
    for route in app.routes:
        if getattr(route, "path", "") in ["/api/users", "/api/users/search", "/api/users/{user_id}/role"]:
            for dep in route.dependant.dependencies:
                app.dependency_overrides[dep.call] = _override_manager_dependency


# ======================================================================
# Fixture: TestClient with mocked DB + auth override
# ======================================================================

@pytest.fixture()
def client():
    mock_db = MagicMock()

    def override_get_db():
        yield mock_db

    app.dependency_overrides[get_db] = override_get_db
    _install_users_auth_override()

    with TestClient(app) as c:
        yield c, mock_db

    app.dependency_overrides.clear()


# ======================================================================
# 1. Positive Tests — HTTP layer
# ======================================================================

class TestUsersApiSuccess:
    def test_list_all_users_returns_200_and_users(self, client):
        """GET /api/users -> 200 + list of users."""
        test_client, _ = client

        fake_users = [
            _mock_user(user_id=1, full_name="Sahar Ben", email="sahar@example.com", role_name="Visitor"),
            _mock_user(user_id=2, full_name="Noa Levi", email="noa@example.com", role_name="Worker"),
        ]

        with patch("routers.users.get_all_users", return_value=fake_users):
            response = test_client.get("/api/users")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        assert data[0]["fullName"] == "Sahar Ben"
        assert data[0]["roleName"] == "Visitor"
        assert data[1]["fullName"] == "Noa Levi"
        assert data[1]["roleName"] == "Worker"

    def test_search_users_returns_200_and_matching_users(self, client):
        """GET /api/users/search?name=Sahar -> 200 + matching users."""
        test_client, _ = client

        fake_users = [
            _mock_user(user_id=1, full_name="Sahar Ben", email="sahar@example.com", role_name="Visitor"),
        ]

        with patch("routers.users.search_users_by_name", return_value=fake_users):
            response = test_client.get("/api/users/search?name=Sahar")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["fullName"] == "Sahar Ben"
        assert data[0]["email"] == "sahar@example.com"

    def test_update_user_role_success_returns_200(self, client):
        """PUT /api/users/{id}/role with valid roleId -> 200 + updated user."""
        test_client, _ = client

        updated_user = _mock_user(
            user_id=1,
            full_name="Sahar Ben",
            email="sahar@example.com",
            role_name="Worker",
            is_active=True,
        )

        with patch("routers.users.promote_user", return_value=(updated_user, None)):
            response = test_client.put("/api/users/1/role", json={"roleId": 3})

        assert response.status_code == 200
        data = response.json()
        assert data["userId"] == 1
        assert data["fullName"] == "Sahar Ben"
        assert data["roleName"] == "Worker"
        assert data["isActive"] is True


# ======================================================================
# 2. Not Found Tests — HTTP layer
# ======================================================================

class TestUsersApiNotFound:
    def test_update_user_role_user_not_found_returns_404(self, client):
        """Missing user -> 404 with correct detail."""
        test_client, _ = client

        with patch("routers.users.promote_user", return_value=(None, "User not found.")):
            response = test_client.put("/api/users/999/role", json={"roleId": 3})

        assert response.status_code == 404
        assert response.json()["detail"] == "User not found."

    def test_update_user_role_role_not_found_returns_404(self, client):
        """Missing role -> 404 with correct detail."""
        test_client, _ = client

        with patch("routers.users.promote_user", return_value=(None, "Role not found.")):
            response = test_client.put("/api/users/1/role", json={"roleId": 999})

        assert response.status_code == 404
        assert response.json()["detail"] == "Role not found."


# ======================================================================
# 3. Validation Error Tests — HTTP layer
# ======================================================================

class TestUsersApiValidationErrors:
    def test_update_user_role_missing_role_id_returns_422(self, client):
        """Missing roleId in body -> 422."""
        test_client, _ = client

        response = test_client.put("/api/users/1/role", json={})

        assert response.status_code == 422

    def test_search_users_missing_name_returns_422(self, client):
        """Missing required query param 'name' -> 422."""
        test_client, _ = client

        response = test_client.get("/api/users/search")

        assert response.status_code == 422


# ======================================================================
# 4. Edge Cases — HTTP layer
# ======================================================================

class TestUsersApiEdgeCases:
    def test_list_all_users_returns_empty_list(self, client):
        """GET /api/users with no users -> 200 + empty list."""
        test_client, _ = client

        with patch("routers.users.get_all_users", return_value=[]):
            response = test_client.get("/api/users")

        assert response.status_code == 200
        assert response.json() == []

    def test_search_users_returns_empty_list_when_no_match(self, client):
        """Search with no matches -> 200 + empty list."""
        test_client, _ = client

        with patch("routers.users.search_users_by_name", return_value=[]):
            response = test_client.get("/api/users/search?name=NoSuchUser")

        assert response.status_code == 200
        assert response.json() == []