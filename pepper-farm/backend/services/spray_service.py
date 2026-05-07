from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from models.spray import Pesticide, SprayReport
from models.farm_zone import FarmZone
from schemas.spray import (
    CreateSprayReportRequest,
    SafetyWarningResponse,
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
    return (report, safety_warning), None