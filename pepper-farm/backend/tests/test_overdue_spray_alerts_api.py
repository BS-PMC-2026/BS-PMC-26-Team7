"""
Tests for US32 — Periodic Overdue Spray Alert and Task Assignment.

Covers:
  - overdue alert created when zone not sprayed within interval
  - no overdue alert when zone recently sprayed
  - zone with no spray history treated as overdue after interval
  - duplicate prevention: repeated check does not create duplicate active alerts
  - manager can fetch overdue spray alerts (GET /api/spray-reports/overdue-alerts)
  - worker/visitor cannot fetch overdue spray alerts (403/401)
  - active_only query param filters resolved alerts
  - manager can mark overdue alert read (PATCH .../read)
  - manager can assign spray task from overdue alert (POST .../assign)
  - assigning creates task and links it to alert
  - assigning twice is idempotent (returns same task, no duplicate)
  - assigning to non-worker role returns 400
  - submitting a completed spray report resolves overdue alert for that zone
  - manual trigger endpoint (POST /api/spray-reports/overdue-check/run)
  - US28 spray map tests still pass (zone-map endpoint works)
  - US30 spray alert tests still pass (alerts endpoint works)
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
import models.task            # noqa: F401
import models.spray           # noqa: F401

from models.farm_zone import FarmZone
from models.user import User
from models.role import Role
from models.spray import OverdueSprayAlert, Pesticide, SprayAlert, SprayReport
from models.task import Task
from services.overdue_spray_check_service import (
    DEFAULT_SPRAY_INTERVAL_DAYS,
    check_overdue_spray_zones,
)
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
    dbapi_conn.create_function(
        "sysutcdatetime", 0,
        lambda: datetime.utcnow().isoformat(sep=" ")
    )
    dbapi_conn.create_function(
        "sysdatetime", 0,
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

def _make_manager_client(db):
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

    return (
        patch("routers.spray.require_role", _bypass_require_role),
        patch("routers.spray.require_any_role", _bypass_require_any_role),
        patch("routers.tasks.require_role", _bypass_require_role),
        patch("routers.tasks.get_current_user", fake_manager),
    )


@pytest.fixture()
def manager_client(db):
    """TestClient authenticated as FarmManager."""
    patches = _make_manager_client(db)
    with patches[0], patches[1], patches[2], patches[3]:
        with TestClient(app) as c:
            yield c
    app.dependency_overrides.clear()


@pytest.fixture()
def worker_client(db):
    """TestClient authenticated as Worker (blocked from overdue alert endpoints)."""
    def override_get_db():
        try:
            yield db
        finally:
            pass

    def fake_worker():
        return {"user_id": 2, "role": "Worker"}

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = fake_worker

    with TestClient(app) as c:
        yield c

    app.dependency_overrides.clear()


# ── Seed helpers ──────────────────────────────────────────────────────────────

def seed_manager(db, user_id=1):
    role = Role(RoleName="FarmManager", RoleDescription="Farm manager")
    db.add(role)
    db.commit()
    user = User(
        UserId=user_id, FullName="Manager", Email="mgr@test.com",
        PasswordHash="hash", RoleId=role.RoleId, IsActive=True,
    )
    db.add(user)
    db.commit()
    return user


def seed_worker(db, user_id=2):
    role = db.query(Role).filter(Role.RoleName == "Worker").first()
    if role is None:
        role = Role(RoleName="Worker", RoleDescription="Worker")
        db.add(role)
        db.commit()
    worker = User(
        UserId=user_id, FullName="Worker One", Email="worker@test.com",
        PasswordHash="hash", RoleId=role.RoleId, IsActive=True,
    )
    db.add(worker)
    db.commit()
    return worker


def seed_zone(
    db,
    code="GH-01",
    name="Greenhouse 1",
    created_at: datetime | None = None,
) -> FarmZone:
    zone = FarmZone(ZoneCode=code, ZoneName=name, IsActive=True)
    if created_at is not None:
        zone.CreatedAt = created_at
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
        VerificationStatus="verified",
        IsActive=True,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


def seed_completed_spray(db, zone: FarmZone, pesticide: Pesticide, completed_at: datetime, user_id=1):
    report = SprayReport(
        ZoneId=zone.ZoneId,
        PesticideId=pesticide.PesticideId,
        ReportedByUserId=user_id,
        Status="completed",
        CompletedAtUtc=completed_at,
        RequiresApproval=False,
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return report


# ── 1. Overdue check logic ────────────────────────────────────────────────────

def test_overdue_alert_created_when_zone_not_sprayed(db):
    """Zone never sprayed and older than interval → alert created."""
    old_creation = datetime.utcnow() - timedelta(days=DEFAULT_SPRAY_INTERVAL_DAYS + 5)
    zone = seed_zone(db, created_at=old_creation)

    created = check_overdue_spray_zones(db)

    assert created == 1
    alerts = db.query(OverdueSprayAlert).all()
    assert len(alerts) == 1
    a = alerts[0]
    assert a.ZoneId == zone.ZoneId
    assert a.IsResolved is False
    assert a.AssignedTaskId is None


def test_no_overdue_alert_when_zone_recently_sprayed(db):
    """Zone sprayed within interval → no alert."""
    zone = seed_zone(db)
    pesticide = seed_verified_pesticide(db)
    recent = datetime.utcnow() - timedelta(days=5)
    seed_completed_spray(db, zone, pesticide, completed_at=recent)

    created = check_overdue_spray_zones(db)
    assert created == 0
    assert db.query(OverdueSprayAlert).count() == 0


def test_overdue_alert_created_when_last_spray_too_old(db):
    """Zone sprayed but more than interval days ago → alert created."""
    zone = seed_zone(db)
    pesticide = seed_verified_pesticide(db)
    old_spray = datetime.utcnow() - timedelta(days=DEFAULT_SPRAY_INTERVAL_DAYS + 10)
    seed_completed_spray(db, zone, pesticide, completed_at=old_spray)

    created = check_overdue_spray_zones(db)
    assert created == 1


def test_no_overdue_alert_for_new_zone_not_yet_past_interval(db):
    """Zone created less than interval days ago → not overdue yet."""
    new_creation = datetime.utcnow() - timedelta(days=5)
    seed_zone(db, created_at=new_creation)

    created = check_overdue_spray_zones(db)
    assert created == 0


def test_non_sprayable_zone_not_flagged(db):
    """SHED-MAIN zone must never generate an overdue alert."""
    old = datetime.utcnow() - timedelta(days=60)
    seed_zone(db, code="SHED-MAIN", name="Main Shed", created_at=old)

    created = check_overdue_spray_zones(db)
    assert created == 0


def test_duplicate_prevention_no_extra_alert_on_second_run(db):
    """Running check twice must not create a second active alert for the same zone."""
    old = datetime.utcnow() - timedelta(days=DEFAULT_SPRAY_INTERVAL_DAYS + 5)
    seed_zone(db, created_at=old)

    check_overdue_spray_zones(db)
    created_second_run = check_overdue_spray_zones(db)

    assert created_second_run == 0
    assert db.query(OverdueSprayAlert).count() == 1


def test_new_alert_created_after_old_one_is_resolved(db):
    """After resolving an old alert a new one should be created on the next check."""
    old = datetime.utcnow() - timedelta(days=DEFAULT_SPRAY_INTERVAL_DAYS + 5)
    zone = seed_zone(db, created_at=old)

    check_overdue_spray_zones(db)

    # Resolve the alert manually (simulating a spray report submission).
    alert = db.query(OverdueSprayAlert).first()
    alert.IsResolved = True
    alert.ResolvedAtUtc = datetime.utcnow()
    db.commit()

    # Zone still has no recent spray — a new alert should be created.
    created = check_overdue_spray_zones(db)
    assert created == 1
    assert db.query(OverdueSprayAlert).count() == 2


# ── 2. GET /api/spray-reports/overdue-alerts ─────────────────────────────────

def test_get_overdue_alerts_returns_200_for_manager(manager_client, db):
    response = manager_client.get("/api/spray-reports/overdue-alerts")
    assert response.status_code == 200


def test_get_overdue_alerts_returns_empty_list_when_no_alerts(manager_client, db):
    response = manager_client.get("/api/spray-reports/overdue-alerts")
    assert response.json() == []


def test_get_overdue_alerts_returns_created_alerts(manager_client, db):
    old = datetime.utcnow() - timedelta(days=DEFAULT_SPRAY_INTERVAL_DAYS + 5)
    seed_zone(db, created_at=old)
    check_overdue_spray_zones(db)

    response = manager_client.get("/api/spray-reports/overdue-alerts")
    data = response.json()
    assert len(data) == 1
    assert data[0]["IsResolved"] is False


def test_get_overdue_alerts_blocked_for_worker(worker_client, db):
    """Worker must not access overdue alerts (expects 401 or 403)."""
    response = worker_client.get("/api/spray-reports/overdue-alerts")
    assert response.status_code in (401, 403)


def test_get_overdue_alerts_active_only_filter(manager_client, db):
    """active_only=true returns only unresolved alerts."""
    old = datetime.utcnow() - timedelta(days=DEFAULT_SPRAY_INTERVAL_DAYS + 5)
    zone = seed_zone(db, created_at=old)
    check_overdue_spray_zones(db)

    # Resolve the alert.
    alert = db.query(OverdueSprayAlert).first()
    alert.IsResolved = True
    alert.ResolvedAtUtc = datetime.utcnow()
    db.commit()

    all_resp = manager_client.get("/api/spray-reports/overdue-alerts").json()
    active_resp = manager_client.get("/api/spray-reports/overdue-alerts?active_only=true").json()

    assert len(all_resp) == 1      # resolved still included
    assert len(active_resp) == 0   # excluded by filter


def test_get_overdue_alerts_includes_required_fields(manager_client, db):
    old = datetime.utcnow() - timedelta(days=DEFAULT_SPRAY_INTERVAL_DAYS + 5)
    seed_zone(db, created_at=old)
    check_overdue_spray_zones(db)

    data = manager_client.get("/api/spray-reports/overdue-alerts").json()
    required = {
        "OverdueAlertId", "ZoneId", "ZoneCode", "ZoneName",
        "LastSprayedAtUtc", "OverdueSinceUtc", "SprayIntervalDays",
        "Severity", "Message", "IsRead", "IsResolved",
        "ResolvedAtUtc", "AssignedTaskId", "CreatedAt",
    }
    assert required.issubset(data[0].keys())


# ── 3. PATCH .../overdue-alerts/{id}/read ────────────────────────────────────

def test_mark_overdue_alert_read(manager_client, db):
    old = datetime.utcnow() - timedelta(days=DEFAULT_SPRAY_INTERVAL_DAYS + 5)
    seed_zone(db, created_at=old)
    check_overdue_spray_zones(db)

    alert_id = db.query(OverdueSprayAlert).first().OverdueAlertId
    response = manager_client.patch(f"/api/spray-reports/overdue-alerts/{alert_id}/read")
    assert response.status_code == 200
    assert response.json()["IsRead"] is True


def test_mark_overdue_alert_read_idempotent(manager_client, db):
    old = datetime.utcnow() - timedelta(days=DEFAULT_SPRAY_INTERVAL_DAYS + 5)
    seed_zone(db, created_at=old)
    check_overdue_spray_zones(db)

    alert_id = db.query(OverdueSprayAlert).first().OverdueAlertId
    manager_client.patch(f"/api/spray-reports/overdue-alerts/{alert_id}/read")
    response = manager_client.patch(f"/api/spray-reports/overdue-alerts/{alert_id}/read")
    assert response.status_code == 200
    assert response.json()["IsRead"] is True


def test_mark_overdue_alert_read_404_for_unknown(manager_client, db):
    response = manager_client.patch("/api/spray-reports/overdue-alerts/9999/read")
    assert response.status_code == 404


# ── 4. POST .../overdue-alerts/{id}/assign ───────────────────────────────────

def test_assign_task_creates_task_and_links_to_alert(manager_client, db):
    """Manager assigns a task from an overdue alert — task is created and linked."""
    seed_manager(db, user_id=1)
    seed_worker(db, user_id=2)
    old = datetime.utcnow() - timedelta(days=DEFAULT_SPRAY_INTERVAL_DAYS + 5)
    seed_zone(db, created_at=old)
    check_overdue_spray_zones(db)

    alert_id = db.query(OverdueSprayAlert).first().OverdueAlertId
    response = manager_client.post(
        f"/api/spray-reports/overdue-alerts/{alert_id}/assign",
        json={"assignedToUserId": 2},
    )
    assert response.status_code == 201
    task_data = response.json()
    assert task_data["taskType"] == "spray"
    assert task_data["assignedToUserId"] == 2

    # Alert must now be linked to the task.
    alert = db.query(OverdueSprayAlert).first()
    assert alert.AssignedTaskId == task_data["id"]


def test_assign_task_idempotent_returns_same_task(manager_client, db):
    """Assigning a task twice must not create a duplicate — returns existing task."""
    seed_manager(db, user_id=1)
    seed_worker(db, user_id=2)
    old = datetime.utcnow() - timedelta(days=DEFAULT_SPRAY_INTERVAL_DAYS + 5)
    seed_zone(db, created_at=old)
    check_overdue_spray_zones(db)

    alert_id = db.query(OverdueSprayAlert).first().OverdueAlertId
    first = manager_client.post(
        f"/api/spray-reports/overdue-alerts/{alert_id}/assign",
        json={"assignedToUserId": 2},
    ).json()
    second = manager_client.post(
        f"/api/spray-reports/overdue-alerts/{alert_id}/assign",
        json={"assignedToUserId": 2},
    ).json()

    assert first["id"] == second["id"]
    assert db.query(Task).count() == 1


def test_assign_task_404_for_unknown_alert(manager_client, db):
    response = manager_client.post(
        "/api/spray-reports/overdue-alerts/9999/assign",
        json={"assignedToUserId": 2},
    )
    assert response.status_code == 404


def test_assign_task_400_for_resolved_alert(manager_client, db):
    seed_manager(db, user_id=1)
    old = datetime.utcnow() - timedelta(days=DEFAULT_SPRAY_INTERVAL_DAYS + 5)
    seed_zone(db, created_at=old)
    check_overdue_spray_zones(db)

    alert = db.query(OverdueSprayAlert).first()
    alert.IsResolved = True
    alert.ResolvedAtUtc = datetime.utcnow()
    db.commit()

    response = manager_client.post(
        f"/api/spray-reports/overdue-alerts/{alert.OverdueAlertId}/assign",
        json={"assignedToUserId": 2},
    )
    assert response.status_code == 400


def test_assign_task_400_for_non_worker(manager_client, db):
    """Task cannot be assigned to a FarmManager user."""
    seed_manager(db, user_id=1)
    old = datetime.utcnow() - timedelta(days=DEFAULT_SPRAY_INTERVAL_DAYS + 5)
    seed_zone(db, created_at=old)
    check_overdue_spray_zones(db)

    alert_id = db.query(OverdueSprayAlert).first().OverdueAlertId
    # user_id=1 is a FarmManager, not a Worker.
    response = manager_client.post(
        f"/api/spray-reports/overdue-alerts/{alert_id}/assign",
        json={"assignedToUserId": 1},
    )
    assert response.status_code == 400


# ── 5. Resolution via completed spray report ──────────────────────────────────

def test_completed_spray_report_resolves_overdue_alert(manager_client, db):
    """Submitting a completed spray report for the zone resolves its overdue alert."""
    seed_manager(db, user_id=1)
    pesticide = seed_verified_pesticide(db)
    old = datetime.utcnow() - timedelta(days=DEFAULT_SPRAY_INTERVAL_DAYS + 5)
    zone = seed_zone(db, created_at=old)
    check_overdue_spray_zones(db)

    assert db.query(OverdueSprayAlert).filter(OverdueSprayAlert.IsResolved == False).count() == 1

    manager_client.post("/api/spray-reports", json={
        "zoneId": zone.ZoneId,
        "pesticideId": pesticide.PesticideId,
        "reportType": "completed",
    })

    resolved_count = db.query(OverdueSprayAlert).filter(OverdueSprayAlert.IsResolved == True).count()
    assert resolved_count == 1


def test_planned_report_does_not_resolve_overdue_alert(manager_client, db):
    """A planned (not completed) spray report must NOT resolve the overdue alert."""
    seed_manager(db, user_id=1)
    pesticide = seed_verified_pesticide(db)
    old = datetime.utcnow() - timedelta(days=DEFAULT_SPRAY_INTERVAL_DAYS + 5)
    zone = seed_zone(db, created_at=old)
    check_overdue_spray_zones(db)

    future = (datetime.utcnow() + timedelta(days=3)).isoformat()
    manager_client.post("/api/spray-reports", json={
        "zoneId": zone.ZoneId,
        "pesticideId": pesticide.PesticideId,
        "reportType": "planned",
        "plannedAtUtc": future,
    })

    unresolved = db.query(OverdueSprayAlert).filter(OverdueSprayAlert.IsResolved == False).count()
    assert unresolved == 1


# ── 6. Manual trigger endpoint ────────────────────────────────────────────────

def test_manual_overdue_check_returns_200(manager_client, db):
    response = manager_client.post("/api/spray-reports/overdue-check/run")
    assert response.status_code == 200
    data = response.json()
    assert "alertsCreated" in data


def test_manual_overdue_check_blocked_for_worker(worker_client, db):
    response = worker_client.post("/api/spray-reports/overdue-check/run")
    assert response.status_code in (401, 403)


# ── 7. US28 / US30 regression: existing endpoints still work ─────────────────

def test_us28_zone_map_still_works(manager_client, db):
    response = manager_client.get("/api/spray-reports/zone-map")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_us30_spray_alerts_still_works(manager_client, db):
    response = manager_client.get("/api/spray-reports/alerts")
    assert response.status_code == 200
    assert isinstance(response.json(), list)
