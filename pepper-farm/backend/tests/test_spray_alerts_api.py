"""
Tests for US30 — Manager Spray Alerts.

Covers:
  - SprayAlert generated when a completed spray report is submitted (verified pesticide)
  - SprayAlert generated when a planned spray report is submitted
  - SprayAlert generated for unverified pesticide → severity = 'high', RequiresApproval = True
  - SprayAlert severity = 'medium' when completed report is within REI window
  - SprayAlert severity = 'low' when completed report is past REI window
  - GET /api/spray-reports/alerts — manager can fetch list (200)
  - GET /api/spray-reports/alerts — non-manager is blocked (401/403)
  - GET /api/spray-reports/alerts/{id} — returns alert details
  - GET /api/spray-reports/alerts/{id} — 404 for unknown ID
  - PATCH /api/spray-reports/alerts/{id}/read — marks alert as read
  - PATCH /api/spray-reports/alerts/{id}/read — idempotent (already read stays read)
  - Existing spray report tests are not broken (US29 still works)
  - Existing spray map tests are not broken (US28 still works)
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
import models.spray           # noqa: F401  -- registers Pesticide, SprayReport, SprayAlert

from models.farm_zone import FarmZone
from models.user import User
from models.role import Role
from models.spray import Pesticide, SprayAlert, SprayReport
from utils.jwt import get_current_user, require_role, require_any_role

# ── DB setup ─────────────────────────────────────────────────────────────────

engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestSession = sessionmaker(bind=engine)


@event.listens_for(engine, "connect")
def _sqlite_functions(dbapi_conn, _):
    dbapi_conn.create_function(
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


# ── Client fixtures ───────────────────────────────────────────────────────────

@pytest.fixture()
def manager_client(db):
    """TestClient authenticated as FarmManager."""
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

    def _bypass_require_any_role(*roles):
        def _inner():
            return fake_manager()
        return _inner

    with (
        patch("routers.spray.require_role", _bypass_require_role),
        patch("routers.spray.require_any_role", _bypass_require_any_role),
    ):
        with TestClient(app) as c:
            yield c

    app.dependency_overrides.clear()


@pytest.fixture()
def worker_client(db):
    """TestClient authenticated as Worker (should be blocked from alert endpoints)."""
    def override_get_db():
        try:
            yield db
        finally:
            pass

    def fake_worker():
        return {"user_id": 2, "role": "Worker"}

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = fake_worker

    # Worker is NOT given manager bypass — require_role("FarmManager") will reject it.
    with TestClient(app) as c:
        yield c

    app.dependency_overrides.clear()


# ── Seed helpers ──────────────────────────────────────────────────────────────

def seed_manager(db):
    role = Role(RoleName="FarmManager", RoleDescription="Farm manager")
    db.add(role)
    db.commit()
    user = User(
        UserId=1, FullName="Manager", Email="mgr@test.com",
        PasswordHash="hash", RoleId=role.RoleId, IsActive=True,
    )
    db.add(user)
    db.commit()


def seed_zone(db, code="GH-01", name="Greenhouse 1") -> FarmZone:
    zone = FarmZone(ZoneCode=code, ZoneName=name, IsActive=True)
    db.add(zone)
    db.commit()
    db.refresh(zone)
    return zone


def seed_verified_pesticide(db, name="Confidor", rei_hours=12, phi_days=7) -> Pesticide:
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


def seed_unverified_pesticide(db, name="Switch") -> Pesticide:
    p = Pesticide(
        Name=name,
        VerificationStatus="unverified",
        IsActive=True,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


# ── 1. Alert creation via POST /api/spray-reports ─────────────────────────────

def test_spray_alert_created_when_completed_report_submitted(manager_client, db):
    """Submitting a completed spray report creates exactly one SprayAlert."""
    seed_manager(db)
    zone = seed_zone(db)
    pesticide = seed_verified_pesticide(db)

    manager_client.post("/api/spray-reports", json={
        "zoneId": zone.ZoneId,
        "pesticideId": pesticide.PesticideId,
        "reportType": "completed",
    })

    alerts = db.query(SprayAlert).all()
    assert len(alerts) == 1
    a = alerts[0]
    assert a.ZoneId == zone.ZoneId
    assert a.ZoneCode == zone.ZoneCode
    assert a.ZoneName == zone.ZoneName
    assert a.PesticideName == pesticide.Name
    assert a.ReportStatus == "completed"
    assert a.IsRead is False


def test_spray_alert_created_when_planned_report_submitted(manager_client, db):
    """Submitting a planned spray report creates exactly one SprayAlert."""
    seed_manager(db)
    zone = seed_zone(db)
    pesticide = seed_verified_pesticide(db)
    future = (datetime.utcnow() + timedelta(days=2)).isoformat()

    manager_client.post("/api/spray-reports", json={
        "zoneId": zone.ZoneId,
        "pesticideId": pesticide.PesticideId,
        "reportType": "planned",
        "plannedAtUtc": future,
    })

    alerts = db.query(SprayAlert).all()
    assert len(alerts) == 1
    assert alerts[0].ReportStatus == "planned"


def test_spray_alert_severity_high_for_unverified_pesticide(manager_client, db):
    """Unverified pesticide → Severity='high', RequiresApproval=True."""
    seed_manager(db)
    zone = seed_zone(db)
    pesticide = seed_unverified_pesticide(db)

    manager_client.post("/api/spray-reports", json={
        "zoneId": zone.ZoneId,
        "pesticideId": pesticide.PesticideId,
        "reportType": "completed",
    })

    alert = db.query(SprayAlert).first()
    assert alert.Severity == "high"
    assert alert.RequiresApproval is True


def test_spray_alert_severity_medium_within_rei(manager_client, db):
    """Completed report within REI window → Severity='medium'."""
    seed_manager(db)
    zone = seed_zone(db)
    # REI = 24 hours, sprayed just now → still within REI
    pesticide = seed_verified_pesticide(db, rei_hours=24)

    manager_client.post("/api/spray-reports", json={
        "zoneId": zone.ZoneId,
        "pesticideId": pesticide.PesticideId,
        "reportType": "completed",
    })

    alert = db.query(SprayAlert).first()
    assert alert.Severity == "medium"
    assert alert.RequiresApproval is False


def test_spray_alert_severity_low_for_planned_report(manager_client, db):
    """Planned report → Severity='low'."""
    seed_manager(db)
    zone = seed_zone(db)
    pesticide = seed_verified_pesticide(db, rei_hours=12)
    future = (datetime.utcnow() + timedelta(days=3)).isoformat()

    manager_client.post("/api/spray-reports", json={
        "zoneId": zone.ZoneId,
        "pesticideId": pesticide.PesticideId,
        "reportType": "planned",
        "plannedAtUtc": future,
    })

    alert = db.query(SprayAlert).first()
    assert alert.Severity == "low"


# ── 2. GET /api/spray-reports/alerts ─────────────────────────────────────────

def test_get_spray_alerts_returns_200_for_manager(manager_client, db):
    seed_manager(db)
    response = manager_client.get("/api/spray-reports/alerts")
    assert response.status_code == 200


def test_get_spray_alerts_returns_empty_list_when_no_reports(manager_client, db):
    seed_manager(db)
    response = manager_client.get("/api/spray-reports/alerts")
    assert response.json() == []


def test_get_spray_alerts_returns_alert_after_report_submitted(manager_client, db):
    seed_manager(db)
    zone = seed_zone(db)
    pesticide = seed_verified_pesticide(db)

    manager_client.post("/api/spray-reports", json={
        "zoneId": zone.ZoneId,
        "pesticideId": pesticide.PesticideId,
        "reportType": "completed",
    })

    response = manager_client.get("/api/spray-reports/alerts")
    data = response.json()
    assert len(data) == 1
    alert = data[0]
    assert alert["ZoneCode"] == zone.ZoneCode
    assert alert["PesticideName"] == pesticide.Name
    assert alert["IsRead"] is False


def test_get_spray_alerts_includes_required_fields(manager_client, db):
    seed_manager(db)
    zone = seed_zone(db)
    pesticide = seed_verified_pesticide(db)

    manager_client.post("/api/spray-reports", json={
        "zoneId": zone.ZoneId,
        "pesticideId": pesticide.PesticideId,
        "reportType": "completed",
    })

    data = manager_client.get("/api/spray-reports/alerts").json()
    required = {
        "SprayAlertId", "SprayReportId", "ZoneId", "ZoneCode", "ZoneName",
        "PesticideName", "ReportedByUserId", "ReportStatus", "Severity",
        "SafetyMessage", "RequiresApproval", "ReEntryIntervalHours",
        "SafeToReEnterAtUtc", "SafeToHarvestAtUtc", "HazardLevel",
        "PpeRequired", "SprayedAtUtc", "IsRead", "CreatedAt",
    }
    assert required.issubset(data[0].keys())


def test_get_spray_alerts_blocked_for_non_manager(worker_client, db):
    """Worker role must not access spray alerts (expects 401 or 403)."""
    response = worker_client.get("/api/spray-reports/alerts")
    assert response.status_code in (401, 403)


def test_get_spray_alerts_newest_first(manager_client, db):
    """Alerts are returned in descending creation order."""
    seed_manager(db)
    zone = seed_zone(db)
    pesticide = seed_verified_pesticide(db)

    manager_client.post("/api/spray-reports", json={
        "zoneId": zone.ZoneId,
        "pesticideId": pesticide.PesticideId,
        "reportType": "completed",
        "notes": "first",
    })

    future = (datetime.utcnow() + timedelta(days=2)).isoformat()
    manager_client.post("/api/spray-reports", json={
        "zoneId": zone.ZoneId,
        "pesticideId": pesticide.PesticideId,
        "reportType": "planned",
        "plannedAtUtc": future,
        "notes": "second",
    })

    data = manager_client.get("/api/spray-reports/alerts").json()
    assert len(data) == 2
    # Newest (planned) should come first
    assert data[0]["ReportStatus"] == "planned"
    assert data[1]["ReportStatus"] == "completed"


# ── 3. GET /api/spray-reports/alerts/{id} ─────────────────────────────────────

def test_get_spray_alert_by_id_returns_200(manager_client, db):
    seed_manager(db)
    zone = seed_zone(db)
    pesticide = seed_verified_pesticide(db)

    manager_client.post("/api/spray-reports", json={
        "zoneId": zone.ZoneId,
        "pesticideId": pesticide.PesticideId,
        "reportType": "completed",
    })

    alert_id = db.query(SprayAlert).first().SprayAlertId
    response = manager_client.get(f"/api/spray-reports/alerts/{alert_id}")
    assert response.status_code == 200
    assert response.json()["SprayAlertId"] == alert_id


def test_get_spray_alert_by_id_404_for_unknown(manager_client, db):
    seed_manager(db)
    response = manager_client.get("/api/spray-reports/alerts/9999")
    assert response.status_code == 404


# ── 4. PATCH /api/spray-reports/alerts/{id}/read ──────────────────────────────

def test_mark_spray_alert_read(manager_client, db):
    seed_manager(db)
    zone = seed_zone(db)
    pesticide = seed_verified_pesticide(db)

    manager_client.post("/api/spray-reports", json={
        "zoneId": zone.ZoneId,
        "pesticideId": pesticide.PesticideId,
        "reportType": "completed",
    })

    alert_id = db.query(SprayAlert).first().SprayAlertId
    response = manager_client.patch(f"/api/spray-reports/alerts/{alert_id}/read")
    assert response.status_code == 200
    assert response.json()["IsRead"] is True


def test_mark_spray_alert_read_idempotent(manager_client, db):
    """Marking an already-read alert is a no-op and returns 200."""
    seed_manager(db)
    zone = seed_zone(db)
    pesticide = seed_verified_pesticide(db)

    manager_client.post("/api/spray-reports", json={
        "zoneId": zone.ZoneId,
        "pesticideId": pesticide.PesticideId,
        "reportType": "completed",
    })

    alert_id = db.query(SprayAlert).first().SprayAlertId
    manager_client.patch(f"/api/spray-reports/alerts/{alert_id}/read")
    response = manager_client.patch(f"/api/spray-reports/alerts/{alert_id}/read")
    assert response.status_code == 200
    assert response.json()["IsRead"] is True


def test_mark_spray_alert_read_404_for_unknown(manager_client, db):
    seed_manager(db)
    response = manager_client.patch("/api/spray-reports/alerts/9999/read")
    assert response.status_code == 404


# ── 5. Snapshot data ──────────────────────────────────────────────────────────

def test_spray_alert_contains_rei_and_harvest_dates_for_verified(manager_client, db):
    """Verified pesticide: SafeToReEnterAtUtc and SafeToHarvestAtUtc are populated."""
    seed_manager(db)
    zone = seed_zone(db)
    pesticide = seed_verified_pesticide(db, rei_hours=12, phi_days=7)

    manager_client.post("/api/spray-reports", json={
        "zoneId": zone.ZoneId,
        "pesticideId": pesticide.PesticideId,
        "reportType": "completed",
    })

    data = manager_client.get("/api/spray-reports/alerts").json()[0]
    assert data["SafeToReEnterAtUtc"] is not None
    assert data["SafeToHarvestAtUtc"] is not None
    assert data["ReEntryIntervalHours"] == 12


def test_spray_alert_no_dates_for_unverified(manager_client, db):
    """Unverified pesticide: date fields are null, RequiresApproval is True."""
    seed_manager(db)
    zone = seed_zone(db)
    pesticide = seed_unverified_pesticide(db)

    manager_client.post("/api/spray-reports", json={
        "zoneId": zone.ZoneId,
        "pesticideId": pesticide.PesticideId,
        "reportType": "completed",
    })

    data = manager_client.get("/api/spray-reports/alerts").json()[0]
    assert data["SafeToReEnterAtUtc"] is None
    assert data["SafeToHarvestAtUtc"] is None
    assert data["RequiresApproval"] is True


def test_spray_alert_has_sprayed_at_utc_for_completed(manager_client, db):
    seed_manager(db)
    zone = seed_zone(db)
    pesticide = seed_verified_pesticide(db)

    manager_client.post("/api/spray-reports", json={
        "zoneId": zone.ZoneId,
        "pesticideId": pesticide.PesticideId,
        "reportType": "completed",
    })

    data = manager_client.get("/api/spray-reports/alerts").json()[0]
    assert data["SprayedAtUtc"] is not None


def test_spray_alert_has_sprayed_at_utc_for_planned(manager_client, db):
    seed_manager(db)
    zone = seed_zone(db)
    pesticide = seed_verified_pesticide(db)
    future = (datetime.utcnow() + timedelta(days=3)).isoformat()

    manager_client.post("/api/spray-reports", json={
        "zoneId": zone.ZoneId,
        "pesticideId": pesticide.PesticideId,
        "reportType": "planned",
        "plannedAtUtc": future,
    })

    data = manager_client.get("/api/spray-reports/alerts").json()[0]
    assert data["SprayedAtUtc"] is not None


# ── 6. Graceful failure: SprayAlerts table missing ────────────────────────────

def test_spray_report_succeeds_even_if_alert_generation_fails(manager_client, db):
    """POST /api/spray-reports returns 201 even when _generate_spray_alert raises.

    Guards against the real-world scenario where the SprayAlerts DDL has not yet
    been run against the production database ('Invalid object name SprayAlerts').
    """
    seed_manager(db)
    zone = seed_zone(db)
    pesticide = seed_verified_pesticide(db)

    with patch("services.spray_service._generate_spray_alert", side_effect=Exception("Table does not exist")):
        response = manager_client.post("/api/spray-reports", json={
            "zoneId": zone.ZoneId,
            "pesticideId": pesticide.PesticideId,
            "reportType": "completed",
        })

    # The spray report itself must be saved and 201 returned to the worker.
    assert response.status_code == 201
    data = response.json()
    assert data["report"]["SprayReportId"] is not None

    # SprayReport row must exist in the DB.
    reports = db.query(SprayReport).all()
    assert len(reports) == 1

    # No alert row because generation was patched to fail.
    alerts = db.query(SprayAlert).all()
    assert len(alerts) == 0
