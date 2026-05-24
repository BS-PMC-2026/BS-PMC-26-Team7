-- Table: OverdueSprayAlerts
-- Description: US32 — Periodic overdue spray alerts created by the scheduler
--              when a farm zone has not been sprayed within the configured
--              interval (DEFAULT_SPRAY_INTERVAL_DAYS = 30).
--
--              Separate from SprayAlerts (US30) which is tied to a specific
--              SprayReport submitted by a worker.  Overdue alerts exist when
--              there is NO recent spray report.
--
-- Overdue rule:
--   A zone is overdue if the most-recent completed SprayReport.CompletedAtUtc
--   is older than 30 days, or if the zone has no completed spray history and
--   was created more than 30 days ago.
--
-- Duplicate prevention (application-level):
--   check_overdue_spray_zones() skips a zone if an active (IsResolved=0) alert
--   already exists for it.  This prevents unlimited duplicate alerts on every
--   scheduler run for the same unresolved condition.
--
-- Resolution:
--   When a worker submits a completed spray report for the overdue zone,
--   create_spray_report() calls _resolve_overdue_alerts_for_zone() which sets
--   IsResolved=1 and ResolvedAtUtc=now for all active alerts for that zone.
--
-- Severity values:
--   'high'   — zone overdue by more than 100% extra (> 2× interval, ~60+ days)
--   'medium' — zone overdue by more than 50% extra  (> 1.5× interval, ~45+ days)
--   'low'    — zone just crossed the threshold        (≥ 1× interval, 30+ days)
--
-- Prerequisites (must already exist in [dbo]):
--   dbo.FarmZones  (ZoneId INT PK)
--   dbo.Tasks      (Id INT PK)

-- | Column            | Type           | Nullable | Default          | Notes                                                   |
-- |-------------------|----------------|----------|------------------|---------------------------------------------------------|
-- | OverdueAlertId    | INT            | NO       | IDENTITY (auto)  | Primary Key                                             |
-- | ZoneId            | INT            | NO       |                  | FK -> dbo.FarmZones.ZoneId                              |
-- | ZoneCode          | NVARCHAR(50)   | NO       |                  | Snapshot of zone code at alert creation time            |
-- | ZoneName          | NVARCHAR(100)  | NO       |                  | Snapshot of zone name at alert creation time            |
-- | LastSprayedAtUtc  | DATETIME2      | YES      |                  | Most-recent completed spray (NULL = never sprayed)      |
-- | OverdueSinceUtc   | DATETIME2      | NO       |                  | When the zone became overdue (LastSprayed + interval)   |
-- | SprayIntervalDays | INT            | NO       |                  | Threshold used when this alert was created (snapshot)   |
-- | Severity          | NVARCHAR(20)   | NO       | 'low'            | 'high', 'medium', or 'low'                              |
-- | Message           | NVARCHAR(500)  | NO       |                  | Human-readable overdue message                          |
-- | IsRead            | BIT            | NO       | 0                | True once manager has acknowledged the alert            |
-- | IsResolved        | BIT            | NO       | 0                | True once zone has been sprayed (condition cleared)     |
-- | ResolvedAtUtc     | DATETIME2      | YES      |                  | When the alert was resolved                             |
-- | AssignedTaskId    | INT            | YES      |                  | FK -> dbo.Tasks.Id — set when manager assigns a task    |
-- | CreatedAt         | DATETIME2      | NO       | SYSUTCDATETIME() |                                                         |

CREATE TABLE [dbo].[OverdueSprayAlerts] (
    OverdueAlertId    INT            IDENTITY(1,1) NOT NULL,
    ZoneId            INT            NOT NULL,
    ZoneCode          NVARCHAR(50)   NOT NULL,
    ZoneName          NVARCHAR(100)  NOT NULL,
    LastSprayedAtUtc  DATETIME2      NULL,
    OverdueSinceUtc   DATETIME2      NOT NULL,
    SprayIntervalDays INT            NOT NULL,
    Severity          NVARCHAR(20)   NOT NULL CONSTRAINT DF_OverdueSprayAlerts_Severity DEFAULT ('low'),
    Message           NVARCHAR(500)  NOT NULL,
    IsRead            BIT            NOT NULL CONSTRAINT DF_OverdueSprayAlerts_IsRead DEFAULT (0),
    IsResolved        BIT            NOT NULL CONSTRAINT DF_OverdueSprayAlerts_IsResolved DEFAULT (0),
    ResolvedAtUtc     DATETIME2      NULL,
    AssignedTaskId    INT            NULL,
    CreatedAt         DATETIME2      NOT NULL CONSTRAINT DF_OverdueSprayAlerts_CreatedAt DEFAULT (SYSUTCDATETIME()),

    CONSTRAINT PK_OverdueSprayAlerts PRIMARY KEY CLUSTERED (OverdueAlertId),
    CONSTRAINT FK_OverdueSprayAlerts_Zone          FOREIGN KEY (ZoneId)         REFERENCES [dbo].[FarmZones] ([ZoneId]),
    CONSTRAINT FK_OverdueSprayAlerts_AssignedTask  FOREIGN KEY (AssignedTaskId) REFERENCES [dbo].[Tasks]     ([Id]),
    CONSTRAINT CK_OverdueSprayAlerts_Severity      CHECK (Severity IN ('high', 'medium', 'low'))
);

-- Index to support manager alert list query (active alerts first, newest first).
CREATE INDEX IX_OverdueSprayAlerts_IsResolved_CreatedAt
    ON [dbo].[OverdueSprayAlerts] (IsResolved, CreatedAt DESC);

-- Index for zone-based lookups (duplicate prevention + resolution).
CREATE INDEX IX_OverdueSprayAlerts_ZoneId_IsResolved
    ON [dbo].[OverdueSprayAlerts] (ZoneId, IsResolved);

-- Index for unread alerts (common filter).
CREATE INDEX IX_OverdueSprayAlerts_IsRead
    ON [dbo].[OverdueSprayAlerts] (IsRead);
