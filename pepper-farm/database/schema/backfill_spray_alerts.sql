-- backfill_spray_alerts.sql
-- Run this ONCE against the production Azure SQL database AFTER creating SprayAlerts.sql.
-- Generates SprayAlert rows for any SprayReport that does not yet have one.
--
-- This covers the scenario where SprayReports existed before the SprayAlerts
-- table was created (e.g. the POST /api/spray-reports returned 500 and the
-- SprayReport row was committed but the alert was not).
--
-- Safe to re-run: the WHERE NOT EXISTS clause prevents duplicate alerts.

INSERT INTO [dbo].[SprayAlerts] (
    SprayReportId,
    ZoneId,
    ZoneCode,
    ZoneName,
    PesticideName,
    ReportedByUserId,
    ReportStatus,
    Severity,
    SafetyMessage,
    RequiresApproval,
    ReEntryIntervalHours,
    SafeToReEnterAtUtc,
    SafeToHarvestAtUtc,
    HazardLevel,
    PpeRequired,
    SprayedAtUtc,
    IsRead,
    CreatedAt
)
SELECT
    sr.SprayReportId,
    sr.ZoneId,
    fz.ZoneCode,
    fz.ZoneName,
    p.Name                                     AS PesticideName,
    sr.ReportedByUserId,
    sr.Status                                  AS ReportStatus,

    -- Severity: mirrors _compute_severity() in spray_service.py
    CASE
        WHEN p.VerificationStatus = 'unverified'
            THEN 'high'
        WHEN sr.Status = 'completed'
             AND sr.CompletedAtUtc IS NOT NULL
             AND p.ReEntryIntervalHours IS NOT NULL
             AND GETUTCDATE() < DATEADD(HOUR, p.ReEntryIntervalHours, sr.CompletedAtUtc)
            THEN 'medium'
        ELSE 'low'
    END                                        AS Severity,

    -- SafetyMessage: mirrors _build_safety_warning() in spray_service.py
    CASE
        WHEN p.VerificationStatus = 'unverified'
            THEN 'Safety data for this pesticide is not yet defined in the system. '
               + 'Please consult the official product label before harvesting or '
               + 're-entering the sprayed area.'
        ELSE 'Safety data verified. '
           + 'Do not re-enter the area or harvest before the dates shown above.'
    END                                        AS SafetyMessage,

    CASE WHEN p.VerificationStatus = 'unverified' THEN 1 ELSE 0 END AS RequiresApproval,

    p.ReEntryIntervalHours,

    -- SafeToReEnterAtUtc
    CASE
        WHEN p.VerificationStatus = 'verified'
             AND p.ReEntryIntervalHours IS NOT NULL
             AND sr.Status = 'completed' AND sr.CompletedAtUtc IS NOT NULL
            THEN DATEADD(HOUR, p.ReEntryIntervalHours, sr.CompletedAtUtc)
        WHEN p.VerificationStatus = 'verified'
             AND p.ReEntryIntervalHours IS NOT NULL
             AND sr.Status = 'planned'   AND sr.PlannedAtUtc   IS NOT NULL
            THEN DATEADD(HOUR, p.ReEntryIntervalHours, sr.PlannedAtUtc)
        ELSE NULL
    END                                        AS SafeToReEnterAtUtc,

    -- SafeToHarvestAtUtc
    CASE
        WHEN p.VerificationStatus = 'verified'
             AND p.PreHarvestIntervalDays IS NOT NULL
             AND sr.Status = 'completed' AND sr.CompletedAtUtc IS NOT NULL
            THEN DATEADD(DAY, p.PreHarvestIntervalDays, sr.CompletedAtUtc)
        WHEN p.VerificationStatus = 'verified'
             AND p.PreHarvestIntervalDays IS NOT NULL
             AND sr.Status = 'planned'   AND sr.PlannedAtUtc   IS NOT NULL
            THEN DATEADD(DAY, p.PreHarvestIntervalDays, sr.PlannedAtUtc)
        ELSE NULL
    END                                        AS SafeToHarvestAtUtc,

    p.HazardLevel,
    p.PpeRequired,
    COALESCE(sr.CompletedAtUtc, sr.PlannedAtUtc) AS SprayedAtUtc,
    0                                          AS IsRead,
    -- Use the report's CreatedAt so historical ordering is preserved
    sr.CreatedAt                               AS CreatedAt

FROM  [dbo].[SprayReports] sr
JOIN  [dbo].[FarmZones]   fz ON fz.ZoneId      = sr.ZoneId
JOIN  [dbo].[Pesticides]  p  ON p.PesticideId  = sr.PesticideId
WHERE NOT EXISTS (
    SELECT 1
    FROM   [dbo].[SprayAlerts] sa
    WHERE  sa.SprayReportId = sr.SprayReportId
);

-- Report how many rows were backfilled.
SELECT @@ROWCOUNT AS BackfilledAlerts;
