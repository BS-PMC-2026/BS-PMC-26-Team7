-- Table: SprayAlerts
-- Description: US30 — Manager-facing alert created automatically whenever a
--              worker submits a spray report (completed or planned).
--              Stores a snapshot of key safety data so the manager can review
--              alerts even if the underlying report or pesticide record changes.
--
-- Severity values:
--   'high'   — pesticide is unverified (unknown REI/PHI, requires approval)
--   'medium' — completed spray within the active REI window (unsafe to enter)
--   'low'    — planned report, or completed spray whose REI has already passed
--
-- Prerequisites (must already exist in [dbo]):
--   dbo.SprayReports  (SprayReportId INT PK)
--   dbo.FarmZones     (ZoneId INT PK)
--   dbo.Users         (UserId INT PK)

-- | Column               | Type           | Nullable | Default          | Notes                                                              |
-- |----------------------|----------------|----------|------------------|--------------------------------------------------------------------|
-- | SprayAlertId         | INT            | NO       | IDENTITY (auto)  | Primary Key                                                        |
-- | SprayReportId        | INT            | NO       |                  | FK -> dbo.SprayReports.SprayReportId                               |
-- | ZoneId               | INT            | NO       |                  | FK -> dbo.FarmZones.ZoneId                                         |
-- | ZoneCode             | NVARCHAR(50)   | NO       |                  | Snapshot of zone code at alert creation time                       |
-- | ZoneName             | NVARCHAR(100)  | NO       |                  | Snapshot of zone name at alert creation time                       |
-- | PesticideName        | NVARCHAR(100)  | YES      |                  | Snapshot of pesticide name                                         |
-- | ReportedByUserId     | INT            | YES      |                  | FK -> dbo.Users.UserId (worker who filed the report)               |
-- | ReportStatus         | NVARCHAR(20)   | NO       |                  | 'completed' or 'planned'                                           |
-- | Severity             | NVARCHAR(20)   | NO       | 'low'            | 'high', 'medium', or 'low'                                         |
-- | SafetyMessage        | NVARCHAR(500)  | NO       |                  | Human-readable safety message from US29 warning logic              |
-- | RequiresApproval     | BIT            | NO       | 0                | True when pesticide is unverified                                  |
-- | ReEntryIntervalHours | INT            | YES      |                  | Snapshot of pesticide REI in hours                                 |
-- | SafeToReEnterAtUtc   | DATETIME2      | YES      |                  | When re-entry is safe (null if unverified)                         |
-- | SafeToHarvestAtUtc   | DATETIME2      | YES      |                  | When harvest is safe (null if unverified)                          |
-- | HazardLevel          | NVARCHAR(50)   | YES      |                  | Snapshot of pesticide hazard level                                 |
-- | PpeRequired          | NVARCHAR(200)  | YES      |                  | Snapshot of PPE requirements                                       |
-- | SprayedAtUtc         | DATETIME2      | YES      |                  | CompletedAtUtc for completed reports, PlannedAtUtc for planned     |
-- | IsRead               | BIT            | NO       | 0                | True once manager has acknowledged the alert                       |
-- | CreatedAt            | DATETIME2      | NO       | SYSUTCDATETIME() |                                                                    |

CREATE TABLE [dbo].[SprayAlerts] (
    SprayAlertId         INT             IDENTITY(1,1) NOT NULL,
    SprayReportId        INT             NOT NULL,
    ZoneId               INT             NOT NULL,
    ZoneCode             NVARCHAR(50)    NOT NULL,
    ZoneName             NVARCHAR(100)   NOT NULL,
    PesticideName        NVARCHAR(100)   NULL,
    ReportedByUserId     INT             NULL,
    ReportStatus         NVARCHAR(20)    NOT NULL,
    Severity             NVARCHAR(20)    NOT NULL CONSTRAINT DF_SprayAlerts_Severity DEFAULT ('low'),
    SafetyMessage        NVARCHAR(500)   NOT NULL,
    RequiresApproval     BIT             NOT NULL CONSTRAINT DF_SprayAlerts_RequiresApproval DEFAULT (0),
    ReEntryIntervalHours INT             NULL,
    SafeToReEnterAtUtc   DATETIME2       NULL,
    SafeToHarvestAtUtc   DATETIME2       NULL,
    HazardLevel          NVARCHAR(50)    NULL,
    PpeRequired          NVARCHAR(200)   NULL,
    SprayedAtUtc         DATETIME2       NULL,
    IsRead               BIT             NOT NULL CONSTRAINT DF_SprayAlerts_IsRead DEFAULT (0),
    CreatedAt            DATETIME2       NOT NULL CONSTRAINT DF_SprayAlerts_CreatedAt DEFAULT (SYSUTCDATETIME()),

    CONSTRAINT PK_SprayAlerts PRIMARY KEY CLUSTERED (SprayAlertId),
    CONSTRAINT FK_SprayAlerts_SprayReport  FOREIGN KEY (SprayReportId)    REFERENCES [dbo].[SprayReports] ([SprayReportId]),
    CONSTRAINT FK_SprayAlerts_Zone         FOREIGN KEY (ZoneId)           REFERENCES [dbo].[FarmZones]    ([ZoneId]),
    CONSTRAINT FK_SprayAlerts_ReportedBy   FOREIGN KEY (ReportedByUserId) REFERENCES [dbo].[Users]        ([UserId]),
    CONSTRAINT CK_SprayAlerts_Severity     CHECK (Severity IN ('high', 'medium', 'low')),
    CONSTRAINT CK_SprayAlerts_ReportStatus CHECK (ReportStatus IN ('completed', 'planned'))
);

-- Index to support the manager alert list query (newest first).
CREATE INDEX IX_SprayAlerts_CreatedAt
    ON [dbo].[SprayAlerts] (CreatedAt DESC);

-- Index for quick lookup by report.
CREATE INDEX IX_SprayAlerts_SprayReportId
    ON [dbo].[SprayAlerts] (SprayReportId);

-- Index for unread alerts (common filter).
CREATE INDEX IX_SprayAlerts_IsRead
    ON [dbo].[SprayAlerts] (IsRead);
