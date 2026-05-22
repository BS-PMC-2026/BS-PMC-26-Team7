from datetime import datetime, timedelta

from sqlalchemy import and_, func
from sqlalchemy.orm import Session

from models.spray import Pesticide, SprayAlert, SprayReport
from models.farm_zone import FarmZone
from schemas.spray import (
    CreateSprayReportRequest,
    SafetyWarningResponse,
    SprayAlertResponse,
    ZoneSprayStatusResponse,
)


# -----------------------------------------------------------------------------
# Pesticide catalog (BSPMT7-336)
# -----------------------------------------------------------------------------
def get_active_pesticides(db: Session) -> list[Pesticide]:
    """Return all pesticides that are still active in the catalog,
    used to populate the dropdown in the worker spray form."""
    return (
        db.query(Pesticide)
        .filter(Pesticide.IsActive == True)  # noqa: E712 - SQL Server needs == True, not is_(True)
        .order_by(Pesticide.Name.asc())
        .all()
    )


def get_pesticide_by_id(db: Session, pesticide_id: int) -> Pesticide | None:
    return (
        db.query(Pesticide)
        .filter(Pesticide.PesticideId == pesticide_id)
        .first()
    )


def get_zone_by_id(db: Session, zone_id: int) -> FarmZone | None:
    return db.query(FarmZone).filter(FarmZone.ZoneId == zone_id).first()


# -----------------------------------------------------------------------------
# Safety warning generation (BSPMT7-333)
# -----------------------------------------------------------------------------
def _build_safety_warning(
    pesticide: Pesticide,
    reference_time: datetime,
) -> SafetyWarningResponse:
    """Compute the safety warning that goes back to the worker form.

    For 'verified' pesticides we compute concrete entry/harvest dates from
    the PHI/REI values. For 'unverified' pesticides we fall back to a generic
    message that asks the worker to consult the official label (BSPMT7-333).
    """
    if pesticide.VerificationStatus == "verified":
        safe_to_re_enter = (
            reference_time + timedelta(hours=pesticide.ReEntryIntervalHours)
            if pesticide.ReEntryIntervalHours is not None
            else None
        )
        safe_to_harvest = (
            reference_time + timedelta(days=pesticide.PreHarvestIntervalDays)
            if pesticide.PreHarvestIntervalDays is not None
            else None
        )
        return SafetyWarningResponse(
            pesticideName=pesticide.Name,
            verificationStatus="verified",
            requiresApproval=False,
            safeToReEnterAtUtc=safe_to_re_enter,
            safeToHarvestAtUtc=safe_to_harvest,
            ppeRequired=pesticide.PpeRequired,
            hazardLevel=pesticide.HazardLevel,
            message=(
                "Safety data verified. "
                "Do not re-enter the area or harvest before the dates shown above."
            ),
        )

    # Unverified: agronomist has not supplied PHI/REI yet.
    return SafetyWarningResponse(
        pesticideName=pesticide.Name,
        verificationStatus="unverified",
        requiresApproval=True,
        safeToReEnterAtUtc=None,
        safeToHarvestAtUtc=None,
        ppeRequired=pesticide.PpeRequired,
        hazardLevel=pesticide.HazardLevel,
        message=(
            "Safety data for this pesticide is not yet defined in the system. "
            "Please consult the official product label before harvesting or "
            "re-entering the sprayed area."
        ),
    )


# -----------------------------------------------------------------------------
# Submit a spray report (BSPMT7-334)
# -----------------------------------------------------------------------------
def create_spray_report(
    db: Session,
    user_id: int,
    data: CreateSprayReportRequest,
) -> tuple[tuple[SprayReport, SafetyWarningResponse] | None, str | None]:
    """Validate the request, persist the spray report, and return it together
    with the generated safety warning."""

    # Validate the zone exists.
    zone = get_zone_by_id(db, data.zoneId)
    if zone is None:
        return None, "Zone not found."
    if not zone.IsActive:
        return None, "Zone is not active."

    # Validate the pesticide exists and is active.
    pesticide = get_pesticide_by_id(db, data.pesticideId)
    if pesticide is None:
        return None, "Pesticide not found."
    if not pesticide.IsActive:
        return None, "Pesticide is not active."

    # 'planned' reports must come with a future plannedAtUtc.
    now = datetime.utcnow()
    if data.reportType == "planned":
        if data.plannedAtUtc is None:
            return None, "plannedAtUtc is required for planned reports."

        # Strip tzinfo so the comparison works against a naive utcnow().
        planned_naive = (
            data.plannedAtUtc.replace(tzinfo=None)
            if data.plannedAtUtc.tzinfo is not None
            else data.plannedAtUtc
        )
        if planned_naive <= now:
            return None, "plannedAtUtc must be in the future."

        report = SprayReport(
            ZoneId=data.zoneId,
            PesticideId=data.pesticideId,
            ReportedByUserId=user_id,
            Status="planned",
            PlannedAtUtc=planned_naive,
            CompletedAtUtc=None,
            Notes=data.notes,
            RequiresApproval=(pesticide.VerificationStatus == "unverified"),
        )
        warning_reference_time = planned_naive
    else:
        # 'completed' - server stamps the time so the worker cannot back-date.
        report = SprayReport(
            ZoneId=data.zoneId,
            PesticideId=data.pesticideId,
            ReportedByUserId=user_id,
            Status="completed",
            PlannedAtUtc=None,
            CompletedAtUtc=now,
            Notes=data.notes,
            RequiresApproval=(pesticide.VerificationStatus == "unverified"),
        )
        warning_reference_time = now

    db.add(report)
    db.commit()
    db.refresh(report)

    safety_warning = _build_safety_warning(pesticide, warning_reference_time)

    # US30: generate a manager spray alert for every submitted report.
    # Best-effort: if SprayAlerts table is missing in production (DDL not yet run)
    # the spray report is already committed above and must still be returned to the worker.
    try:
        _generate_spray_alert(db, report, pesticide, zone, safety_warning)
    except Exception:
        pass

    return (report, safety_warning), None


# -----------------------------------------------------------------------------
# Spray alert generation (US30)
# -----------------------------------------------------------------------------
def _compute_severity(
    pesticide: Pesticide,
    report: SprayReport,
) -> str:
    """Return alert severity based on US29 safety rules.

    'high'   — pesticide is unverified (unknown REI/PHI, requires approval)
    'medium' — completed spray, within the active REI window
    'low'    — planned report or completed spray whose REI has passed
    """
    if pesticide.VerificationStatus == "unverified":
        return "high"
    if report.Status == "completed" and report.CompletedAtUtc and pesticide.ReEntryIntervalHours:
        rei_end = report.CompletedAtUtc + timedelta(hours=pesticide.ReEntryIntervalHours)
        if datetime.utcnow() < rei_end:
            return "medium"
    return "low"


def _generate_spray_alert(
    db: Session,
    report: SprayReport,
    pesticide: Pesticide,
    zone: FarmZone,
    safety_warning: SafetyWarningResponse,
) -> SprayAlert:
    """Persist a SprayAlert row after every spray report submission (US30)."""
    severity = _compute_severity(pesticide, report)
    alert = SprayAlert(
        SprayReportId=report.SprayReportId,
        ZoneId=zone.ZoneId,
        ZoneCode=zone.ZoneCode,
        ZoneName=zone.ZoneName,
        PesticideName=pesticide.Name,
        ReportedByUserId=report.ReportedByUserId,
        ReportStatus=report.Status,
        Severity=severity,
        SafetyMessage=safety_warning.message,
        RequiresApproval=safety_warning.requiresApproval,
        ReEntryIntervalHours=pesticide.ReEntryIntervalHours,
        SafeToReEnterAtUtc=safety_warning.safeToReEnterAtUtc,
        SafeToHarvestAtUtc=safety_warning.safeToHarvestAtUtc,
        HazardLevel=pesticide.HazardLevel,
        PpeRequired=pesticide.PpeRequired,
        SprayedAtUtc=report.CompletedAtUtc or report.PlannedAtUtc,
        IsRead=False,
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return alert


# -----------------------------------------------------------------------------
# Spray alert queries (US30)
# -----------------------------------------------------------------------------
def get_spray_alerts(db: Session) -> list[SprayAlert]:
    """Return all spray alerts, newest first (manager-only)."""
    return (
        db.query(SprayAlert)
        .order_by(SprayAlert.CreatedAt.desc())
        .all()
    )


def get_spray_alert_by_id(db: Session, alert_id: int) -> SprayAlert | None:
    return db.query(SprayAlert).filter(SprayAlert.SprayAlertId == alert_id).first()


def mark_spray_alert_read(db: Session, alert_id: int) -> SprayAlert | None:
    alert = get_spray_alert_by_id(db, alert_id)
    if alert is None:
        return None
    if not alert.IsRead:
        alert.IsRead = True
        db.commit()
        db.refresh(alert)
    return alert


# -----------------------------------------------------------------------------
# Spray map data (BSPMT7-234 US28)
# -----------------------------------------------------------------------------
def get_zone_spray_map(db: Session) -> list[ZoneSprayStatusResponse]:
    """Return one ZoneSprayStatusResponse per active zone.

    Status semantics:
      never_sprayed     – no completed spray report exists for this zone
      pending           – no completed report, but a future planned one exists
      requires_approval – most-recent completed used an unverified pesticide
      unsafe            – within the re-entry interval (REI) of the last spray
      safe              – REI has passed since the last completed spray
    """
    now = datetime.utcnow()

    # 1. All active zones.
    zones = (
        db.query(FarmZone)
        .filter(FarmZone.IsActive == True)  # noqa: E712
        .order_by(FarmZone.ZoneCode)
        .all()
    )

    # 2. Latest completed SprayReport per zone (by max CompletedAtUtc).
    latest_completed_sub = (
        db.query(
            SprayReport.ZoneId,
            func.max(SprayReport.CompletedAtUtc).label("max_completed"),
        )
        .filter(SprayReport.Status == "completed")
        .group_by(SprayReport.ZoneId)
        .subquery()
    )
    completed_rows = (
        db.query(SprayReport, Pesticide)
        .join(
            latest_completed_sub,
            and_(
                SprayReport.ZoneId == latest_completed_sub.c.ZoneId,
                SprayReport.CompletedAtUtc == latest_completed_sub.c.max_completed,
            ),
        )
        .join(Pesticide, SprayReport.PesticideId == Pesticide.PesticideId)
        .all()
    )
    completed_by_zone: dict[int, tuple[SprayReport, Pesticide]] = {
        report.ZoneId: (report, pesticide) for report, pesticide in completed_rows
    }

    # 3. Earliest future planned SprayReport per zone.
    earliest_planned_sub = (
        db.query(
            SprayReport.ZoneId,
            func.min(SprayReport.PlannedAtUtc).label("min_planned"),
        )
        .filter(
            SprayReport.Status == "planned",
            SprayReport.PlannedAtUtc > now,
        )
        .group_by(SprayReport.ZoneId)
        .subquery()
    )
    planned_rows = db.query(earliest_planned_sub).all()
    planned_by_zone: dict[int, datetime] = {
        row.ZoneId: row.min_planned for row in planned_rows
    }

    # 4. Build per-zone response.
    results: list[ZoneSprayStatusResponse] = []
    for zone in zones:
        zid = zone.ZoneId
        planned_at = planned_by_zone.get(zid)

        if zid not in completed_by_zone:
            status = "pending" if planned_at else "never_sprayed"
            results.append(
                ZoneSprayStatusResponse(
                    zoneId=zid,
                    zoneCode=zone.ZoneCode,
                    zoneName=zone.ZoneName,
                    sprayStatus=status,
                    nextPlannedAtUtc=planned_at,
                )
            )
            continue

        report, pesticide = completed_by_zone[zid]
        requires_approval = pesticide.VerificationStatus != "verified"

        if requires_approval:
            status = "requires_approval"
            safe_re_enter = None
            safe_harvest = None
        else:
            safe_re_enter = (
                report.CompletedAtUtc + timedelta(hours=pesticide.ReEntryIntervalHours)
                if pesticide.ReEntryIntervalHours is not None
                else None
            )
            safe_harvest = (
                report.CompletedAtUtc + timedelta(days=pesticide.PreHarvestIntervalDays)
                if pesticide.PreHarvestIntervalDays is not None
                else None
            )
            if safe_re_enter is not None and now < safe_re_enter:
                status = "unsafe"
            else:
                status = "safe"

        results.append(
            ZoneSprayStatusResponse(
                zoneId=zid,
                zoneCode=zone.ZoneCode,
                zoneName=zone.ZoneName,
                sprayStatus=status,
                lastCompletedAtUtc=report.CompletedAtUtc,
                pesticideName=pesticide.Name,
                safeToReEnterAtUtc=safe_re_enter,
                safeToHarvestAtUtc=safe_harvest,
                requiresApproval=requires_approval,
                hazardLevel=pesticide.HazardLevel,
                ppeRequired=pesticide.PpeRequired,
                nextPlannedAtUtc=planned_at,
            )
        )

    return results