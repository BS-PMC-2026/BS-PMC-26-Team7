import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from unittest.mock import MagicMock, patch

from services.user_service import (
    promote_user,
    get_user_by_id,
    search_users_by_name,
)

# ======================================================================
# Fixture: mock DB session
# ======================================================================

def _mock_user(user_id=1, full_name="Test User", email="test@example.com", role_id=1, is_active=True):
    user = MagicMock()
    user.UserId = user_id
    user.FullName = full_name
    user.Email = email
    user.RoleId = role_id
    user.IsActive = is_active
    return user


def _mock_role(role_id=2, role_name="Employee"):
    role = MagicMock()
    role.RoleId = role_id
    role.RoleName = role_name
    return role


# ======================================================================
# 1. Not Found Tests
# ======================================================================

class TestPromoteUserNotFound:
    def test_promote_user_returns_error_when_user_not_found(self):
        """User does not exist -> returns (None, 'User not found.')."""
        mock_db = MagicMock()

        with patch("services.user_service.get_user_by_id", return_value=None):
            user, error = promote_user(mock_db, user_id=999, role_id=2)

        assert user is None
        assert error == "User not found."
        mock_db.commit.assert_not_called()
        mock_db.refresh.assert_not_called()

    def test_promote_user_returns_error_when_role_not_found(self):
        """Role does not exist -> returns (None, 'Role not found.')."""
        mock_db = MagicMock()
        fake_user = _mock_user()

        mock_db.query.return_value.filter.return_value.first.return_value = None

        with patch("services.user_service.get_user_by_id", return_value=fake_user):
            user, error = promote_user(mock_db, user_id=1, role_id=999)

        assert user is None
        assert error == "Role not found."
        mock_db.commit.assert_not_called()
        mock_db.refresh.assert_not_called()


# ======================================================================
# 2. Success Tests
# ======================================================================

class TestPromoteUserSuccess:
    def test_promote_user_updates_role_id_successfully(self):
        """Valid user + valid role -> updates RoleId and returns updated user."""
        mock_db = MagicMock()
        fake_user = _mock_user(role_id=1)
        fake_role = _mock_role(role_id=2, role_name="Employee")

        mock_db.query.return_value.filter.return_value.first.return_value = fake_role

        with patch("services.user_service.get_user_by_id", return_value=fake_user):
            user, error = promote_user(mock_db, user_id=1, role_id=2)

        assert error is None
        assert user is fake_user
        assert fake_user.RoleId == 2

    def test_promote_user_commits_and_refreshes(self):
        """Successful promotion -> db.commit() and db.refresh(user) are called."""
        mock_db = MagicMock()
        fake_user = _mock_user(role_id=1)
        fake_role = _mock_role(role_id=3, role_name="FarmWorker")

        mock_db.query.return_value.filter.return_value.first.return_value = fake_role

        with patch("services.user_service.get_user_by_id", return_value=fake_user):
            user, error = promote_user(mock_db, user_id=1, role_id=3)

        assert error is None
        mock_db.commit.assert_called_once()
        mock_db.refresh.assert_called_once_with(fake_user)

    def test_promote_user_returns_updated_user(self):
        """Successful promotion -> function returns the same updated user object."""
        mock_db = MagicMock()
        fake_user = _mock_user(role_id=1)
        fake_role = _mock_role(role_id=2)

        mock_db.query.return_value.filter.return_value.first.return_value = fake_role

        with patch("services.user_service.get_user_by_id", return_value=fake_user):
            result, error = promote_user(mock_db, user_id=1, role_id=2)

        assert error is None
        assert result is fake_user


# ======================================================================
# 3. Edge Cases
# ======================================================================

class TestPromoteUserEdgeCases:
    def test_promote_user_allows_same_role_update(self):
        """If the new role is the same as current role, function still commits successfully."""
        mock_db = MagicMock()
        fake_user = _mock_user(role_id=2)
        fake_role = _mock_role(role_id=2, role_name="Employee")

        mock_db.query.return_value.filter.return_value.first.return_value = fake_role

        with patch("services.user_service.get_user_by_id", return_value=fake_user):
            user, error = promote_user(mock_db, user_id=1, role_id=2)

        assert error is None
        assert user.RoleId == 2
        mock_db.commit.assert_called_once()
        mock_db.refresh.assert_called_once_with(fake_user)

        # ======================================================================
# 4. get_user_by_id Tests
# ======================================================================

class TestGetUserById:
    def test_get_user_by_id_returns_user_when_exists(self):
        """Existing user id -> returns the matching user."""
        mock_db = MagicMock()
        fake_user = _mock_user(user_id=1, full_name="Sahar Ben")

        mock_db.query.return_value.filter.return_value.first.return_value = fake_user

        result = get_user_by_id(mock_db, 1)

        assert result is fake_user

    def test_get_user_by_id_returns_none_when_user_not_exists(self):
        """Missing user id -> returns None."""
        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = None

        result = get_user_by_id(mock_db, 999)

        assert result is None


# ======================================================================
# 5. search_users_by_name Tests
# ======================================================================

class TestSearchUsersByName:
    def test_search_users_by_name_returns_matching_users(self):
        """Matching name -> returns matching users ordered by name."""
        mock_db = MagicMock()
        fake_users = [
            _mock_user(user_id=1, full_name="Sahar Ben"),
            _mock_user(user_id=2, full_name="Sahar Cohen"),
        ]

        mock_db.query.return_value.filter.return_value.order_by.return_value.all.return_value = fake_users

        result = search_users_by_name(mock_db, "Sahar")

        assert result == fake_users

    def test_search_users_by_name_returns_empty_list_when_no_matches(self):
        """No matching name -> returns empty list."""
        mock_db = MagicMock()

        mock_db.query.return_value.filter.return_value.order_by.return_value.all.return_value = []

        result = search_users_by_name(mock_db, "NoSuchName")

        assert result == []