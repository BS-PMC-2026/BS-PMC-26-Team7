import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from datetime import datetime, timezone

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database import Base
from models.pepper_variety import PepperVariety
from models.farm_zone import FarmZone
from schemas.plant import PlantCreate
from services.plant_service import (
    create_plant,
    update_plant_location,
    _ERR_NOT_NURSERY,
    _ERR_NOT_GREENHOUSE,
)

SQLALCHEMY_TEST_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_TEST_URL,
    connect_args={"check_same_thread": False},
)
TestSession = sessionmaker(bind=engine)


@pytest.fixture()
def db():
    from models.plant import Plant  # ensure model is imported

    Base.metadata.create_all(bind=engine)
    session = TestSession()

    now = datetime.now(timezone.utc)

    session.add(
        PepperVariety(
            PepperId=1,
            PepperName="Jalapeno",
            IsActive=True,
            CreatedAt=now,
        )
    )

    # Zone 1 — Nursery (valid target for first planting)
    session.add(
        FarmZone(
            ZoneId=1,
            ZoneName="Nursery",
            ZoneCode="NURSERY",
            ZoneType="NURSERY",
            IsActive=True,
            CreatedAt=now,
        )
    )

    # Zone 2 — Growing greenhouse (valid transfer target)
    session.add(
        FarmZone(
            ZoneId=2,
            ZoneName="Greenhouse 1",
            ZoneCode="GH-01",
            ZoneType="GROWING_GREENHOUSE",
            IsActive=True,
            CreatedAt=now,
        )
    )

    # Zone 3 — Visitor greenhouse (valid transfer target)
    session.add(
        FarmZone(
            ZoneId=3,
            ZoneName="Germination 1",
            ZoneCode="GERM-01",
            ZoneType="VISITOR_GREENHOUSE",
            IsActive=True,
            CreatedAt=now,
        )
    )

    # Zone 4 — Production facility (invalid for both planting and transfer)
    session.add(
        FarmZone(
            ZoneId=4,
            ZoneName="Factory",
            ZoneCode="FACTORY",
            ZoneType="PRODUCTION_FACILITY",
            IsActive=True,
            CreatedAt=now,
        )
    )

    # Zone 5 — Main shed / parking (invalid)
    session.add(
        FarmZone(
            ZoneId=5,
            ZoneName="Main Shed",
            ZoneCode="SHED-MAIN",
            ZoneType="MAIN_SHED",
            IsActive=True,
            CreatedAt=now,
        )
    )

    session.commit()
    yield session
    session.close()
    Base.metadata.drop_all(bind=engine)


# ── Create-plant: valid cases ────────────────────────────────────────────────

def test_create_plant_valid(db):
    """Planting in Nursery succeeds."""
    dto = PlantCreate(
        PlantCode="PLANT-001",
        PepperId=1,
        ZoneId=1,           # NURSERY
        Status="Healthy",
        Notes="First plant",
        IsActive=True,
    )

    result, error = create_plant(db, dto)

    assert error is None
    assert result is not None
    assert result.PlantCode == "PLANT-001"
    assert result.PepperId == 1
    assert result.ZoneId == 1


def test_create_plant_no_zone(db):
    """Planting without specifying a zone (ZoneId=None) succeeds."""
    dto = PlantCreate(
        PlantCode="PLANT-NO-ZONE",
        PepperId=1,
        IsActive=True,
    )

    result, error = create_plant(db, dto)

    assert error is None
    assert result is not None
    assert result.ZoneId is None


# ── Create-plant: invalid zone type ─────────────────────────────────────────

def test_create_plant_in_growing_greenhouse_fails(db):
    """Planting directly in a growing greenhouse is rejected."""
    dto = PlantCreate(
        PlantCode="PLANT-GH",
        PepperId=1,
        ZoneId=2,           # GH-01 — not a nursery
        IsActive=True,
    )

    result, error = create_plant(db, dto)

    assert result is None
    assert error == _ERR_NOT_NURSERY


def test_create_plant_in_production_facility_fails(db):
    """Planting in the production facility is rejected."""
    dto = PlantCreate(
        PlantCode="PLANT-FACT",
        PepperId=1,
        ZoneId=4,           # FACTORY
        IsActive=True,
    )

    result, error = create_plant(db, dto)

    assert result is None
    assert error == _ERR_NOT_NURSERY


def test_create_plant_in_main_shed_fails(db):
    """Planting in the main shed / parking is rejected."""
    dto = PlantCreate(
        PlantCode="PLANT-SHED",
        PepperId=1,
        ZoneId=5,           # SHED-MAIN
        IsActive=True,
    )

    result, error = create_plant(db, dto)

    assert result is None
    assert error == _ERR_NOT_NURSERY


def test_create_plant_in_visitor_greenhouse_fails(db):
    """Planting directly in a visitor greenhouse is rejected (seedlings start in Nursery)."""
    dto = PlantCreate(
        PlantCode="PLANT-GERM",
        PepperId=1,
        ZoneId=3,           # GERM-01 — visitor greenhouse
        IsActive=True,
    )

    result, error = create_plant(db, dto)

    assert result is None
    assert error == _ERR_NOT_NURSERY


# ── Create-plant: other error paths ─────────────────────────────────────────

def test_create_plant_missing_pepper(db):
    dto = PlantCreate(
        PlantCode="PLANT-002",
        PepperId=999,
        IsActive=True,
    )

    result, error = create_plant(db, dto)

    assert result is None
    assert error == "Selected pepper variety does not exist."


def test_create_plant_duplicate_code(db):
    dto1 = PlantCreate(PlantCode="PLANT-003", PepperId=1, IsActive=True)
    dto2 = PlantCreate(PlantCode="PLANT-003", PepperId=1, IsActive=True)

    create_plant(db, dto1)
    result, error = create_plant(db, dto2)

    assert result is None
    assert error == "Plant with code 'PLANT-003' already exists."


def test_create_plant_invalid_zone(db):
    dto = PlantCreate(
        PlantCode="PLANT-004",
        PepperId=1,
        ZoneId=999,
        IsActive=True,
    )

    result, error = create_plant(db, dto)

    assert result is None
    assert error == "Selected farm zone does not exist."


# ── Update-location: valid transfers ─────────────────────────────────────────

def test_update_plant_location_to_growing_greenhouse(db):
    """Transfer from Nursery to a growing greenhouse succeeds."""
    plant, _ = create_plant(db, PlantCreate(PlantCode="PLANT-010", PepperId=1, ZoneId=1, IsActive=True))
    assert plant is not None

    updated, error = update_plant_location(db, plant.PlantId, 2)  # GH-01

    assert error is None
    assert updated is not None
    assert updated.ZoneId == 2


def test_update_plant_location_to_visitor_greenhouse(db):
    """Transfer from Nursery to a visitor greenhouse succeeds."""
    plant, _ = create_plant(db, PlantCreate(PlantCode="PLANT-011", PepperId=1, ZoneId=1, IsActive=True))
    assert plant is not None

    updated, error = update_plant_location(db, plant.PlantId, 3)  # GERM-01

    assert error is None
    assert updated is not None
    assert updated.ZoneId == 3


def test_update_plant_location_set_none(db):
    """Clearing the zone (unplanting) is always allowed."""
    plant, _ = create_plant(db, PlantCreate(PlantCode="PLANT-012", PepperId=1, ZoneId=1, IsActive=True))
    assert plant is not None

    updated, error = update_plant_location(db, plant.PlantId, None)

    assert error is None
    assert updated is not None
    assert updated.ZoneId is None


# ── Update-location: invalid transfer targets ─────────────────────────────────

def test_update_plant_location_to_production_facility_fails(db):
    """Transfer to the production facility is rejected."""
    plant, _ = create_plant(db, PlantCreate(PlantCode="PLANT-020", PepperId=1, ZoneId=1, IsActive=True))
    assert plant is not None

    updated, error = update_plant_location(db, plant.PlantId, 4)  # FACTORY

    assert updated is None
    assert error == _ERR_NOT_GREENHOUSE


def test_update_plant_location_to_main_shed_fails(db):
    """Transfer to the main shed / parking is rejected."""
    plant, _ = create_plant(db, PlantCreate(PlantCode="PLANT-021", PepperId=1, ZoneId=1, IsActive=True))
    assert plant is not None

    updated, error = update_plant_location(db, plant.PlantId, 5)  # SHED-MAIN

    assert updated is None
    assert error == _ERR_NOT_GREENHOUSE


def test_update_plant_location_back_to_nursery_fails(db):
    """A plant already in a greenhouse cannot be transferred back to the Nursery."""
    plant, _ = create_plant(db, PlantCreate(PlantCode="PLANT-022", PepperId=1, ZoneId=1, IsActive=True))
    assert plant is not None

    # Move to greenhouse first
    plant, _ = update_plant_location(db, plant.PlantId, 2)
    assert plant is not None

    # Now try to move back to Nursery
    updated, error = update_plant_location(db, plant.PlantId, 1)  # NURSERY

    assert updated is None
    assert error == _ERR_NOT_GREENHOUSE


# ── Update-location: other error paths ───────────────────────────────────────

def test_update_plant_location_plant_not_found(db):
    updated_plant, error = update_plant_location(db, 999, 1)

    assert updated_plant is None
    assert error == "Plant not found."


def test_update_plant_location_zone_not_found(db):
    plant, _ = create_plant(db, PlantCreate(PlantCode="PLANT-030", PepperId=1, ZoneId=1, IsActive=True))
    assert plant is not None

    updated_plant, error = update_plant_location(db, plant.PlantId, 999)

    assert updated_plant is None
    assert error == "Selected farm zone does not exist."
