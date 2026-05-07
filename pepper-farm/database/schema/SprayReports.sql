-- Table: SprayReports
-- Description: Worker spray reports. Each row represents one event a worker
--              recorded - either a completed spray ('completed', CompletedAtUtc
--              is set) or a planned future spray ('planned', PlannedAtUtc is
--              set). The frontend uses this to display warnings to the worker
--              and (in US28) to render spray status on the manager farm map.

-- | Column            | Type           | Nullable | Default          | Notes                                                              |
-- |-------------------|----------------|----------|------------------|--------------------------------------------------------------------|
-- | SprayReportId     | INT            | NO       | IDENTITY (auto)  | Primary Key                                                        |
-- | ZoneId            | INT            | NO       |                  | FK -> FarmZones.ZoneId                                             |
-- | PesticideId       | INT            | NO       |                  | FK -> Pesticides.PesticideId                                       |
-- | ReportedByUserId  | INT            | NO       |                  | FK -> Users.UserId  (worker who filed the report)                  |
-- | Status            | NVARCHAR(20)   | NO       | 'completed'      | 'completed', 'planned', or 'cancelled'                             |
-- | PlannedAtUtc      | DATETIME2      | YES      |                  | When the worker plans to spray (only for 'planned' reports)        |
-- | CompletedAtUtc    | DATETIME2      | YES      |                  | When the spray actually happened (only for 'completed' reports)    |
-- | Notes             | NVARCHAR(1000) | YES      |                  | Optional free-text notes by the worker                             |
-- | RequiresApproval  | BIT            | NO       | 0                | True when pesticide is 'unverified' - flagged for manager review   |
-- | CreatedAt         | DATETIME2      | NO       | SYSUTCDATETIME() |                                                                    |

CREATE TABLE SprayReports (
    SprayReportId       INT             IDENTITY(1,1) NOT NULL,
    ZoneId              INT             NOT NULL,
    PesticideId         INT             NOT NULL,
    ReportedByUserId    INT             NOT NULL,
    Status              NVARCHAR(20)    NOT NULL CONSTRAINT DF_SprayReports_Status DEFAULT ('completed'),
    PlannedAtUtc        DATETIME2       NULL,
    CompletedAtUtc      DATETIME2       NULL,
    Notes               NVARCHAR(1000)  NULL,
    RequiresApproval    BIT             NOT NULL CONSTRAINT DF_SprayReports_RequiresApproval DEFAULT (0),
    CreatedAt           DATETIME2       NOT NULL CONSTRAINT DF_SprayReports_CreatedAt DEFAULT (SYSUTCDATETIME()),

    CONSTRAINT PK_SprayReports PRIMARY KEY CLUSTERED (SprayReportId),
    CONSTRAINT FK_SprayReports_Zone        FOREIGN KEY (ZoneId)           REFERENCES FarmZones    (ZoneId),
    CONSTRAINT FK_SprayReports_Pesticide   FOREIGN KEY (PesticideId)      REFERENCES Pesticides   (PesticideId),
    CONSTRAINT FK_SprayReports_ReportedBy  FOREIGN KEY (ReportedByUserId) REFERENCES Users        (UserId),
    CONSTRAINT CK_SprayReports_Status
        CHECK (Status IN ('completed', 'planned', 'cancelled')),
    -- Status semantics: a 'completed' row must have CompletedAtUtc, a 'planned'
    -- row must have PlannedAtUtc. 'cancelled' rows can have neither.
    CONSTRAINT CK_SprayReports_TimeMatchesStatus
        CHECK (
            (Status = 'completed' AND CompletedAtUtc IS NOT NULL) OR
            (Status = 'planned'   AND PlannedAtUtc   IS NOT NULL) OR
            (Status = 'cancelled')
        )
);

-- Indexes to keep the spray-map query fast (US28). Looking up the latest
-- completed spray per zone is the hottest read path.
CREATE INDEX IX_SprayReports_Zone_Completed
    ON SprayReports (ZoneId, CompletedAtUtc DESC)
    WHERE Status = 'completed';

CREATE INDEX IX_SprayReports_Zone_Planned
    ON SprayReports (ZoneId, PlannedAtUtc)
    WHERE Status = 'planned';