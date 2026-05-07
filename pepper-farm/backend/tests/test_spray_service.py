import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from datetime import datetime, timedelta

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from database import Base

# Import ALL related models so SQLAlchemy can build the FK graph correctly
import models.role            # noqa: F401
import models.pepper_variety  # noqa: F401
import models.farm_zone       # noqa: F401
import models.user            # noqa: F401
import models.spray           # noqa: F401  -- registers Pesticide, SprayReport

from models.farm_zone import FarmZone
from models.user import User
from models.role import Role
from models.spray import Pesticide, SprayReport
from schemas.spray import CreateSprayReportRequest
from services.spray_service import (
    get_active_pesticides,
    get_pesticide_by_id,
    get_zone_by_id,
    create_spray_report,
)

# ------------------------------------------------------------------ #
# Setup: SQLite in-memory DB (matches team convention)
# ------------------------------------------------------------------ #

SQLALCHEMY_TEST_URL = "sqlite:///:memory:"
engine = create_engine(SQLALCHEMY_TEST_URL, connect_args={"check_same_thread": False})
TestSession = sessionmaker(bind=engine)


# Teach SQLite the SQL Server function `sysutcdatetime()` used by spray models.
@event.listens_for(engine, "connect")
def _register_sqlite_functions(dbapi_connection, connection_record):
    dbapi_connection.create_function(
        "sysutcdatetime", 0,
        lambda: datetime.utcnow().isoformat(sep=" ")
    )


@pytest.fixture()
def db():
    Base.metadata.create_all(bind=engine)
    session = TestSession()
    yield session
    session.close()
    Base.metadata.drop_all(bind=engine)


# ------------------------------------------------------------------ #
# Seed helpers
# ------------------------------------------------------------------ #
def seed_role(db):
    role = Role(RoleName="Worker", RoleDescription="Field worker")
    db.add(role)
    db.commit()
    db.refresh(role)
    return role


def seed_user(db, role_id):
    user = User(
        FullName="Test Worker",
        Email="worker@test.com",
        PasswordHash="hash",
        RoleId=role_id,
        IsActive=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def seed_zone(db, code="GH-07", name="Greenhouse 7"):
    zone = FarmZone(ZoneCode=code, ZoneName=name, IsActive=True)
    db.add(zone)
    db.commit()
    db.refresh(zone)
    return zone


def seed_pesticide_verified(db, name="Confidor"):
    p = Pesticide(
        Name=name,
        ActiveIngredient="Imidacloprid",
        Manufacturer="Bayer",
        TargetPest="Aphids",
        PreHarvestIntervalDays=7,
        ReEntryIntervalHours=12,
        PpeRequired="Gloves, mask, long sleeves",
        HazardLevel="medium",
        VerificationStatus="verified",
        IsActive=True,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


def seed_pesticide_unverified(db, name="Switch"):
    p = Pesticide(
        Name=name,
        ActiveIngredient="Cyprodinil + Fludioxonil",
        Manufacturer="Syngenta",
        TargetPest="Botrytis",
        PreHarvestIntervalDays=None,
        ReEntryIntervalHours=None,
        PpeRequired=None,
        HazardLevel=None,
        VerificationStatus="unverified",
        IsActive=True,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


# ------------------------------------------------------------------ #
# 1. get_active_pesticides
# ------------------------------------------------------------------ #
def test_get_active_pesticides_returns_only_active(db):
    seed_pesticide_verified(db, name="Confidor")
    inactive = seed_pesticide_verified(db, name="OldStuff")
    inactive.IsActive = False
    db.commit()

    pesticides = get_active_pesticides(db)
    names = [p.Name for p in pesticides]
    assert "Confidor" in names
    assert "OldStuff" not in names


def test_get_active_pesticides_returns_empty_when_none(db):
    pesticides = get_active_pesticides(db)
    assert pesticides == []


def test_get_active_pesticides_orders_by_name(db):
    seed_pesticide_verified(db, name="Vertimec")
    seed_pesticide_verified(db, name="Confidor")
    seed_pesticide_verified(db, name="Movento")

    pesticides = get_active_pesticides(db)
    names = [p.Name for p in pesticides]
    assert names == ["Confidor", "Movento", "Vertimec"]


# ------------------------------------------------------------------ #
# 2. get_pesticide_by_id
# ------------------------------------------------------------------ #
def test_get_pesticide_by_id_existing(db):
    pesticide = seed_pesticide_verified(db)
    found = get_pesticide_by_id(db, pesticide.PesticideId)
    assert found is not None
    assert found.Name == "Confidor"


def test_get_pesticide_by_id_not_found(db):
    found = get_pesticide_by_id(db, 9999)
    assert found is None


# ------------------------------------------------------------------ #
# 3. get_zone_by_id
# ------------------------------------------------------------------ #
def test_get_zone_by_id_existing(db):
    zone = seed_zone(db)
    found = get_zone_by_id(db, zone.ZoneId)
    assert found is not None
    assert found.ZoneCode == "GH-07"


def test_get_zone_by_id_not_found(db):
    found = get_zone_by_id(db, 9999)
    assert found is None


# ------------------------------------------------------------------ #
# 4. create_spray_report - completed
# ------------------------------------------------------------------ #
def test_create_spray_report_completed_success(db):
    role = seed_role(db)
    user = seed_user(db, role.RoleId)
    zone = seed_zone(db)
    pesticide = seed_pesticide_verified(db)

    payload = CreateSprayReportRequest(
        zoneId=zone.ZoneId,
        pesticideId=pesticide.PesticideId,
        reportType="completed",
        notes="Routine spray",
    )
    result, error = create_spray_report(db, user.UserId, payload)

    assert error is None
    assert result is not None
    spray, warning = result
    assert spray.SprayReportId is not None
    assert spray.Status == "completed"
    assert spray.CompletedAtUtc is not None
    assert spray.PlannedAtUtc is None
    assert spray.Notes == "Routine spray"


def test_create_spray_report_sets_requires_approval_false_for_verified(db):
    role = seed_role(db)
    user = seed_user(db, role.RoleId)
    zone = seed_zone(db)
    pesticide = seed_pesticide_verified(db)

    payload = CreateSprayReportRequest(
        zoneId=zone.ZoneId,
        pesticideId=pesticide.PesticideId,
        reportType="completed",
    )
    result, _ = create_spray_report(db, user.UserId, payload)
    spray, _ = result
    assert spray.RequiresApproval is False


def test_create_spray_report_sets_requires_approval_true_for_unverified(db):
    role = seed_role(db)
    user = seed_user(db, role.RoleId)
    zone = seed_zone(db)
    pesticide = seed_pesticide_unverified(db)

    payload = CreateSprayReportRequest(
        zoneId=zone.ZoneId,
        pesticideId=pesticide.PesticideId,
        reportType="completed",
    )
    result, _ = create_spray_report(db, user.UserId, payload)
    spray, _ = result
    assert spray.RequiresApproval is True


# ------------------------------------------------------------------ #
# 5. create_spray_report - planned
# ------------------------------------------------------------------ #
def test_create_spray_report_planned_success(db):
    role = seed_role(db)
    user = seed_user(db, role.RoleId)
    zone = seed_zone(db)
    pesticide = seed_pesticide_verified(db)

    future = datetime.utcnow() + timedelta(days=2)
    payload = CreateSprayReportRequest(
        zoneId=zone.ZoneId,
        pesticideId=pesticide.PesticideId,
        reportType="planned",
        plannedAtUtc=future,
    )
    result, error = create_spray_report(db, user.UserId, payload)

    assert error is None
    spray, _ = result
    assert spray.Status == "planned"
    assert spray.PlannedAtUtc is not None
    assert spray.CompletedAtUtc is None


def test_create_spray_report_planned_in_past_fails(db):
    role = seed_role(db)
    user = seed_user(db, role.RoleId)
    zone = seed_zone(db)
    pesticide = seed_pesticide_verified(db)

    past = datetime.utcnow() - timedelta(days=1)
    payload = CreateSprayReportRequest(
        zoneId=zone.ZoneId,
        pesticideId=pesticide.PesticideId,
        reportType="planned",
        plannedAtUtc=past,
    )
    result, error = create_spray_report(db, user.UserId, payload)

    assert result is None
    assert error is not None
    assert "future" in error.lower() or "past" in error.lower()


def test_create_spray_report_planned_without_date_fails(db):
    role = seed_role(db)
    user = seed_user(db, role.RoleId)
    zone = seed_zone(db)
    pesticide = seed_pesticide_verified(db)

    payload = CreateSprayReportRequest(
        zoneId=zone.ZoneId,
        pesticideId=pesticide.PesticideId,
        reportType="planned",
        plannedAtUtc=None,
    )
    result, error = create_spray_report(db, user.UserId, payload)

    assert result is None
    assert error is not None


# ------------------------------------------------------------------ #
# 6. create_spray_report - validation errors
# ------------------------------------------------------------------ #
def test_create_spray_report_invalid_zone_fails(db):
    role = seed_role(db)
    user = seed_user(db, role.RoleId)
    pesticide = seed_pesticide_verified(db)

    payload = CreateSprayReportRequest(
        zoneId=9999,
        pesticideId=pesticide.PesticideId,
        reportType="completed",
    )
    result, error = create_spray_report(db, user.UserId, payload)

    assert result is None
    assert error is not None
    assert "zone" in error.lower()


def test_create_spray_report_invalid_pesticide_fails(db):
    role = seed_role(db)
    user = seed_user(db, role.RoleId)
    zone = seed_zone(db)

    payload = CreateSprayReportRequest(
        zoneId=zone.ZoneId,
        pesticideId=9999,
        reportType="completed",
    )
    result, error = create_spray_report(db, user.UserId, payload)

    assert result is None
    assert error is not None
    assert "pesticide" in error.lower()


def test_create_spray_report_inactive_pesticide_fails(db):
    role = seed_role(db)
    user = seed_user(db, role.RoleId)
    zone = seed_zone(db)
    pesticide = seed_pesticide_verified(db)
    pesticide.IsActive = False
    db.commit()

    payload = CreateSprayReportRequest(
        zoneId=zone.ZoneId,
        pesticideId=pesticide.PesticideId,
        reportType="completed",
    )
    result, error = create_spray_report(db, user.UserId, payload)

    assert result is None
    assert error is not None
    assert "pesticide" in error.lower() and "active" in error.lower()


# ------------------------------------------------------------------ #
# 7. Safety warning - verified pesticide
# ------------------------------------------------------------------ #
def test_safety_warning_verified_returns_dates(db):
    """Verified pesticide must produce concrete safe-to-re-enter and
    safe-to-harvest dates based on REI hours and PHI days."""
    role = seed_role(db)
    user = seed_user(db, role.RoleId)
    zone = seed_zone(db)
    pesticide = seed_pesticide_verified(db)  # REI=12h, PHI=7 days

    payload = CreateSprayReportRequest(
        zoneId=zone.ZoneId,
        pesticideId=pesticide.PesticideId,
        reportType="completed",
    )
    result, _ = create_spray_report(db, user.UserId, payload)
    spray, warning = result

    assert warning is not None
    assert warning.pesticideName == "Confidor"
    assert warning.verificationStatus == "verified"
    assert warning.safeToReEnterAtUtc is not None
    assert warning.safeToHarvestAtUtc is not None
    # Dates should be in the future relative to spray time
    assert warning.safeToReEnterAtUtc > spray.CompletedAtUtc
    assert warning.safeToHarvestAtUtc > spray.CompletedAtUtc


def test_safety_warning_verified_includes_ppe_and_hazard(db):
    role = seed_role(db)
    user = seed_user(db, role.RoleId)
    zone = seed_zone(db)
    pesticide = seed_pesticide_verified(db)

    payload = CreateSprayReportRequest(
        zoneId=zone.ZoneId,
        pesticideId=pesticide.PesticideId,
        reportType="completed",
    )
    result, _ = create_spray_report(db, user.UserId, payload)
    _, warning = result

    assert warning.ppeRequired == "Gloves, mask, long sleeves"
    assert warning.hazardLevel == "medium"


# ------------------------------------------------------------------ #
# 8. Safety warning - unverified pesticide
# ------------------------------------------------------------------ #
def test_safety_warning_unverified_returns_consult_label(db):
    """Unverified pesticide must NOT compute dates - just tell the user
    to consult the official product label."""
    role = seed_role(db)
    user = seed_user(db, role.RoleId)
    zone = seed_zone(db)
    pesticide = seed_pesticide_unverified(db)

    payload = CreateSprayReportRequest(
        zoneId=zone.ZoneId,
        pesticideId=pesticide.PesticideId,
        reportType="completed",
    )
    result, _ = create_spray_report(db, user.UserId, payload)
    _, warning = result

    assert warning is not None
    assert warning.verificationStatus == "unverified"
    assert warning.safeToReEnterAtUtc is None
    assert warning.safeToHarvestAtUtc is None
    assert warning.message is not None
    assert "label" in warning.message.lower() or "consult" in warning.message.lower()


# ------------------------------------------------------------------ #
# 9. Safety warning - planned spray
# ------------------------------------------------------------------ #
def test_safety_warning_planned_uses_planned_date_as_anchor(db):
    """For a planned spray, the safety dates must be computed relative to
    the planned time, not 'now'."""
    role = seed_role(db)
    user = seed_user(db, role.RoleId)
    zone = seed_zone(db)
    pesticide = seed_pesticide_verified(db)  # REI=12h

    future = datetime.utcnow() + timedelta(days=5)
    payload = CreateSprayReportRequest(
        zoneId=zone.ZoneId,
        pesticideId=pesticide.PesticideId,
        reportType="planned",
        plannedAtUtc=future,
    )
    result, _ = create_spray_report(db, user.UserId, payload)
    _, warning = result

    # Safe to re-enter should be ~12 hours after the planned time
    expected_re_entry = future + timedelta(hours=12)
    delta = abs((warning.safeToReEnterAtUtc - expected_re_entry).total_seconds())
    assert delta < 60  # within a minute