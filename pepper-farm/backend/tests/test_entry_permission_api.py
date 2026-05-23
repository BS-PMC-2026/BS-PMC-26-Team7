"""
Tests for US33 — Post-Spray Entry Safety Check.

Verifies that every zone response from the public and authenticated restricted-zone
endpoints now includes entry permission fields:
  - entryPermissionStatus  ('allowed' | 'restricted' | 'caution' | 'planned_warning' | 'no_data')
  - entryAllowed           (bool)
  - entryMessage           (str)
  - remainingRestrictionMinutes  (int | null)

Covers:
  - Entry is restricted when latest completed spray is within REI.
  - Entry is allowed when REI has passed.
  - Unverified pesticide returns caution (entryAllowed=False, entryPermissionStatus='caution').
  - No spray history returns no_data (entryAllowed=True).
  - Planned future spray returns planned_warning (entryAllowed=True, not restricted).
  - Latest spray is selected by datetime (max CompletedAtUtc), NOT by SprayReportId.
  - Public endpoint returns 200 without auth and includes entry permission fields.
  - Public response does NOT expose manager-only fields (ReportedByUserId, SprayAlertId).
  - remainingRestrictionMinutes is positive integer when restricted, null otherwise.
  - entryMessage is non-empty string for every status.
  - US28 zone-map still returns 403 for Worker (regression).
  - US29/US30/US31 restricted-zones still returns correct sprayStatus (regression).
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


def _make_worker_client(db):
    def override_get_db():
        try:
            yield db
        finally:
            pass

    def fake_user():
        return {"user_id": 1, "role": "Worker"}

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = fake_user

    def _bypass_require_role(required_role):
        def _inner():
            if required_role == "FarmManager":
                from fastapi import HTTPException
                raise HTTPException(status_code=403, detail="Access denied.")
            return fake_user()
        return _inner

    def _bypass_require_any_role(*roles):
        def _inner():
            if "Worker" not in roles:
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
def worker_client(db):
    yield from _make_worker_client(db)


@pytest.fixture()
def public_client(db):
    """TestClient with NO auth — simulates unauthenticated visitor."""
    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as c:
        yield c

    app.dependency_overrides.clear()


# ── Seed helpers ──────────────────────────────────────────────────────────────

def seed_zone(db, code="GH-01", name="Greenhouse 1", active=True) -> FarmZone:
    zone = FarmZone(ZoneCode=code, ZoneName=name, IsActive=active)
    db.add(zone)
    db.commit()
    db.refresh(zone)
    return zone


def seed_verified_pesticide(db, name="Confidor", rei_hours=12, phi_days=7) -> Pesticide:
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


def seed_unverified_pesticide(db, name="Switch") -> Pesticide:
    p = Pesticide(Name=name, VerificationStatus="unverified", IsActive=True)
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


def seed_completed_report(db, zone_id, pesticide_id, completed_at=None) -> SprayReport:
    completed_at = completed_at or datetime.utcnow() - timedelta(days=30)
    r = SprayReport(
        ZoneId=zone_id, PesticideId=pesticide_id, ReportedByUserId=1,
        Status="completed", CompletedAtUtc=completed_at, RequiresApproval=False,
    )
    db.add(r)
    db.commit()
    db.refresh(r)
    return r


def seed_planned_report(db, zone_id, pesticide_id, planned_at=None) -> SprayReport:
    planned_at = planned_at or datetime.utcnow() + timedelta(days=3)
    r = SprayReport(
        ZoneId=zone_id, PesticideId=pesticide_id, ReportedByUserId=1,
        Status="planned", PlannedAtUtc=planned_at, RequiresApproval=False,
    )
    db.add(r)
    db.commit()
    db.refresh(r)
    return r


# ── Entry permission field presence ──────────────────────────────────────────

def test_entry_permission_fields_present_in_restricted_zones(worker_client, db):
    """Every zone response includes the US33 entry permission fields."""
    seed_zone(db)
    data = worker_client.get("/api/spray-reports/restricted-zones").json()
    assert len(data) == 1
    zone = data[0]
    assert "entryPermissionStatus" in zone
    assert "entryAllowed" in zone
    assert "entryMessage" in zone
    assert "remainingRestrictionMinutes" in zone


def test_entry_permission_fields_present_in_public_endpoint(public_client, db):
    """Public endpoint also includes US33 entry permission fields."""
    seed_zone(db)
    data = public_client.get("/api/spray-reports/public-restricted-zones").json()
    assert len(data) == 1
    zone = data[0]
    assert "entryPermissionStatus" in zone
    assert "entryAllowed" in zone
    assert "entryMessage" in zone


# ── Entry restricted when within REI ─────────────────────────────────────────

def test_entry_restricted_when_within_rei(worker_client, db):
    """REI=12h, sprayed 1h ago → entry restricted."""
    zone = seed_zone(db, "GH-02", "Greenhouse 2")
    pesticide = seed_verified_pesticide(db, rei_hours=12)
    seed_completed_report(db, zone.ZoneId, pesticide.PesticideId,
                          completed_at=datetime.utcnow() - timedelta(hours=1))
    data = worker_client.get("/api/spray-reports/restricted-zones").json()
    z = next(x for x in data if x["zoneCode"] == "GH-02")
    assert z["entryPermissionStatus"] == "restricted"
    assert z["entryAllowed"] is False
    assert "not" in z["entryMessage"].lower() or "restrict" in z["entryMessage"].lower()


def test_remaining_restriction_minutes_positive_when_restricted(worker_client, db):
    """remainingRestrictionMinutes > 0 when entry is currently restricted."""
    zone = seed_zone(db, "GH-02", "Greenhouse 2")
    pesticide = seed_verified_pesticide(db, rei_hours=12)
    seed_completed_report(db, zone.ZoneId, pesticide.PesticideId,
                          completed_at=datetime.utcnow() - timedelta(hours=1))
    data = worker_client.get("/api/spray-reports/restricted-zones").json()
    z = next(x for x in data if x["zoneCode"] == "GH-02")
    assert z["remainingRestrictionMinutes"] is not None
    assert z["remainingRestrictionMinutes"] > 0


# ── Entry allowed when REI passed ─────────────────────────────────────────────

def test_entry_allowed_when_rei_passed(worker_client, db):
    """REI=12h, sprayed 2 days ago → entry allowed."""
    zone = seed_zone(db, "GH-03", "Greenhouse 3")
    pesticide = seed_verified_pesticide(db, rei_hours=12)
    seed_completed_report(db, zone.ZoneId, pesticide.PesticideId,
                          completed_at=datetime.utcnow() - timedelta(days=2))
    data = worker_client.get("/api/spray-reports/restricted-zones").json()
    z = next(x for x in data if x["zoneCode"] == "GH-03")
    assert z["entryPermissionStatus"] == "allowed"
    assert z["entryAllowed"] is True
    assert z["remainingRestrictionMinutes"] is None


# ── Unverified pesticide → caution ───────────────────────────────────────────

def test_entry_caution_for_unverified_pesticide(worker_client, db):
    """Unverified pesticide → caution (entryAllowed=False)."""
    zone = seed_zone(db, "GH-04", "Greenhouse 4")
    pesticide = seed_unverified_pesticide(db)
    seed_completed_report(db, zone.ZoneId, pesticide.PesticideId,
                          completed_at=datetime.utcnow() - timedelta(hours=1))
    data = worker_client.get("/api/spray-reports/restricted-zones").json()
    z = next(x for x in data if x["zoneCode"] == "GH-04")
    assert z["entryPermissionStatus"] == "caution"
    assert z["entryAllowed"] is False
    assert "consult" in z["entryMessage"].lower() or "unverif" in z["entryMessage"].lower()
    assert z["remainingRestrictionMinutes"] is None


# ── No spray history → no_data (allowed) ─────────────────────────────────────

def test_entry_no_data_when_no_spray_history(worker_client, db):
    """No spray history → entryPermissionStatus='no_data', entryAllowed=True."""
    seed_zone(db, "GH-05", "Greenhouse 5")
    data = worker_client.get("/api/spray-reports/restricted-zones").json()
    z = next(x for x in data if x["zoneCode"] == "GH-05")
    assert z["entryPermissionStatus"] == "no_data"
    assert z["entryAllowed"] is True
    assert z["remainingRestrictionMinutes"] is None


# ── Planned future spray → planned_warning (still allowed) ───────────────────

def test_entry_planned_warning_for_future_spray(worker_client, db):
    """Zone with only a future planned spray → planned_warning, entry still allowed."""
    zone = seed_zone(db, "GH-06", "Greenhouse 6")
    pesticide = seed_verified_pesticide(db)
    seed_planned_report(db, zone.ZoneId, pesticide.PesticideId,
                        planned_at=datetime.utcnow() + timedelta(days=2))
    data = worker_client.get("/api/spray-reports/restricted-zones").json()
    z = next(x for x in data if x["zoneCode"] == "GH-06")
    assert z["entryPermissionStatus"] == "planned_warning"
    assert z["entryAllowed"] is True
    assert z["remainingRestrictionMinutes"] is None


# ── Latest spray selected by datetime, not SprayReportId ─────────────────────

def test_entry_permission_uses_latest_datetime_not_id(worker_client, db):
    """Most recent CompletedAtUtc wins — older high-ID spray must NOT override."""
    zone = seed_zone(db, "GH-07", "Greenhouse 7")
    p_new = seed_verified_pesticide(db, name="NewPest", rei_hours=1)
    p_old = seed_verified_pesticide(db, name="OldPest", rei_hours=48)

    # Insert newer spray first (lower ID), older spray second (higher ID).
    seed_completed_report(db, zone.ZoneId, p_new.PesticideId,
                          completed_at=datetime.utcnow() - timedelta(minutes=30))
    seed_completed_report(db, zone.ZoneId, p_old.PesticideId,
                          completed_at=datetime.utcnow() - timedelta(days=10))

    data = worker_client.get("/api/spray-reports/restricted-zones").json()
    z = next(x for x in data if x["zoneCode"] == "GH-07")
    # New pesticide REI=1h, sprayed 30min ago → still restricted
    assert z["pesticideName"] == "NewPest"
    assert z["entryPermissionStatus"] == "restricted"
    assert z["entryAllowed"] is False


# ── Public endpoint entry permission ─────────────────────────────────────────

def test_public_endpoint_returns_restricted_when_within_rei(public_client, db):
    """Public endpoint also shows restricted when within REI."""
    zone = seed_zone(db, "GH-08", "Greenhouse 8")
    pesticide = seed_verified_pesticide(db, rei_hours=12)
    seed_completed_report(db, zone.ZoneId, pesticide.PesticideId,
                          completed_at=datetime.utcnow() - timedelta(hours=1))
    data = public_client.get("/api/spray-reports/public-restricted-zones").json()
    z = next(x for x in data if x["zoneCode"] == "GH-08")
    assert z["entryPermissionStatus"] == "restricted"
    assert z["entryAllowed"] is False


def test_public_endpoint_returns_allowed_when_rei_passed(public_client, db):
    """Public endpoint shows allowed when REI has passed."""
    zone = seed_zone(db, "GH-09", "Greenhouse 9")
    pesticide = seed_verified_pesticide(db, rei_hours=12)
    seed_completed_report(db, zone.ZoneId, pesticide.PesticideId,
                          completed_at=datetime.utcnow() - timedelta(days=2))
    data = public_client.get("/api/spray-reports/public-restricted-zones").json()
    z = next(x for x in data if x["zoneCode"] == "GH-09")
    assert z["entryPermissionStatus"] == "allowed"
    assert z["entryAllowed"] is True


def test_public_endpoint_caution_for_unverified(public_client, db):
    """Public endpoint shows caution for unverified pesticide."""
    zone = seed_zone(db, "GH-10", "Greenhouse 10")
    pesticide = seed_unverified_pesticide(db)
    seed_completed_report(db, zone.ZoneId, pesticide.PesticideId,
                          completed_at=datetime.utcnow() - timedelta(hours=1))
    data = public_client.get("/api/spray-reports/public-restricted-zones").json()
    z = next(x for x in data if x["zoneCode"] == "GH-10")
    assert z["entryPermissionStatus"] == "caution"
    assert z["entryAllowed"] is False


# ── Data sanitisation — public endpoint ──────────────────────────────────────

def test_public_endpoint_does_not_expose_reported_by_user_id(public_client, db):
    """entryPermission fields must not reveal ReportedByUserId."""
    zone = seed_zone(db)
    pesticide = seed_verified_pesticide(db)
    seed_completed_report(db, zone.ZoneId, pesticide.PesticideId)
    data = public_client.get("/api/spray-reports/public-restricted-zones").json()
    for z in data:
        assert "ReportedByUserId" not in z
        assert "reportedByUserId" not in z


def test_public_endpoint_does_not_expose_spray_alert_ids(public_client, db):
    seed_zone(db)
    data = public_client.get("/api/spray-reports/public-restricted-zones").json()
    for z in data:
        assert "SprayAlertId" not in z
        assert "sprayAlertId" not in z


def test_entry_message_is_nonempty_for_all_statuses(worker_client, db):
    """entryMessage must be a non-empty string for every status."""
    # no_data
    seed_zone(db, "GH-01", "GH1")
    # planned_warning
    zone2 = seed_zone(db, "GH-02", "GH2")
    p = seed_verified_pesticide(db)
    seed_planned_report(db, zone2.ZoneId, p.PesticideId)
    # unsafe/restricted
    zone3 = seed_zone(db, "GH-03", "GH3")
    seed_completed_report(db, zone3.ZoneId, p.PesticideId,
                          completed_at=datetime.utcnow() - timedelta(hours=1))
    # safe/allowed
    zone4 = seed_zone(db, "GH-04", "GH4")
    seed_completed_report(db, zone4.ZoneId, p.PesticideId,
                          completed_at=datetime.utcnow() - timedelta(days=5))
    # caution
    zone5 = seed_zone(db, "GH-05", "GH5")
    up = seed_unverified_pesticide(db)
    seed_completed_report(db, zone5.ZoneId, up.PesticideId,
                          completed_at=datetime.utcnow() - timedelta(hours=1))

    data = worker_client.get("/api/spray-reports/restricted-zones").json()
    for z in data:
        assert isinstance(z["entryMessage"], str)
        assert len(z["entryMessage"]) > 0


# ── Regression: US28 zone-map still manager-only ─────────────────────────────

def test_us28_zone_map_still_403_for_worker(worker_client, db):
    """US28 manager spray map must still reject Worker role (regression)."""
    response = worker_client.get("/api/spray-reports/zone-map")
    assert response.status_code == 403


# ── Regression: existing sprayStatus still correct ───────────────────────────

def test_spray_status_unsafe_still_returned_correctly(worker_client, db):
    """Existing sprayStatus field still returns 'unsafe' when within REI (US31 regression)."""
    zone = seed_zone(db, "GH-11", "Greenhouse 11")
    pesticide = seed_verified_pesticide(db, rei_hours=24)
    seed_completed_report(db, zone.ZoneId, pesticide.PesticideId,
                          completed_at=datetime.utcnow() - timedelta(hours=2))
    data = worker_client.get("/api/spray-reports/restricted-zones").json()
    z = next(x for x in data if x["zoneCode"] == "GH-11")
    assert z["sprayStatus"] == "unsafe"


def test_spray_status_requires_approval_still_returned(worker_client, db):
    """Existing sprayStatus 'requires_approval' still returned (US29/31 regression)."""
    zone = seed_zone(db, "GH-12", "Greenhouse 12")
    pesticide = seed_unverified_pesticide(db, name="UnvPest2")
    seed_completed_report(db, zone.ZoneId, pesticide.PesticideId)
    data = worker_client.get("/api/spray-reports/restricted-zones").json()
    z = next(x for x in data if x["zoneCode"] == "GH-12")
    assert z["sprayStatus"] == "requires_approval"
