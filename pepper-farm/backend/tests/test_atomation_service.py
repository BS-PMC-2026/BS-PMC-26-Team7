import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from datetime import datetime
from unittest.mock import MagicMock, patch

import pytest

# Set required env vars BEFORE importing the service
os.environ.setdefault("ATOMATION_EMAIL", "test@example.com")
os.environ.setdefault("ATOMATION_PASSWORD", "test-password")

from services.atomation_service import AtomationService, AtomationApiError


# ------------------------------------------------------------------ #
# 1. _normalize_token
# ------------------------------------------------------------------ #
def test_normalize_token_strips_bearer_prefix():
    assert AtomationService._normalize_token("Bearer abc123") == "abc123"
    assert AtomationService._normalize_token("bearer abc123") == "abc123"


def test_normalize_token_strips_whitespace():
    assert AtomationService._normalize_token("  abc123  ") == "abc123"


def test_normalize_token_keeps_plain_token():
    assert AtomationService._normalize_token("abc123") == "abc123"


# ------------------------------------------------------------------ #
# 2. _format_datetime
# ------------------------------------------------------------------ #
def test_format_datetime_uses_atomation_format():
    dt = datetime(2026, 4, 27, 9, 13, 17)
    formatted = AtomationService._format_datetime(dt)
    assert formatted == "2026-04-27T09:13:17.000Z"


# ------------------------------------------------------------------ #
# 3. _extract_token_from_response
# ------------------------------------------------------------------ #
def test_extract_token_from_top_level():
    body = {"token": "my-token-123"}
    assert AtomationService._extract_token_from_response(body) == "my-token-123"


def test_extract_token_from_access_token_key():
    body = {"data": {"access_token": "my-token-456"}}
    assert AtomationService._extract_token_from_response(body) == "my-token-456"


def test_extract_token_from_nested_dict():
    body = {"result": {"data": {"jwt": "deeply-nested-token"}}}
    assert AtomationService._extract_token_from_response(body) == "deeply-nested-token"


def test_extract_token_returns_none_when_missing():
    body = {"status": "ok", "code": 200}
    assert AtomationService._extract_token_from_response(body) is None


# ------------------------------------------------------------------ #
# 4. Constructor and credentials check
# ------------------------------------------------------------------ #
def test_constructor_raises_when_credentials_missing(monkeypatch):
    # Reset cached token first
    AtomationService._cached_token = None
    monkeypatch.delenv("ATOMATION_EMAIL", raising=False)
    monkeypatch.delenv("ATOMATION_PASSWORD", raising=False)

    with pytest.raises(AtomationApiError, match="missing"):
        AtomationService()


def test_constructor_uses_cached_token():
    AtomationService._cached_token = "cached-token-xyz"
    service = AtomationService()
    assert service.token == "cached-token-xyz"
    AtomationService._cached_token = None  # cleanup


# ------------------------------------------------------------------ #
# 5. _login
# ------------------------------------------------------------------ #
@patch("services.atomation_service.httpx.Client")
def test_login_success_extracts_token(MockClient):
    AtomationService._cached_token = None

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"code": 200, "token": "new-token-abc"}

    mock_client_instance = MagicMock()
    mock_client_instance.post.return_value = mock_response
    MockClient.return_value.__enter__.return_value = mock_client_instance

    service = AtomationService()
    service._login()

    assert service.token == "new-token-abc"
    assert AtomationService._cached_token == "new-token-abc"
    AtomationService._cached_token = None  # cleanup


@patch("services.atomation_service.httpx.Client")
def test_login_raises_on_http_error(MockClient):
    AtomationService._cached_token = None

    mock_response = MagicMock()
    mock_response.status_code = 401
    mock_response.json.return_value = {"error": "Invalid credentials"}

    mock_client_instance = MagicMock()
    mock_client_instance.post.return_value = mock_response
    MockClient.return_value.__enter__.return_value = mock_client_instance

    service = AtomationService()
    with pytest.raises(AtomationApiError, match="HTTP 401"):
        service._login()


@patch("services.atomation_service.httpx.Client")
def test_login_raises_when_no_token_in_response(MockClient):
    AtomationService._cached_token = None

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"code": 200, "status": "ok"}  # no token

    mock_client_instance = MagicMock()
    mock_client_instance.post.return_value = mock_response
    MockClient.return_value.__enter__.return_value = mock_client_instance

    service = AtomationService()
    with pytest.raises(AtomationApiError, match="token was not found"):
        service._login()


# ------------------------------------------------------------------ #
# 6. _post_with_auto_login (the JWT retry logic)
# ------------------------------------------------------------------ #
@patch("services.atomation_service.httpx.Client")
def test_post_with_auto_login_retries_on_jwt_expired(MockClient):
    """Critical: when JWT expires, service should auto-relogin and retry."""
    AtomationService._cached_token = "expired-token"

    mock_response_expired = MagicMock()
    mock_response_expired.status_code = 401
    mock_response_expired.json.return_value = {"code": 401, "message": "jwt expired"}

    mock_response_login = MagicMock()
    mock_response_login.status_code = 200
    mock_response_login.json.return_value = {"code": 200, "token": "fresh-token"}

    mock_response_success = MagicMock()
    mock_response_success.status_code = 200
    mock_response_success.json.return_value = {"code": 200, "data": {"readings_data": []}}

    mock_client_instance = MagicMock()
    mock_client_instance.post.side_effect = [
        mock_response_expired,  # 1st: expired
        mock_response_login,    # 2nd: re-login
        mock_response_success,  # 3rd: retry success
    ]
    MockClient.return_value.__enter__.return_value = mock_client_instance

    service = AtomationService()
    result = service._post_with_auto_login("https://test/url", {"foo": "bar"})

    assert result["code"] == 200
    assert mock_client_instance.post.call_count == 3
    AtomationService._cached_token = None  # cleanup
