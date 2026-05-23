from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from schemas.spray import (
    AssignOverdueAlertRequest,
    CreateSprayReportRequest,
    OverdueSprayAlertResponse,
    PesticideResponse,
    SprayAlertResponse,
    SprayReportResponse,
    SprayReportSubmissionResponse,
    ZoneSprayStatusResponse,
)
from schemas.task import TaskResponse
from services.spray_service import (
    assign_overdue_spray_task,
    create_spray_report,
    get_active_pesticides,
    get_active_overdue_spray_alerts,
    get_overdue_spray_alert_by_id,
    get_overdue_spray_alerts,
    get_spray_alert_by_id,
    get_spray_alerts,
    get_zone_spray_map,
    mark_overdue_spray_alert_read,
    mark_spray_alert_read,
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


# ---------------------------------------------------------------------------
# US30 — Manager spray alert endpoints (FarmManager only)
# ---------------------------------------------------------------------------

@router.get("/alerts", response_model=list[SprayAlertResponse])
def list_spray_alerts_endpoint(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("FarmManager")),
):
    """US30: Return all spray alerts for the manager, newest first."""
    return get_spray_alerts(db)


@router.patch("/alerts/{alert_id}/read", response_model=SprayAlertResponse)
def mark_spray_alert_read_endpoint(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("FarmManager")),
):
    """US30: Mark a spray alert as read/acknowledged."""
    alert = mark_spray_alert_read(db, alert_id)
    if alert is None:
        raise HTTPException(status_code=404, detail="Spray alert not found.")
    return alert


@router.get("/alerts/{alert_id}", response_model=SprayAlertResponse)
def get_spray_alert_endpoint(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("FarmManager")),
):
    """US30: Return a single spray alert by ID."""
    alert = get_spray_alert_by_id(db, alert_id)
    if alert is None:
        raise HTTPException(status_code=404, detail="Spray alert not found.")
    return alert


@router.get("/restricted-zones", response_model=list[ZoneSprayStatusResponse])
def zone_restriction_map_endpoint(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_any_role("FarmManager", "Worker", "Visitor")),
):
    """US31: Return spray restriction status for every active zone.
    Accessible to all authenticated roles (FarmManager, Worker, Visitor).
    Workers use this; unauthenticated public visitors use /public-restricted-zones."""
    return get_zone_spray_map(db)


@router.get("/public-restricted-zones", response_model=list[ZoneSprayStatusResponse])
def public_zone_restriction_map_endpoint(
    db: Session = Depends(get_db),
):
    """US31: Public (unauthenticated) spray restriction map.
    Returns the same sanitized safety data as /restricted-zones but requires no JWT.
    Used by the visitor/public safety map page."""
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


# ---------------------------------------------------------------------------
# US32 — Overdue spray alert endpoints (FarmManager only)
# ---------------------------------------------------------------------------

@router.get("/overdue-alerts", response_model=list[OverdueSprayAlertResponse])
def list_overdue_spray_alerts_endpoint(
    active_only: bool = False,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("FarmManager")),
):
    """US32: Return overdue spray alerts for the manager.

    Pass ?active_only=true to get only unresolved alerts.
    Default returns all alerts (active + resolved), newest first.
    """
    if active_only:
        return get_active_overdue_spray_alerts(db)
    return get_overdue_spray_alerts(db)


@router.patch(
    "/overdue-alerts/{alert_id}/read",
    response_model=OverdueSprayAlertResponse,
)
def mark_overdue_alert_read_endpoint(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("FarmManager")),
):
    """US32: Mark an overdue spray alert as read/acknowledged."""
    alert = mark_overdue_spray_alert_read(db, alert_id)
    if alert is None:
        raise HTTPException(status_code=404, detail="Overdue spray alert not found.")
    return alert


@router.post(
    "/overdue-alerts/{alert_id}/assign",
    response_model=TaskResponse,
    status_code=201,
)
def assign_overdue_alert_task_endpoint(
    alert_id: int,
    data: AssignOverdueAlertRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("FarmManager")),
):
    """US32: Create a spray task assigned to a worker from an overdue alert.

    Idempotent: returns the existing task if one was already assigned.
    """
    from schemas.task import TaskResponse as _TaskResponse
    from services.task_service import _to_response

    task, error = assign_overdue_spray_task(
        db, alert_id, current_user["user_id"], data
    )
    if error:
        status_code = 404 if "not found" in error.lower() else 400
        raise HTTPException(status_code=status_code, detail=error)

    return _to_response(task)


@router.post("/overdue-check/run", status_code=200)
def run_overdue_check_endpoint(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("FarmManager")),
):
    """US32: Manually trigger the overdue spray zone check (manager only).

    Useful for testing and immediate checks between scheduled runs.
    """
    from services.overdue_spray_check_service import check_overdue_spray_zones

    created = check_overdue_spray_zones(db)
    return {"alertsCreated": created}