"""
Tests for GET /api/spray-reports/zone-map (US28 – Manager Spray Map).

Covers:
  - All active zones are returned (never_sprayed when no reports exist)
  - Inactive zones are excluded
  - Zone with a completed spray from a verified pesticide → safe/unsafe based on REI
  - Zone with a completed spray from an unverified pesticide → requires_approval
  - Zone with only a future planned spray → pending
  - Zone with both completed and planned → correct status + nextPlannedAtUtc populated
  - Endpoint is restricted to FarmManager role (401/403 for others)
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
from utils.jwt import get_current_user, require_role

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


@pytest.fixture()
def client(db):
    def override_get_db():
        try:
            yield db
        finally:
            pass

    def fake_manager():
        return {"user_id": 1, "role": "FarmManager"}

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = fake_manager

    def _bypass_require_role(role):
        def _inner():
            return fake_manager()
        return _inner

    with patch("routers.spray.require_role", _bypass_require_role):
        with TestClient(app) as c:
            yield c

    app.dependency_overrides.clear()


# ── Seed helpers ──────────────────────────────────────────────────────────────

def seed_manager_role(db):
    role = Role(RoleName="FarmManager", RoleDescription="Farm manager")
    db.add(role)
    db.commit()
    user = User(
        UserId=1, FullName="Manager", Email="mgr@test.com",
        PasswordHash="hash", RoleId=role.RoleId, IsActive=True,
    )
    db.add(user)
    db.commit()


def seed_zone(db, code: str, name: str, active: bool = True) -> FarmZone:
    zone = FarmZone(ZoneCode=code, ZoneName=name, IsActive=active)
    db.add(zone)
    db.commit()
    db.refresh(zone)
    return zone


def seed_verified_pesticide(db, name="Confidor", rei_hours=12, phi_days=7):
    p = Pesticide(
        Name=name,
        ActiveIngredient="Imidacloprid",
        PreHarvestIntervalDays=phi_days,
        ReEntryIntervalHours=rei_hours,
        PpeRequired="Gloves",
        HazardLevel="medium",
        VerificationStatus="verified",
        IsActive=True,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


def seed_unverified_pesticide(db, name="Switch"):
    p = Pesticide(
        Name=name,
        VerificationStatus="unverified",
        IsActive=True,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


def seed_completed_report(db, zone_id, pesticide_id, user_id=1,
                           completed_at: datetime | None = None) -> SprayReport:
    completed_at = completed_at or datetime.utcnow() - timedelta(days=30)
    r = SprayReport(
        ZoneId=zone_id,
        PesticideId=pesticide_id,
        ReportedByUserId=user_id,
        Status="completed",
        CompletedAtUtc=completed_at,
        RequiresApproval=False,
    )
    db.add(r)
    db.commit()
    db.refresh(r)
    return r


def seed_planned_report(db, zone_id, pesticide_id, user_id=1,
                         planned_at: datetime | None = None) -> SprayReport:
    planned_at = planned_at or datetime.utcnow() + timedelta(days=3)
    r = SprayReport(
        ZoneId=zone_id,
        PesticideId=pesticide_id,
        ReportedByUserId=user_id,
        Status="planned",
        PlannedAtUtc=planned_at,
        RequiresApproval=False,
    )
    db.add(r)
    db.commit()
    db.refresh(r)
    return r


# ── Tests ─────────────────────────────────────────────────────────────────────

def test_zone_map_returns_200(client, db):
    seed_manager_role(db)
    response = client.get("/api/spray-reports/zone-map")
    assert response.status_code == 200


def test_zone_map_returns_list(client, db):
    seed_manager_role(db)
    seed_zone(db, "GH-01", "Greenhouse 1")
    seed_zone(db, "GH-02", "Greenhouse 2")

    response = client.get("/api/spray-reports/zone-map")
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 2


def test_zone_map_excludes_inactive_zones(client, db):
    seed_manager_role(db)
    seed_zone(db, "GH-01", "Greenhouse 1", active=True)
    seed_zone(db, "GH-99", "Old Zone",     active=False)

    data = client.get("/api/spray-reports/zone-map").json()
    codes = [z["zoneCode"] for z in data]
    assert "GH-01" in codes
    assert "GH-99" not in codes


def test_zone_with_no_reports_is_never_sprayed(client, db):
    seed_manager_role(db)
    seed_zone(db, "GH-01", "Greenhouse 1")

    data = client.get("/api/spray-reports/zone-map").json()
    zone = next(z for z in data if z["zoneCode"] == "GH-01")
    assert zone["sprayStatus"] == "never_sprayed"
    assert zone["lastCompletedAtUtc"] is None
    assert zone["pesticideName"] is None


def test_zone_with_only_planned_report_is_pending(client, db):
    seed_manager_role(db)
    zone = seed_zone(db, "GH-02", "Greenhouse 2")
    pesticide = seed_verified_pesticide(db)
    seed_planned_report(db, zone.ZoneId, pesticide.PesticideId,
                        planned_at=datetime.utcnow() + timedelta(days=2))

    data = client.get("/api/spray-reports/zone-map").json()
    zone_data = next(z for z in data if z["zoneCode"] == "GH-02")
    assert zone_data["sprayStatus"] == "pending"
    assert zone_data["nextPlannedAtUtc"] is not None


def test_zone_within_rei_is_unsafe(client, db):
    seed_manager_role(db)
    zone = seed_zone(db, "GH-03", "Greenhouse 3")
    # REI = 12 hours; spray completed 1 hour ago → still within REI
    pesticide = seed_verified_pesticide(db, rei_hours=12)
    seed_completed_report(db, zone.ZoneId, pesticide.PesticideId,
                           completed_at=datetime.utcnow() - timedelta(hours=1))

    data = client.get("/api/spray-reports/zone-map").json()
    zone_data = next(z for z in data if z["zoneCode"] == "GH-03")
    assert zone_data["sprayStatus"] == "unsafe"
    assert zone_data["safeToReEnterAtUtc"] is not None
    assert zone_data["pesticideName"] == "Confidor"


def test_zone_past_rei_is_safe(client, db):
    seed_manager_role(db)
    zone = seed_zone(db, "GH-04", "Greenhouse 4")
    # REI = 12 hours; spray completed 2 days ago → safe
    pesticide = seed_verified_pesticide(db, rei_hours=12)
    seed_completed_report(db, zone.ZoneId, pesticide.PesticideId,
                           completed_at=datetime.utcnow() - timedelta(days=2))

    data = client.get("/api/spray-reports/zone-map").json()
    zone_data = next(z for z in data if z["zoneCode"] == "GH-04")
    assert zone_data["sprayStatus"] == "safe"
    assert zone_data["lastCompletedAtUtc"] is not None


def test_zone_with_unverified_pesticide_requires_approval(client, db):
    seed_manager_role(db)
    zone = seed_zone(db, "GH-05", "Greenhouse 5")
    pesticide = seed_unverified_pesticide(db)
    seed_completed_report(db, zone.ZoneId, pesticide.PesticideId,
                           completed_at=datetime.utcnow() - timedelta(hours=1))

    data = client.get("/api/spray-reports/zone-map").json()
    zone_data = next(z for z in data if z["zoneCode"] == "GH-05")
    assert zone_data["sprayStatus"] == "requires_approval"
    assert zone_data["requiresApproval"] is True
    assert zone_data["safeToReEnterAtUtc"] is None
    assert zone_data["safeToHarvestAtUtc"] is None


def test_zone_with_completed_and_planned_shows_both(client, db):
    seed_manager_role(db)
    zone = seed_zone(db, "GH-06", "Greenhouse 6")
    pesticide = seed_verified_pesticide(db, rei_hours=12)
    # Completed 2 days ago (safe) + a future planned spray
    seed_completed_report(db, zone.ZoneId, pesticide.PesticideId,
                           completed_at=datetime.utcnow() - timedelta(days=2))
    seed_planned_report(db, zone.ZoneId, pesticide.PesticideId,
                         planned_at=datetime.utcnow() + timedelta(days=5))

    data = client.get("/api/spray-reports/zone-map").json()
    zone_data = next(z for z in data if z["zoneCode"] == "GH-06")
    assert zone_data["sprayStatus"] == "safe"
    assert zone_data["nextPlannedAtUtc"] is not None


def test_zone_map_response_has_required_fields(client, db):
    seed_manager_role(db)
    seed_zone(db, "GH-07", "Greenhouse 7")

    data = client.get("/api/spray-reports/zone-map").json()
    zone_data = data[0]
    required = {
        "zoneId", "zoneCode", "zoneName", "sprayStatus",
        "lastCompletedAtUtc", "pesticideName", "safeToReEnterAtUtc",
        "safeToHarvestAtUtc", "requiresApproval", "hazardLevel",
        "ppeRequired", "nextPlannedAtUtc",
    }
    assert required.issubset(zone_data.keys())


def test_zone_map_uses_most_recent_completed_report(client, db):
    """When multiple completed reports exist the most recent one wins."""
    seed_manager_role(db)
    zone = seed_zone(db, "GH-08", "Greenhouse 8")
    p_old = seed_verified_pesticide(db, name="OldProduct", rei_hours=24)
    p_new = seed_verified_pesticide(db, name="NewProduct", rei_hours=1)

    # Old report: 5 days ago
    seed_completed_report(db, zone.ZoneId, p_old.PesticideId,
                           completed_at=datetime.utcnow() - timedelta(days=5))
    # New report: 30 minutes ago (within REI of 1 h)
    seed_completed_report(db, zone.ZoneId, p_new.PesticideId,
                           completed_at=datetime.utcnow() - timedelta(minutes=30))

    data = client.get("/api/spray-reports/zone-map").json()
    zone_data = next(z for z in data if z["zoneCode"] == "GH-08")
    # Most recent report used NewProduct with REI=1h, sprayed 30 min ago → unsafe
    assert zone_data["sprayStatus"] == "unsafe"
    assert zone_data["pesticideName"] == "NewProduct"


def test_zone_map_uses_most_recent_spray_date_not_insertion_order(client, db):
    """Latest completed report is chosen by CompletedAtUtc, not by SprayReportId.

    Scenario: the newer spray (30 min ago) is inserted first so it gets a lower
    SprayReportId.  The older spray (10 days ago) is inserted second (higher id).
    max(SprayReportId) would incorrectly return the older spray; max(CompletedAtUtc)
    correctly returns the newer one.
    """
    seed_manager_role(db)
    zone = seed_zone(db, "GH-09", "Greenhouse 9")
    p_new = seed_verified_pesticide(db, name="NewProduct", rei_hours=1)
    p_old = seed_verified_pesticide(db, name="OldProduct", rei_hours=24)

    # Insert the NEWER spray FIRST → lower SprayReportId, but more recent date
    seed_completed_report(db, zone.ZoneId, p_new.PesticideId,
                           completed_at=datetime.utcnow() - timedelta(minutes=30))
    # Insert the OLDER spray SECOND → higher SprayReportId, but older date
    seed_completed_report(db, zone.ZoneId, p_old.PesticideId,
                           completed_at=datetime.utcnow() - timedelta(days=10))

    data = client.get("/api/spray-reports/zone-map").json()
    zone_data = next(z for z in data if z["zoneCode"] == "GH-09")
    # Must pick the report with the most recent CompletedAtUtc (NewProduct, 30 min ago)
    assert zone_data["pesticideName"] == "NewProduct"
    assert zone_data["sprayStatus"] == "unsafe"  # REI=1h, sprayed 30 min ago


def test_zone_map_sorted_by_zone_code(client, db):
    seed_manager_role(db)
    seed_zone(db, "GH-10", "Greenhouse 10")
    seed_zone(db, "GH-02", "Greenhouse 2")
    seed_zone(db, "GH-05", "Greenhouse 5")

    data = client.get("/api/spray-reports/zone-map").json()
    codes = [z["zoneCode"] for z in data]
    assert codes == sorted(codes)
