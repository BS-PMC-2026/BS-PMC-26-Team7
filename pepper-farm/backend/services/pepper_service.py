from sqlalchemy.orm import Session
from models.pepper_edit_log import PepperEditLog
from models.pepper_variety import PepperVariety
from schemas.pepper import PepperCreate, PepperUpdate


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
        OptimalPARMin=pepper_data.OptimalPARMin,
        OptimalPARMax=pepper_data.OptimalPARMax,
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
    return db.query(PepperVariety).filter(PepperVariety.IsActive == True).order_by(PepperVariety.PepperName.asc()).all()


def get_pepper_by_id(db: Session, pepper_id: int) -> PepperVariety | None:
    return db.query(PepperVariety).filter(PepperVariety.PepperId == pepper_id).first()


def update_pepper(db: Session, pepper_id: int, data: PepperUpdate) -> PepperVariety | None:
    pepper = get_pepper_by_id(db, pepper_id)
    if pepper is None:
        return None

    update_fields = data.model_dump(exclude_unset=True)
    for field, value in update_fields.items():
        setattr(pepper, field, value)

   # if update_fields:
    #    db.add(
     #       PepperEditLog(
      #          PepperId=pepper_id,
       #         ChangedFields=",".join(update_fields.keys()),
        #    )
        #)

    db.commit()
    db.refresh(pepper)
    return pepper


def delete_pepper(db: Session, pepper_id: int) -> PepperVariety | None:
    pepper = get_pepper_by_id(db, pepper_id)

    if pepper is None:
        return None

    pepper.IsActive = False

    db.add(pepper)
    db.commit()
    db.refresh(pepper)

    return pepper
