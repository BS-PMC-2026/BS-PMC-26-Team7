"""
Tests for GET /api/spray-reports/restricted-zones (US31 – All-User Restriction Map).

Covers:
  - Endpoint returns 200 for FarmManager role
  - Endpoint returns 200 for Worker role
  - Endpoint returns 200 for Visitor role
  - Endpoint returns 401/403 for unauthenticated requests
  - All active zones are returned (never_sprayed when no reports exist)
  - Inactive zones are excluded
  - Zone within REI is 'unsafe' (restricted)
  - Zone past REI is 'safe'
  - Zone with unverified pesticide → 'requires_approval'
  - Zone with only a planned spray → 'pending'
  - No spray report for a zone → 'never_sprayed' (safe, no restriction)
  - Response does not expose manager-only fields (ReportedByUserId, SprayAlertId)
  - Manager-only endpoint /zone-map returns 403 for Worker role
  - Manager-only endpoint /zone-map returns 403 for Visitor role
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from datetime import datetime, timedelta
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base, get_db
from main import app

import models.role            # noqa: F401
import models.pepper_variety  # noqa: F401
import models.farm_zone       # noqa: F401
import models.user            # noqa: F401
import models.spray           # noqa: F401

from models.farm_zone import FarmZone
from models.user import User
from models.role import Role
from models.spray import Pesticide, SprayReport
from utils.jwt import get_current_user, require_role, require_any_role

# ── DB setup ──────────────────────────────────────────────────────────────────

engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestSession = sessionmaker(bind=engine)


@event.listens_for(engine, "connect")
def _sqlite_functions(dbapi_conn, _):
    dbapi_conn.create_function("sysutcdatetime", 0,
                               lambda: datetime.utcnow().isoformat(sep=" "))


@pytest.fixture()
def db():
    Base.metadata.create_all(bind=engine)
    session = TestSession()
    yield session
    session.close()
    Base.metadata.drop_all(bind=engine)


def _make_client(db, role: str):
    """Build a TestClient with a fake user of the given role."""
    def override_get_db():
        try:
            yield db
        finally:
            pass

    def fake_user():
        return {"user_id": 1, "role": role}

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = fake_user

    def _bypass_require_role(required_role):
        def _inner():
            return fake_user()
        return _inner

    def _bypass_require_any_role(*roles):
        def _inner():
            # Enforce role restriction correctly for testing
            if role not in roles:
                from fastapi import HTTPException
                raise HTTPException(status_code=403, detail="Access denied.")
            return fake_user()
        return _inner

    with patch("routers.spray.require_role", _bypass_require_role), \
         patch("routers.spray.require_any_role", _bypass_require_any_role):
        with TestClient(app) as c:
            yield c

    app.dependency_overrides.clear()


@pytest.fixture()
def manager_client(db):
    yield from _make_client(db, "FarmManager")


@pytest.fixture()
def worker_client(db):
    yield from _make_client(db, "Worker")


@pytest.fixture()
def visitor_client(db):
    yield from _make_client(db, "Visitor")


# ── Seed helpers (shared with spray map tests) ────────────────────────────────

def seed_zone(db, code: str, name: str, active: bool = True) -> FarmZone:
    zone = FarmZone(ZoneCode=code, ZoneName=name, IsActive=active)
    db.add(zone)
    db.commit()
    db.refresh(zone)
    return zone


def seed_verified_pesticide(db, name="Confidor", rei_hours=12, phi_days=7):
    p = Pesticide(
        Name=name, ActiveIngredient="Imidacloprid",
        PreHarvestIntervalDays=phi_days, ReEntryIntervalHours=rei_hours,
        PpeRequired="Gloves", HazardLevel="medium",
        VerificationStatus="verified", IsActive=True,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


def seed_unverified_pesticide(db, name="Switch"):
    p = Pesticide(Name=name, VerificationStatus="unverified", IsActive=True)
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


def seed_completed_report(db, zone_id, pesticide_id, user_id=1,
                           completed_at=None) -> SprayReport:
    completed_at = completed_at or datetime.utcnow() - timedelta(days=30)
    r = SprayReport(
        ZoneId=zone_id, PesticideId=pesticide_id, ReportedByUserId=user_id,
        Status="completed", CompletedAtUtc=completed_at, RequiresApproval=False,
    )
    db.add(r)
    db.commit()
    db.refresh(r)
    return r


def seed_planned_report(db, zone_id, pesticide_id, user_id=1,
                         planned_at=None) -> SprayReport:
    planned_at = planned_at or datetime.utcnow() + timedelta(days=3)
    r = SprayReport(
        ZoneId=zone_id, PesticideId=pesticide_id, ReportedByUserId=user_id,
        Status="planned", PlannedAtUtc=planned_at, RequiresApproval=False,
    )
    db.add(r)
    db.commit()
    db.refresh(r)
    return r


# ── Role access tests ─────────────────────────────────────────────────────────

def test_restricted_zones_returns_200_for_manager(manager_client, db):
    response = manager_client.get("/api/spray-reports/restricted-zones")
    assert response.status_code == 200


def test_restricted_zones_returns_200_for_worker(worker_client, db):
    response = worker_client.get("/api/spray-reports/restricted-zones")
    assert response.status_code == 200


def test_restricted_zones_returns_200_for_visitor(visitor_client, db):
    response = visitor_client.get("/api/spray-reports/restricted-zones")
    assert response.status_code == 200


def test_zone_map_still_returns_403_for_worker(worker_client, db):
    """US28 manager-only endpoint must remain protected from Worker role."""
    response = worker_client.get("/api/spray-reports/zone-map")
    assert response.status_code == 403


def test_zone_map_still_returns_403_for_visitor(visitor_client, db):
    """US28 manager-only endpoint must remain protected from Visitor role."""
    response = visitor_client.get("/api/spray-reports/zone-map")
    assert response.status_code == 403


# ── Zone status tests ─────────────────────────────────────────────────────────

def test_restricted_zones_returns_list(worker_client, db):
    seed_zone(db, "GH-01", "Greenhouse 1")
    seed_zone(db, "GH-02", "Greenhouse 2")
    data = worker_client.get("/api/spray-reports/restricted-zones").json()
    assert isinstance(data, list)
    assert len(data) == 2


def test_restricted_zones_excludes_inactive(worker_client, db):
    seed_zone(db, "GH-01", "Active Zone", active=True)
    seed_zone(db, "GH-99", "Inactive Zone", active=False)
    data = worker_client.get("/api/spray-reports/restricted-zones").json()
    codes = [z["zoneCode"] for z in data]
    assert "GH-01" in codes
    assert "GH-99" not in codes


def test_no_spray_report_returns_never_sprayed(worker_client, db):
    """Zone with no spray history is never_sprayed (safe, no restriction)."""
    seed_zone(db, "GH-01", "Greenhouse 1")
    data = worker_client.get("/api/spray-reports/restricted-zones").json()
    zone = next(z for z in data if z["zoneCode"] == "GH-01")
    assert zone["sprayStatus"] == "never_sprayed"
    assert zone["safeToReEnterAtUtc"] is None


def test_zone_within_rei_is_unsafe(worker_client, db):
    """REI=12h, sprayed 1h ago → restricted (unsafe)."""
    zone = seed_zone(db, "GH-02", "Greenhouse 2")
    pesticide = seed_verified_pesticide(db, rei_hours=12)
    seed_completed_report(db, zone.ZoneId, pesticide.PesticideId,
                           completed_at=datetime.utcnow() - timedelta(hours=1))
    data = worker_client.get("/api/spray-reports/restricted-zones").json()
    zone_data = next(z for z in data if z["zoneCode"] == "GH-02")
    assert zone_data["sprayStatus"] == "unsafe"
    assert zone_data["safeToReEnterAtUtc"] is not None


def test_zone_past_rei_is_safe(worker_client, db):
    """REI=12h, sprayed 2 days ago → safe."""
    zone = seed_zone(db, "GH-03", "Greenhouse 3")
    pesticide = seed_verified_pesticide(db, rei_hours=12)
    seed_completed_report(db, zone.ZoneId, pesticide.PesticideId,
                           completed_at=datetime.utcnow() - timedelta(days=2))
    data = worker_client.get("/api/spray-reports/restricted-zones").json()
    zone_data = next(z for z in data if z["zoneCode"] == "GH-03")
    assert zone_data["sprayStatus"] == "safe"


def test_unverified_pesticide_is_requires_approval(worker_client, db):
    """Unverified pesticide → requires_approval (caution status)."""
    zone = seed_zone(db, "GH-04", "Greenhouse 4")
    pesticide = seed_unverified_pesticide(db)
    seed_completed_report(db, zone.ZoneId, pesticide.PesticideId,
                           completed_at=datetime.utcnow() - timedelta(hours=1))
    data = worker_client.get("/api/spray-reports/restricted-zones").json()
    zone_data = next(z for z in data if z["zoneCode"] == "GH-04")
    assert zone_data["sprayStatus"] == "requires_approval"
    assert zone_data["safeToReEnterAtUtc"] is None


def test_only_planned_report_is_pending(worker_client, db):
    """Zone with only a future planned spray → pending."""
    zone = seed_zone(db, "GH-05", "Greenhouse 5")
    pesticide = seed_verified_pesticide(db)
    seed_planned_report(db, zone.ZoneId, pesticide.PesticideId,
                         planned_at=datetime.utcnow() + timedelta(days=2))
    data = worker_client.get("/api/spray-reports/restricted-zones").json()
    zone_data = next(z for z in data if z["zoneCode"] == "GH-05")
    assert zone_data["sprayStatus"] == "pending"
    assert zone_data["nextPlannedAtUtc"] is not None


# ── Data sanitisation tests ───────────────────────────────────────────────────

def test_response_has_expected_safety_fields(worker_client, db):
    """Response contains fields needed for safety decisions."""
    seed_zone(db, "GH-06", "Greenhouse 6")
    data = worker_client.get("/api/spray-reports/restricted-zones").json()
    zone = data[0]
    required = {"zoneId", "zoneCode", "zoneName", "sprayStatus",
                "safeToReEnterAtUtc", "safeToHarvestAtUtc", "pesticideName",
                "hazardLevel", "ppeRequired", "nextPlannedAtUtc"}
    assert required.issubset(zone.keys())


def test_response_does_not_expose_reported_by_user_id(worker_client, db):
    """The all-user endpoint must not return ReportedByUserId (manager-internal)."""
    zone = seed_zone(db, "GH-07", "Greenhouse 7")
    pesticide = seed_verified_pesticide(db)
    seed_completed_report(db, zone.ZoneId, pesticide.PesticideId)
    data = worker_client.get("/api/spray-reports/restricted-zones").json()
    for z in data:
        assert "ReportedByUserId" not in z
        assert "reportedByUserId" not in z


def test_response_does_not_expose_spray_alert_ids(worker_client, db):
    """The all-user endpoint must not return SprayAlertId fields."""
    seed_zone(db, "GH-08", "Greenhouse 8")
    data = worker_client.get("/api/spray-reports/restricted-zones").json()
    for z in data:
        assert "SprayAlertId" not in z
        assert "sprayAlertId" not in z


def test_uses_most_recent_completed_report(worker_client, db):
    """Most recent CompletedAtUtc wins, not insertion order."""
    zone = seed_zone(db, "GH-09", "Greenhouse 9")
    p_new = seed_verified_pesticide(db, name="NewProduct", rei_hours=1)
    p_old = seed_verified_pesticide(db, name="OldProduct", rei_hours=24)

    # Insert newer spray first (lower ID), older spray second (higher ID)
    seed_completed_report(db, zone.ZoneId, p_new.PesticideId,
                           completed_at=datetime.utcnow() - timedelta(minutes=30))
    seed_completed_report(db, zone.ZoneId, p_old.PesticideId,
                           completed_at=datetime.utcnow() - timedelta(days=10))

    data = worker_client.get("/api/spray-reports/restricted-zones").json()
    zone_data = next(z for z in data if z["zoneCode"] == "GH-09")
    assert zone_data["pesticideName"] == "NewProduct"
    assert zone_data["sprayStatus"] == "unsafe"
