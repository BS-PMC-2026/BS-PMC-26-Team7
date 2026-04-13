from sqlalchemy.orm import Session
from models.pepper_variety import PepperVariety
from schemas.pepper import PepperCreate


def create_pepper(db: Session, pepper_data: PepperCreate) -> PepperVariety:
    pepper = PepperVariety(
        PepperName=pepper_data.PepperName,
        ScientificName=pepper_data.ScientificName,
        HeatLevelScovilleMin=pepper_data.HeatLevelScovilleMin,
        HeatLevelScovilleMax=pepper_data.HeatLevelScovilleMax,
        OptimalSoilMoistureMin=pepper_data.OptimalSoilMoistureMin,
        OptimalSoilMoistureMax=pepper_data.OptimalSoilMoistureMax,
        OptimalTempMinC=pepper_data.OptimalTempMinC,
        OptimalTempMaxC=pepper_data.OptimalTempMaxC,
        OptimalSunlightHours=pepper_data.OptimalSunlightHours,
        ImageUrl=pepper_data.ImageUrl,
        Zone=pepper_data.Zone,
        GeneralDescription=pepper_data.GeneralDescription,
        IsActive=pepper_data.IsActive,
    )

    db.add(pepper)
    db.commit()
    db.refresh(pepper)
    return pepper

def get_all_peppers(db: Session) -> list[PepperVariety]:
    return db.query(PepperVariety).order_by(PepperVariety.PepperName.asc()).all()