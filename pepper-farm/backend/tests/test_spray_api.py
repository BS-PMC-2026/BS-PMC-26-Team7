import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from datetime import datetime, timedelta
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from database import Base, get_db
from main import app

# Import ALL related models so SQLAlchemy can build the FK graph correctly
import models.role            # noqa: F401
import models.pepper_variety  # noqa: F401
import models.farm_zone       # noqa: F401
import models.user            # noqa: F401
import models.spray           # noqa: F401  -- registers Pesticide, SprayReport

from models.farm_zone import FarmZone
from models.user import User
from models.role import Role
from models.spray import Pesticide
from utils.jwt import get_current_user

# ------------------------------------------------------------------ #
# Setup: One shared SQLite in-memory DB across the test client and
# the test fixture so the FastAPI route and the seed helpers see the
# same tables.
# ------------------------------------------------------------------ #

# StaticPool keeps a single connection alive so :memory: tables persist
# between the seed helper calls and the route's get_db() call.
from sqlalchemy.pool import StaticPool

engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestSession = sessionmaker(bind=engine)


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


@pytest.fixture()
def client(db):
    """TestClient with overridden DB and auth dependencies so the FastAPI
    route reads from the same SQLite test DB that we seed."""
    def override_get_db():
        try:
            yield db
        finally:
            pass

    def fake_user():
        return {"user_id": 1, "role": "Worker"}

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = fake_user

    # Bypass role guard so any seeded user can hit the endpoints.
    def _bypass_require_any_role(*roles):
        def _inner():
            return fake_user()
        return _inner

    with patch("routers.spray.require_any_role", _bypass_require_any_role):
        with TestClient(app) as c:
            yield c

    app.dependency_overrides.clear()


# ------------------------------------------------------------------ #
# Seed helpers
# ------------------------------------------------------------------ #
def seed_user_with_role(db):
    role = Role(RoleName="Worker", RoleDescription="Field worker")
    db.add(role)
    db.commit()
    user = User(
        UserId=1,
        FullName="Test Worker",
        Email="worker@test.com",
        PasswordHash="hash",
        RoleId=role.RoleId,
        IsActive=True,
    )
    db.add(user)
    db.commit()


def seed_zone(db, code="GH-07", name="Greenhouse 7"):
    zone = FarmZone(ZoneCode=code, ZoneName=name, IsActive=True)
    db.add(zone)
    db.commit()
    db.refresh(zone)
    return zone


def seed_pesticide(db, name="Confidor", verified=True):
    p = Pesticide(
        Name=name,
        ActiveIngredient="Imidacloprid",
        Manufacturer="Bayer",
        TargetPest="Aphids",
        PreHarvestIntervalDays=7 if verified else None,
        ReEntryIntervalHours=12 if verified else None,
        PpeRequired="Gloves" if verified else None,
        HazardLevel="medium" if verified else None,
        VerificationStatus="verified" if verified else "unverified",
        IsActive=True,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


# ------------------------------------------------------------------ #
# 1. GET /api/spray-reports/pesticides
# ------------------------------------------------------------------ #
def test_get_pesticides_returns_list(client, db):
    seed_user_with_role(db)
    seed_pesticide(db, name="Confidor")
    seed_pesticide(db, name="Movento")

    response = client.get("/api/spray-reports/pesticides")

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 2
    names = [p["Name"] for p in data]
    assert "Confidor" in names
    assert "Movento" in names


def test_get_pesticides_returns_empty_when_no_data(client, db):
    seed_user_with_role(db)
    response = client.get("/api/spray-reports/pesticides")
    assert response.status_code == 200
    assert response.json() == []


def test_get_pesticides_includes_verification_status(client, db):
    seed_user_with_role(db)
    seed_pesticide(db, name="Confidor", verified=True)
    seed_pesticide(db, name="Switch", verified=False)

    response = client.get("/api/spray-reports/pesticides")
    data = response.json()

    statuses = {p["Name"]: p["VerificationStatus"] for p in data}
    assert statuses["Confidor"] == "verified"
    assert statuses["Switch"] == "unverified"


# ------------------------------------------------------------------ #
# 2. POST /api/spray-reports - completed
# ------------------------------------------------------------------ #
def test_post_spray_report_completed_returns_201(client, db):
    seed_user_with_role(db)
    zone = seed_zone(db)
    pesticide = seed_pesticide(db)

    payload = {
        "zoneId": zone.ZoneId,
        "pesticideId": pesticide.PesticideId,
        "reportType": "completed",
        "notes": "TEST",
    }
    response = client.post("/api/spray-reports", json=payload)

    assert response.status_code == 201
    body = response.json()
    assert "report" in body
    assert body["report"]["Status"] == "completed"
    assert body["report"]["Notes"] == "TEST"


def test_post_spray_report_completed_includes_safety_warning(client, db):
    seed_user_with_role(db)
    zone = seed_zone(db)
    pesticide = seed_pesticide(db, verified=True)

    payload = {
        "zoneId": zone.ZoneId,
        "pesticideId": pesticide.PesticideId,
        "reportType": "completed",
    }
    response = client.post("/api/spray-reports", json=payload)
    body = response.json()

    assert "safetyWarning" in body
    warning = body["safetyWarning"]
    assert warning["pesticideName"] == "Confidor"
    assert warning["verificationStatus"] == "verified"
    assert warning["safeToReEnterAtUtc"] is not None
    assert warning["safeToHarvestAtUtc"] is not None


def test_post_spray_report_unverified_safety_warning_has_no_dates(client, db):
    seed_user_with_role(db)
    zone = seed_zone(db)
    pesticide = seed_pesticide(db, name="Switch", verified=False)

    payload = {
        "zoneId": zone.ZoneId,
        "pesticideId": pesticide.PesticideId,
        "reportType": "completed",
    }
    response = client.post("/api/spray-reports", json=payload)
    warning = response.json()["safetyWarning"]

    assert warning["verificationStatus"] == "unverified"
    assert warning["safeToReEnterAtUtc"] is None
    assert warning["safeToHarvestAtUtc"] is None
    assert warning["message"] is not None


# ------------------------------------------------------------------ #
# 3. POST /api/spray-reports - planned
# ------------------------------------------------------------------ #
def test_post_spray_report_planned_returns_201(client, db):
    seed_user_with_role(db)
    zone = seed_zone(db)
    pesticide = seed_pesticide(db)
    future = (datetime.utcnow() + timedelta(days=2)).isoformat()

    payload = {
        "zoneId": zone.ZoneId,
        "pesticideId": pesticide.PesticideId,
        "reportType": "planned",
        "plannedAtUtc": future,
    }
    response = client.post("/api/spray-reports", json=payload)

    assert response.status_code == 201
    body = response.json()
    assert body["report"]["Status"] == "planned"
    assert body["report"]["PlannedAtUtc"] is not None
    assert body["report"]["CompletedAtUtc"] is None


def test_post_spray_report_planned_in_past_returns_400(client, db):
    seed_user_with_role(db)
    zone = seed_zone(db)
    pesticide = seed_pesticide(db)
    past = (datetime.utcnow() - timedelta(days=1)).isoformat()

    payload = {
        "zoneId": zone.ZoneId,
        "pesticideId": pesticide.PesticideId,
        "reportType": "planned",
        "plannedAtUtc": past,
    }
    response = client.post("/api/spray-reports", json=payload)

    assert response.status_code == 400


# ------------------------------------------------------------------ #
# 4. POST /api/spray-reports - validation errors
# ------------------------------------------------------------------ #
def test_post_spray_report_invalid_zone_returns_error(client, db):
    seed_user_with_role(db)
    pesticide = seed_pesticide(db)

    payload = {
        "zoneId": 9999,
        "pesticideId": pesticide.PesticideId,
        "reportType": "completed",
    }
    response = client.post("/api/spray-reports", json=payload)

    assert response.status_code in (400, 404)


def test_post_spray_report_invalid_pesticide_returns_error(client, db):
    seed_user_with_role(db)
    zone = seed_zone(db)

    payload = {
        "zoneId": zone.ZoneId,
        "pesticideId": 9999,
        "reportType": "completed",
    }
    response = client.post("/api/spray-reports", json=payload)

    assert response.status_code in (400, 404)


def test_post_spray_report_missing_required_field_returns_422(client, db):
    seed_user_with_role(db)

    # Missing pesticideId
    payload = {
        "zoneId": 1,
        "reportType": "completed",
    }
    response = client.post("/api/spray-reports", json=payload)

    assert response.status_code == 422  # Pydantic validation error


def test_post_spray_report_invalid_report_type_returns_422(client, db):
    seed_user_with_role(db)
    zone = seed_zone(db)
    pesticide = seed_pesticide(db)

    payload = {
        "zoneId": zone.ZoneId,
        "pesticideId": pesticide.PesticideId,
        "reportType": "invalid_status",
    }
    response = client.post("/api/spray-reports", json=payload)

    assert response.status_code == 422