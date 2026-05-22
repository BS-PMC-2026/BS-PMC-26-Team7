from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    DateTime,
    ForeignKey,
)
from sqlalchemy.sql import func
from database import Base


class Pesticide(Base):
    __tablename__ = "Pesticides"

    PesticideId = Column(Integer, primary_key=True, autoincrement=True)
    Name = Column(String(100), nullable=False, unique=True)
    ActiveIngredient = Column(String(100), nullable=True)
    Manufacturer = Column(String(100), nullable=True)
    TargetPest = Column(String(200), nullable=True)

    PreHarvestIntervalDays = Column(Integer, nullable=True)
    ReEntryIntervalHours = Column(Integer, nullable=True)
    PpeRequired = Column(String(200), nullable=True)
    HazardLevel = Column(String(50), nullable=True)

    VerificationStatus = Column(String(20), nullable=False, default="unverified")
    IsActive = Column(Boolean, nullable=False, default=True)
    CreatedAt = Column(DateTime, nullable=False, server_default=func.sysutcdatetime())


class SprayReport(Base):
    __tablename__ = "SprayReports"

    SprayReportId = Column(Integer, primary_key=True, autoincrement=True)

    ZoneId = Column(Integer, ForeignKey("FarmZones.ZoneId"), nullable=False)
    PesticideId = Column(Integer, ForeignKey("Pesticides.PesticideId"), nullable=False)
    ReportedByUserId = Column(Integer, ForeignKey("Users.UserId"), nullable=False)

    Status = Column(String(20), nullable=False, default="completed")
    PlannedAtUtc = Column(DateTime, nullable=True)
    CompletedAtUtc = Column(DateTime, nullable=True)
    Notes = Column(String(1000), nullable=True)

    RequiresApproval = Column(Boolean, nullable=False, default=False)
    CreatedAt = Column(DateTime, nullable=False, server_default=func.sysutcdatetime())


class SprayAlert(Base):
    """US30: Manager-facing alert created whenever a spray report is submitted.

    Stores a snapshot of the key safety data so the manager can review alerts
    even if the underlying report or pesticide is later changed.
    Severity: 'high' (unverified pesticide), 'medium' (within REI), 'low' (informational).
    """
    __tablename__ = "SprayAlerts"

    SprayAlertId = Column(Integer, primary_key=True, autoincrement=True)
    SprayReportId = Column(Integer, ForeignKey("SprayReports.SprayReportId"), nullable=False)

    ZoneId = Column(Integer, ForeignKey("FarmZones.ZoneId"), nullable=False)
    ZoneCode = Column(String(50), nullable=False)
    ZoneName = Column(String(100), nullable=False)

    PesticideName = Column(String(100), nullable=True)
    ReportedByUserId = Column(Integer, ForeignKey("Users.UserId"), nullable=True)

    ReportStatus = Column(String(20), nullable=False)          # 'completed' | 'planned'
    Severity = Column(String(20), nullable=False, default="low")  # 'high' | 'medium' | 'low'
    SafetyMessage = Column(String(500), nullable=False)
    RequiresApproval = Column(Boolean, nullable=False, default=False)

    ReEntryIntervalHours = Column(Integer, nullable=True)
    SafeToReEnterAtUtc = Column(DateTime, nullable=True)
    SafeToHarvestAtUtc = Column(DateTime, nullable=True)
    HazardLevel = Column(String(50), nullable=True)
    PpeRequired = Column(String(200), nullable=True)
    SprayedAtUtc = Column(DateTime, nullable=True)    # CompletedAtUtc or PlannedAtUtc

    IsRead = Column(Boolean, nullable=False, default=False)
    CreatedAt = Column(DateTime, nullable=False, server_default=func.sysutcdatetime())