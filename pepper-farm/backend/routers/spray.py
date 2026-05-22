from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from schemas.spray import (
    CreateSprayReportRequest,
    PesticideResponse,
    SprayReportResponse,
    SprayReportSubmissionResponse,
    ZoneSprayStatusResponse,
)
from services.spray_service import (
    create_spray_report,
    get_active_pesticides,
    get_zone_spray_map,
)
from utils.jwt import get_current_user, require_any_role, require_role


router = APIRouter(prefix="/api/spray-reports", tags=["spray-reports"])


@router.get("/zone-map", response_model=list[ZoneSprayStatusResponse])
def zone_spray_map_endpoint(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("FarmManager")),
):
    """BSPMT7-234 US28: Return spray status for every active zone so the
    manager can see the farm at a glance (safe / unsafe / pending / etc.)."""
    return get_zone_spray_map(db)


@router.get("/pesticides", response_model=list[PesticideResponse])
def list_pesticides_endpoint(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """BSPMT7-336: Return all active pesticides for the worker dropdown."""
    return get_active_pesticides(db)


@router.post(
    "",
    response_model=SprayReportSubmissionResponse,
    status_code=201,
)
def create_spray_report_endpoint(
    data: CreateSprayReportRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_any_role("Worker", "FarmManager")),
):
    """BSPMT7-334 + BSPMT7-333: Save the spray report and return the
    generated safety warning so the form can display it."""
    result, error = create_spray_report(db, current_user["user_id"], data)
    if error:
        raise HTTPException(status_code=400, detail=error)

    report, safety_warning = result
    return SprayReportSubmissionResponse(
        report=SprayReportResponse.model_validate(report),
        safetyWarning=safety_warning,
    )