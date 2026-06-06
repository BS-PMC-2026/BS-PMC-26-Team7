"""
BSPMT7-465 — Role-based authorization regression tests.

These tests verify that endpoints newly protected as part of BSPMT7-465 reject
unauthorized roles (and anonymous callers), while endpoints intentionally left
public / unchanged are NOT blocked by a role guard.

Strategy
--------
`require_role(...)` depends internally on `get_current_user`. So:

* Override `get_current_user` -> a role dict   => the role check runs and
  raises 403 for the wrong role, or passes for the allowed role.
* Leave `get_current_user` un-overridden        => the real OAuth2 scheme runs
  and, with no Authorization header, returns 401.

`get_db` is mocked so no real database is needed. The client is created with
`raise_server_exceptions=False` so that an endpoint body that errors on the
MagicMock DB returns a 5xx *response* instead of raising — the role guard runs
before the body, so authorization behaviour is still observable.

For the *allowed* role we assert only that the response is NOT 401/403 (the
authorization layer let the request through). Asserting an exact 2xx would
require deep-mocking each service and is out of scope for an authz test.
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from main import app
from database import get_db
from utils.jwt import get_current_user


# Do not raise on unhandled server errors — let them surface as 5xx responses
# so we can distinguish them from the 401/403 produced by the auth layer.
client = TestClient(app, raise_server_exceptions=False)


# ---------------------------------------------------------------------------
# Fixtures / helpers
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def _mock_db_and_clear():
    """Mock the DB dependency for every test and clear overrides afterwards."""
    mock_db = MagicMock()

    def _override_get_db():
        yield mock_db

    app.dependency_overrides[get_db] = _override_get_db
    yield
    app.dependency_overrides.clear()


def _set_role(role: str) -> None:
    app.dependency_overrides[get_current_user] = lambda: {"user_id": 1, "role": role}


def _clear_role() -> None:
    """Remove the auth override so the real OAuth2 scheme runs (=> 401)."""
    app.dependency_overrides.pop(get_current_user, None)


def _request(method: str, url: str, body):
    fn = getattr(client, method.lower())
    if method in ("POST", "PUT", "PATCH"):
        return fn(url, json=(body if body is not None else {}))
    return fn(url)


# ---------------------------------------------------------------------------
# Protected endpoints  (method, url, allowed-roles, optional body)
# ---------------------------------------------------------------------------

# FarmManager-only
_FM = {"FarmManager"}
# FarmManager + Worker
_FM_W = {"FarmManager", "Worker"}

PROTECTED_CASES = [
    # tasks
    ("GET", "/api/tasks", _FM, None),
    # inventory
    ("GET", "/api/inventory/by-variety", _FM_W, None),
    # users
    ("GET", "/api/users/workers", _FM, None),
    # plants (write) — Worker is allowed (legitimate add-plant flow)
    ("POST", "/api/plants", _FM_W, {}),
    ("PUT", "/api/plants/1/status", _FM_W, {"Status": "Healthy"}),
    # peppers (writes)
    ("POST", "/api/peppers", _FM, {}),
    ("POST", "/api/peppers/upload-image", _FM, None),
    ("PUT", "/api/peppers/1", _FM, {}),
    ("DELETE", "/api/peppers/1", _FM, None),
    # anomalies (manager dashboard data + config)
    ("GET", "/api/manager/anomalies/summary", _FM, None),
    ("GET", "/api/manager/anomalies/recent", _FM, None),
    ("GET", "/api/manager/anomalies/trends", _FM, None),
    ("GET", "/api/manager/anomalies/by-zone", _FM, None),
    ("GET", "/api/manager/anomalies/recurrence-config", _FM, None),
    ("PATCH", "/api/manager/anomalies/recurrence-config", _FM, {}),
    # resolve lives under a separate prefix
    ("PATCH", "/api/sensor-alerts/1/resolve", _FM, None),
    # sensors (manager-used reads + live + export)
    ("GET", "/api/sensors", _FM, None),
    ("POST", "/api/sensors/1/live", _FM, None),
    ("GET", "/api/sensors/1/latest", _FM, None),
    ("GET", "/api/sensors/1/readings", _FM, None),
    ("GET", "/api/sensors/1/alerts", _FM, None),
    ("POST", "/api/sensors/export/email", _FM, {"to": "a@b.com", "attachments": []}),
]

_ALL_ROLES = ("Visitor", "Worker", "FarmManager")


@pytest.mark.parametrize("method,url,allowed,body", PROTECTED_CASES)
def test_protected_endpoint_requires_auth(method, url, allowed, body):
    """No token -> 401."""
    _clear_role()
    resp = _request(method, url, body)
    assert resp.status_code == 401, (
        f"{method} {url} should require authentication, got {resp.status_code}"
    )


@pytest.mark.parametrize("method,url,allowed,body", PROTECTED_CASES)
@pytest.mark.parametrize("role", _ALL_ROLES)
def test_protected_endpoint_role_enforcement(method, url, allowed, body, role):
    """Disallowed roles -> 403; allowed roles -> not blocked (not 401/403)."""
    _set_role(role)
    resp = _request(method, url, body)
    if role in allowed:
        assert resp.status_code not in (401, 403), (
            f"{role} should be allowed on {method} {url}, got {resp.status_code}"
        )
    else:
        assert resp.status_code == 403, (
            f"{role} should be forbidden on {method} {url}, got {resp.status_code}"
        )


# ---------------------------------------------------------------------------
# Regression: public catalog/read endpoints MUST stay public
# ---------------------------------------------------------------------------

PUBLIC_GET_URLS = [
    "/api/plants",
    "/api/plants/1",
    "/api/peppers",
    "/api/peppers/1",
]


@pytest.mark.parametrize("url", PUBLIC_GET_URLS)
def test_public_reads_remain_public(url):
    """Anonymous GET must not be blocked by an auth/role guard."""
    _clear_role()
    resp = client.get(url)
    assert resp.status_code not in (401, 403), (
        f"{url} must remain public, got {resp.status_code}"
    )


# ---------------------------------------------------------------------------
# Regression: intentionally-unchanged sensor endpoints must NOT gain a guard
# ---------------------------------------------------------------------------

UNCHANGED_CASES = [
    ("POST", "/api/sensors/sync", {}),
    ("POST", "/api/sensors/1/refresh", None),
    ("POST", "/api/sensors/auto-sync/run-now", None),
]


@pytest.mark.parametrize("method,url,body", UNCHANGED_CASES)
def test_unchanged_sensor_endpoints_have_no_role_guard(method, url, body):
    """These were left public on purpose — anonymous access must not be 401/403."""
    _clear_role()
    resp = _request(method, url, body)
    assert resp.status_code not in (401, 403), (
        f"{method} {url} was supposed to stay unguarded, got {resp.status_code}"
    )
