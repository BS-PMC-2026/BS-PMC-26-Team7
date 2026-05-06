-- Table: Pesticides
-- Description: Catalog of pesticides used on the farm. Each row stores
--              identifying details and (when known) the safety data the
--              backend uses to generate warnings when a worker reports a
--              spray on a zone. When VerificationStatus = 'unverified' the
--              safety fields may be NULL and the frontend must show the
--              "consult the official label" warning instead of computed
--              entry/harvest dates.

-- | Column              | Type           | Nullable | Default          | Notes                                                              |
-- |---------------------|----------------|----------|------------------|--------------------------------------------------------------------|
-- | PesticideId         | INT            | NO       | IDENTITY (auto)  | Primary Key                                                        |
-- | Name                | NVARCHAR(100)  | NO       |                  | Commercial name (e.g., 'Confidor')                                 |
-- | ActiveIngredient    | NVARCHAR(100)  | YES      |                  | Active substance (e.g., 'Imidacloprid')                            |
-- | Manufacturer        | NVARCHAR(100)  | YES      |                  |                                                                    |
-- | TargetPest          | NVARCHAR(200)  | YES      |                  | Free-text pests this pesticide treats                              |
-- | PreHarvestIntervalDays | INT         | YES      |                  | PHI: days that must pass between spray and harvest                 |
-- | ReEntryIntervalHours   | INT         | YES      |                  | REI: hours that must pass before workers can re-enter the area     |
-- | PpeRequired         | NVARCHAR(200)  | YES      |                  | Free-text required PPE (gloves, mask, etc.)                        |
-- | HazardLevel         | NVARCHAR(50)   | YES      |                  | low / medium / high                                                |
-- | VerificationStatus  | NVARCHAR(20)   | NO       | 'unverified'     | 'verified' or 'unverified' - controls whether to show safety data  |
-- | IsActive            | BIT            | NO       | 1                | Soft-delete flag                                                   |
-- | CreatedAt           | DATETIME2      | NO       | SYSUTCDATETIME() |                                                                    |

CREATE TABLE Pesticides (
    PesticideId             INT             IDENTITY(1,1) NOT NULL,
    Name                    NVARCHAR(100)   NOT NULL,
    ActiveIngredient        NVARCHAR(100)   NULL,
    Manufacturer            NVARCHAR(100)   NULL,
    TargetPest              NVARCHAR(200)   NULL,
    PreHarvestIntervalDays  INT             NULL,
    ReEntryIntervalHours    INT             NULL,
    PpeRequired             NVARCHAR(200)   NULL,
    HazardLevel             NVARCHAR(50)    NULL,
    VerificationStatus      NVARCHAR(20)    NOT NULL CONSTRAINT DF_Pesticides_VerificationStatus DEFAULT ('unverified'),
    IsActive                BIT             NOT NULL CONSTRAINT DF_Pesticides_IsActive DEFAULT (1),
    CreatedAt               DATETIME2       NOT NULL CONSTRAINT DF_Pesticides_CreatedAt DEFAULT (SYSUTCDATETIME()),

    CONSTRAINT PK_Pesticides PRIMARY KEY CLUSTERED (PesticideId),
    CONSTRAINT UQ_Pesticides_Name UNIQUE (Name),
    CONSTRAINT CK_Pesticides_VerificationStatus
        CHECK (VerificationStatus IN ('verified', 'unverified')),
    CONSTRAINT CK_Pesticides_HazardLevel
        CHECK (HazardLevel IS NULL OR HazardLevel IN ('low', 'medium', 'high'))
);