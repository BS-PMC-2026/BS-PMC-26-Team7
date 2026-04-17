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
from services.plant_service import create_plant , update_plant_location

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

    session.add(
        FarmZone(
            ZoneId=1,
            ZoneName="Zone A",
            IsActive=True,
            CreatedAt=now,
        )
    )

    session.commit()
    yield session
    session.close()
    Base.metadata.drop_all(bind=engine)


def test_create_plant_valid(db):
    dto = PlantCreate(
        PlantCode="PLANT-001",
        PepperId=1,
        ZoneId=1,
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
    dto1 = PlantCreate(
        PlantCode="PLANT-003",
        PepperId=1,
        IsActive=True,
    )
    dto2 = PlantCreate(
        PlantCode="PLANT-003",
        PepperId=1,
        IsActive=True,
    )

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


def test_update_plant_location_valid(db):
    dto = PlantCreate(
        PlantCode="PLANT-010",
        PepperId=1,
        ZoneId=1,
        Status="Healthy",
        Notes="Before update",
        IsActive=True,
    )

    plant, error = create_plant(db, dto)
    assert error is None
    assert plant is not None

    # add another zone for update
    now = datetime.now(timezone.utc)
    db.add(
        FarmZone(
            ZoneId=2,
            ZoneName="Zone B",
            IsActive=True,
            CreatedAt=now,
        )
    )
    db.commit()

    updated_plant, error = update_plant_location(db, plant.PlantId, 2)

    assert error is None
    assert updated_plant is not None
    assert updated_plant.ZoneId == 2


def test_update_plant_location_plant_not_found(db):
    updated_plant, error = update_plant_location(db, 999, 1)

    assert updated_plant is None
    assert error == "Plant not found."


def test_update_plant_location_zone_not_found(db):
    dto = PlantCreate(
        PlantCode="PLANT-011",
        PepperId=1,
        ZoneId=1,
        IsActive=True,
    )

    plant, error = create_plant(db, dto)
    assert error is None
    assert plant is not None

    updated_plant, error = update_plant_location(db, plant.PlantId, 999)

    assert updated_plant is None
    assert error == "Selected farm zone does not exist."


def test_update_plant_location_set_none(db):
    dto = PlantCreate(
        PlantCode="PLANT-012",
        PepperId=1,
        ZoneId=1,
        IsActive=True,
    )

    plant, error = create_plant(db, dto)
    assert error is None
    assert plant is not None

    updated_plant, error = update_plant_location(db, plant.PlantId, None)

    assert error is None
    assert updated_plant is not None
    assert updated_plant.ZoneId is None