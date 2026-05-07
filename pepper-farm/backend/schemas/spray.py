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