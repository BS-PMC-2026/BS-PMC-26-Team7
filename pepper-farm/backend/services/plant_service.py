from sqlalchemy.orm import Session
from models.plant import Plant
from models.pepper_variety import PepperVariety
from models.farm_zone import FarmZone
from schemas.plant import PlantCreate


def create_plant(db: Session, plant_data: PlantCreate) -> tuple[Plant | None, str | None]:
    existing_pepper = (
        db.query(PepperVariety)
        .filter(PepperVariety.PepperId == plant_data.PepperId)
        .first()
    )
    if not existing_pepper:
        return None, "Selected pepper variety does not exist."

    if plant_data.ZoneId is not None:
        existing_zone = (
            db.query(FarmZone)
            .filter(FarmZone.ZoneId == plant_data.ZoneId)
            .first()
        )
        if not existing_zone:
            return None, "Selected farm zone does not exist."

    existing_plant_code = (
        db.query(Plant)
        .filter(Plant.PlantCode == plant_data.PlantCode)
        .first()
    )
    if existing_plant_code:
        return None, f"Plant with code '{plant_data.PlantCode}' already exists."

    plant = Plant(
        PlantCode=plant_data.PlantCode,
        PepperId=plant_data.PepperId,
        ZoneId=plant_data.ZoneId,
        PlantedAt=plant_data.PlantedAt,
        Status=plant_data.Status,
        Notes=plant_data.Notes,
        IsActive=plant_data.IsActive,
    )

    db.add(plant)
    db.commit()
    db.refresh(plant)
    return plant, None

def update_plant_location(
    db: Session, plant_id: int, zone_id: int | None
) -> tuple[Plant | None, str | None]:
    plant = db.query(Plant).filter(Plant.PlantId == plant_id).first()
    if not plant:
        return None, "Plant not found."

    if zone_id is not None:
        existing_zone = db.query(FarmZone).filter(FarmZone.ZoneId == zone_id).first()
        if not existing_zone:
            return None, "Selected farm zone does not exist."

    plant.ZoneId = zone_id
    db.commit()
    db.refresh(plant)
    return plant, None


def get_all_plants(db: Session) -> list[Plant]:
    return db.query(Plant).order_by(Plant.PlantCode.asc()).all()


def get_plant_by_id(db: Session, plant_id: int) -> Plant | None:
    return db.query(Plant).filter(Plant.PlantId == plant_id).first()


def update_plant_status(
    db: Session, plant_id: int, status: str | None
) -> tuple[Plant | None, str | None]:
    plant = db.query(Plant).filter(Plant.PlantId == plant_id).first()
    if not plant:
        return None, "Plant not found."
    plant.Status = status
    db.commit()
    db.refresh(plant)
    return plant, None