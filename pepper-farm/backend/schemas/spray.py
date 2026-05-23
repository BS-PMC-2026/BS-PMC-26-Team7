from datetime import datetime
from typing import Optional, Literal
from pydantic import BaseModel, Field


# -----------------------------------------------------------------------------
# Pesticide responses (worker form needs these to populate the dropdown)
# -----------------------------------------------------------------------------
class PesticideResponse(BaseModel):
    PesticideId: int
    Name: str
    ActiveIngredient: Optional[str] = None
    Manufacturer: Optional[str] = None
    TargetPest: Optional[str] = None
    PreHarvestIntervalDays: Optional[int] = None
    ReEntryIntervalHours: Optional[int] = None
    PpeRequired: Optional[str] = None
    HazardLevel: Optional[str] = None
    VerificationStatus: str

    class Config:
        from_attributes = True


# -----------------------------------------------------------------------------
# Spray report submission (BSPMT7-334)
# -----------------------------------------------------------------------------
class CreateSprayReportRequest(BaseModel):
    """Body for POST /api/spray-reports.

    `reportType` controls which time field is required:
      - 'completed' -> the spray already happened, server stamps CompletedAtUtc
      - 'planned'   -> the worker is planning ahead, plannedAtUtc is required
    """
    zoneId: int = Field(..., gt=0)
    pesticideId: int = Field(..., gt=0)
    reportType: Literal["completed", "planned"]
    plannedAtUtc: Optional[datetime] = None
    notes: Optional[str] = Field(None, max_length=1000)


class SprayReportResponse(BaseModel):
    SprayReportId: int
    ZoneId: int
    PesticideId: int
    ReportedByUserId: int
    Status: str
    PlannedAtUtc: Optional[datetime] = None
    CompletedAtUtc: Optional[datetime] = None
    Notes: Optional[str] = None
    RequiresApproval: bool
    CreatedAt: datetime

    class Config:
        from_attributes = True


# -----------------------------------------------------------------------------
# Safety warning (BSPMT7-333)
# Returned together with the saved report so the form can display the warning
# block. When VerificationStatus is 'unverified' the date fields are None and
# `requiresApproval` is True - the frontend then shows the "consult the
# official label" block instead of computed dates.
# -----------------------------------------------------------------------------
class SafetyWarningResponse(BaseModel):
    pesticideName: str
    verificationStatus: str
    requiresApproval: bool
    safeToReEnterAtUtc: Optional[datetime] = None
    safeToHarvestAtUtc: Optional[datetime] = None
    ppeRequired: Optional[str] = None
    hazardLevel: Optional[str] = None
    message: str


class SprayReportSubmissionResponse(BaseModel):
    report: SprayReportResponse
    safetyWarning: SafetyWarningResponse


# -----------------------------------------------------------------------------
# Spray map (BSPMT7-234 US28)
# One entry per active zone, summarising the most recent spray event and the
# computed safety state so the manager can see the farm at a glance.
# -----------------------------------------------------------------------------
# -----------------------------------------------------------------------------
# Spray alert (US30)
# One entry per spray report — created when a worker submits a spray report.
# Manager-only; returned by GET /api/spray-reports/alerts.
# -----------------------------------------------------------------------------
class SprayAlertResponse(BaseModel):
    SprayAlertId: int
    SprayReportId: int
    ZoneId: int
    ZoneCode: str
    ZoneName: str
    PesticideName: Optional[str] = None
    ReportedByUserId: Optional[int] = None
    ReportStatus: str
    Severity: str
    SafetyMessage: str
    RequiresApproval: bool
    ReEntryIntervalHours: Optional[int] = None
    SafeToReEnterAtUtc: Optional[datetime] = None
    SafeToHarvestAtUtc: Optional[datetime] = None
    HazardLevel: Optional[str] = None
    PpeRequired: Optional[str] = None
    SprayedAtUtc: Optional[datetime] = None
    IsRead: bool
    CreatedAt: datetime

    class Config:
        from_attributes = True


# -----------------------------------------------------------------------------
# Spray map (BSPMT7-234 US28)
# One entry per active zone, summarising the most recent spray event and the
# computed safety state so the manager can see the farm at a glance.
# -----------------------------------------------------------------------------
class ZoneSprayStatusResponse(BaseModel):
    """Per-zone spray status returned by GET /api/spray-reports/zone-map.

    US33 adds explicit entry permission fields derived from the spray status so
    consumers do not need to re-implement the REI/safety logic themselves.
    """
    zoneId: int
    zoneCode: str
    zoneName: str
    # safe | unsafe | requires_approval | pending | never_sprayed
    sprayStatus: str
    lastCompletedAtUtc: Optional[datetime] = None
    pesticideName: Optional[str] = None
    safeToReEnterAtUtc: Optional[datetime] = None
    safeToHarvestAtUtc: Optional[datetime] = None
    requiresApproval: bool = False
    hazardLevel: Optional[str] = None
    ppeRequired: Optional[str] = None
    nextPlannedAtUtc: Optional[datetime] = None

    # US33 — entry permission status (derived from sprayStatus + REI window)
    # allowed | restricted | caution | planned_warning | no_data
    entryPermissionStatus: str = "no_data"
    entryAllowed: bool = True
    entryMessage: str = "No recent spray restriction. Entry is permitted."
    remainingRestrictionMinutes: Optional[int] = None


# -----------------------------------------------------------------------------
# Overdue spray alert (US32)
# Created by periodic scheduler when a zone is overdue for spraying.
# Separate from SprayAlert (US30) which is triggered by a SprayReport.
# -----------------------------------------------------------------------------
class OverdueSprayAlertResponse(BaseModel):
    OverdueAlertId:    int
    ZoneId:            int
    ZoneCode:          str
    ZoneName:          str
    LastSprayedAtUtc:  Optional[datetime] = None
    OverdueSinceUtc:   datetime
    SprayIntervalDays: int
    Severity:          str
    Message:           str
    IsRead:            bool
    IsResolved:        bool
    ResolvedAtUtc:     Optional[datetime] = None
    AssignedTaskId:    Optional[int] = None
    CreatedAt:         datetime

    class Config:
        from_attributes = True


class AssignOverdueAlertRequest(BaseModel):
    """Body for POST /api/spray-reports/overdue-alerts/{alert_id}/assign."""
    assignedToUserId: int
    dueDate: Optional[datetime] = None