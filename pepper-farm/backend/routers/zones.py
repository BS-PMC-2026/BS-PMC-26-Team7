from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models.farm_zone import FarmZone
from models.pepper_variety import PepperVariety

router = APIRouter(prefix="/api/zones", tags=["Zones"])


@router.get("")
def list_zones(db: Session = Depends(get_db)):
    zones = db.query(FarmZone).filter(FarmZone.IsActive == True).order_by(FarmZone.ZoneCode).all()
    return [
        {"ZoneId": z.ZoneId, "ZoneCode": z.ZoneCode, "ZoneName": z.ZoneName, "ZoneType": z.ZoneType}
        for z in zones
    ]


@router.get("/{zone_code}")
def get_zone_by_code(zone_code: str, db: Session = Depends(get_db)):
    zone = db.query(FarmZone).filter(FarmZone.ZoneCode == zone_code).first()
    if not zone:
        raise HTTPException(status_code=404, detail=f"Zone '{zone_code}' not found.")

    pepper = None
    if zone.PepperId:
        pepper = db.query(PepperVariety).filter(PepperVariety.PepperId == zone.PepperId).first()

    return {
        "ZoneId": zone.ZoneId,
        "ZoneName": zone.ZoneName,
        "ZoneCode": zone.ZoneCode,
        "ZoneType": zone.ZoneType,
        "AreaSquareMeters": float(zone.AreaSquareMeters) if zone.AreaSquareMeters else None,
        "Description": zone.Description,
        "SoilType": zone.SoilType,
        "IrrigationMethod": zone.IrrigationMethod,
        "Notes": zone.Notes,
        "pepper": {
            "PepperId": pepper.PepperId,
            "PepperName": pepper.PepperName,
            "ScientificName": pepper.ScientificName,
            "HeatLevelScovilleMin": pepper.HeatLevelScovilleMin,
            "HeatLevelScovilleMax": pepper.HeatLevelScovilleMax,
            "GeneralDescription": pepper.GeneralDescription,
            "ImageUrl": pepper.ImageUrl,
        } if pepper else None,
    }
