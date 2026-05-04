-- ============================================================
-- Stored Procedure: sp_DetectSensorAnomalies
-- Description:
--   Rule-based anomaly detection for sensor readings.
--   For each reading it:
--     1. Resolves the active pepper assignment for the sensor.
--     2. Loads the pepper's threshold configuration.
--     3. Checks each metric (Temperature, Humidity, Leak, Radiation)
--        against its allowed range.
--     4. Inserts one SensorAlert row per violated metric.
--
-- Parameters:
--   @ReadingId INT (optional)
--     When provided: processes only that specific reading.
--     When NULL    : processes all readings not yet fully evaluated.
--
-- Severity rules (range-based: Temperature, Humidity, Radiation):
--   midpoint   = (Min + Max) / 2
--   half_range = (Max - Min) / 2
--   deviation% = |actual - midpoint| / half_range * 100
--   High   if deviation% > 20
--   Medium otherwise
--
-- Severity rules (one-sided: Leak — upper bound only):
--   High   if actual > MaxLeak * 1.5
--   Medium otherwise
--
-- Idempotency:
--   A UNIQUE index UX_SensorAlerts_ReadingMetric on (ReadingId, MetricName)
--   prevents duplicates. NOT EXISTS guards in each INSERT avoid constraint
--   violations on re-runs.
-- ============================================================

CREATE OR ALTER PROCEDURE sp_DetectSensorAnomalies
    @ReadingId INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    -- --------------------------------------------------------
    -- Temperature anomalies
    -- --------------------------------------------------------
    INSERT INTO SensorAlerts
        (SensorId, ReadingId, PepperId, MetricName,
         ActualValue, MinAllowed, MaxAllowed, Severity, Message)
    SELECT
        r.SensorId,
        r.ReadingId,
        t.PepperId,
        'Temperature'                                               AS MetricName,
        r.Temperature                                               AS ActualValue,
        t.MinTemperature                                            AS MinAllowed,
        t.MaxTemperature                                            AS MaxAllowed,
        CASE
            WHEN (ABS(r.Temperature - ((t.MinTemperature + t.MaxTemperature) / 2.0))
                  / ((t.MaxTemperature - t.MinTemperature) / 2.0) * 100) > 20
            THEN 'High'
            ELSE 'Medium'
        END                                                         AS Severity,
        CONCAT(
            'Temperature ', r.Temperature, ' C is outside [',
            t.MinTemperature, ', ', t.MaxTemperature, '] C'
        )                                                           AS Message
    FROM SensorReadings r
    INNER JOIN SensorAssignments sa
        ON  sa.SensorId = r.SensorId
        AND sa.IsActive = 1
        AND sa.AssignedToUtc IS NULL        -- still active (no end date)
    INNER JOIN PepperThresholds t
        ON  t.PepperId = sa.PepperId
        AND t.IsActive = 1
    WHERE
        (@ReadingId IS NULL OR r.ReadingId = @ReadingId)
        AND r.Temperature IS NOT NULL
        AND t.MinTemperature IS NOT NULL
        AND t.MaxTemperature IS NOT NULL
        AND (r.Temperature < t.MinTemperature OR r.Temperature > t.MaxTemperature)
        AND NOT EXISTS (
            SELECT 1 FROM SensorAlerts a
            WHERE a.ReadingId = r.ReadingId AND a.MetricName = 'Temperature'
        );

    -- --------------------------------------------------------
    -- Humidity anomalies
    -- --------------------------------------------------------
    INSERT INTO SensorAlerts
        (SensorId, ReadingId, PepperId, MetricName,
         ActualValue, MinAllowed, MaxAllowed, Severity, Message)
    SELECT
        r.SensorId,
        r.ReadingId,
        t.PepperId,
        'Humidity'                                                  AS MetricName,
        r.Humidity                                                  AS ActualValue,
        t.MinHumidity                                               AS MinAllowed,
        t.MaxHumidity                                               AS MaxAllowed,
        CASE
            WHEN (ABS(r.Humidity - ((t.MinHumidity + t.MaxHumidity) / 2.0))
                  / ((t.MaxHumidity - t.MinHumidity) / 2.0) * 100) > 20
            THEN 'High'
            ELSE 'Medium'
        END                                                         AS Severity,
        CONCAT(
            'Humidity ', r.Humidity, '% is outside [',
            t.MinHumidity, ', ', t.MaxHumidity, '] %'
        )                                                           AS Message
    FROM SensorReadings r
    INNER JOIN SensorAssignments sa
        ON  sa.SensorId = r.SensorId
        AND sa.IsActive = 1
        AND sa.AssignedToUtc IS NULL
    INNER JOIN PepperThresholds t
        ON  t.PepperId = sa.PepperId
        AND t.IsActive = 1
    WHERE
        (@ReadingId IS NULL OR r.ReadingId = @ReadingId)
        AND r.Humidity IS NOT NULL
        AND t.MinHumidity IS NOT NULL
        AND t.MaxHumidity IS NOT NULL
        AND (r.Humidity < t.MinHumidity OR r.Humidity > t.MaxHumidity)
        AND NOT EXISTS (
            SELECT 1 FROM SensorAlerts a
            WHERE a.ReadingId = r.ReadingId AND a.MetricName = 'Humidity'
        );

    -- --------------------------------------------------------
    -- Leak anomalies (one-sided: upper bound only)
    -- MaxLeak = 0 means any nonzero leak triggers an alert.
    -- --------------------------------------------------------
    INSERT INTO SensorAlerts
        (SensorId, ReadingId, PepperId, MetricName,
         ActualValue, MinAllowed, MaxAllowed, Severity, Message)
    SELECT
        r.SensorId,
        r.ReadingId,
        t.PepperId,
        'Leak'                                                      AS MetricName,
        r.Leak                                                      AS ActualValue,
        NULL                                                        AS MinAllowed,
        t.MaxLeak                                                   AS MaxAllowed,
        CASE
            WHEN r.Leak > t.MaxLeak * 1.5 THEN 'High'
            ELSE 'Medium'
        END                                                         AS Severity,
        CONCAT(
            'Leak index ', r.Leak, ' exceeds MaxLeak of ', t.MaxLeak
        )                                                           AS Message
    FROM SensorReadings r
    INNER JOIN SensorAssignments sa
        ON  sa.SensorId = r.SensorId
        AND sa.IsActive = 1
        AND sa.AssignedToUtc IS NULL
    INNER JOIN PepperThresholds t
        ON  t.PepperId = sa.PepperId
        AND t.IsActive = 1
    WHERE
        (@ReadingId IS NULL OR r.ReadingId = @ReadingId)
        AND r.Leak IS NOT NULL
        AND t.MaxLeak IS NOT NULL
        AND r.Leak > t.MaxLeak
        AND NOT EXISTS (
            SELECT 1 FROM SensorAlerts a
            WHERE a.ReadingId = r.ReadingId AND a.MetricName = 'Leak'
        );

    -- --------------------------------------------------------
    -- Radiation anomalies
    -- --------------------------------------------------------
    INSERT INTO SensorAlerts
        (SensorId, ReadingId, PepperId, MetricName,
         ActualValue, MinAllowed, MaxAllowed, Severity, Message)
    SELECT
        r.SensorId,
        r.ReadingId,
        t.PepperId,
        'Radiation'                                                 AS MetricName,
        r.Radiation                                                 AS ActualValue,
        t.MinRadiation                                              AS MinAllowed,
        t.MaxRadiation                                              AS MaxAllowed,
        CASE
            WHEN (ABS(r.Radiation - ((t.MinRadiation + t.MaxRadiation) / 2.0))
                  / ((t.MaxRadiation - t.MinRadiation) / 2.0) * 100) > 20
            THEN 'High'
            ELSE 'Medium'
        END                                                         AS Severity,
        CONCAT(
            'Radiation ', r.Radiation, ' W/m2 is outside [',
            t.MinRadiation, ', ', t.MaxRadiation, '] W/m2'
        )                                                           AS Message
    FROM SensorReadings r
    INNER JOIN SensorAssignments sa
        ON  sa.SensorId = r.SensorId
        AND sa.IsActive = 1
        AND sa.AssignedToUtc IS NULL
    INNER JOIN PepperThresholds t
        ON  t.PepperId = sa.PepperId
        AND t.IsActive = 1
    WHERE
        (@ReadingId IS NULL OR r.ReadingId = @ReadingId)
        AND r.Radiation IS NOT NULL
        AND t.MinRadiation IS NOT NULL
        AND t.MaxRadiation IS NOT NULL
        AND (r.Radiation < t.MinRadiation OR r.Radiation > t.MaxRadiation)
        AND NOT EXISTS (
            SELECT 1 FROM SensorAlerts a
            WHERE a.ReadingId = r.ReadingId AND a.MetricName = 'Radiation'
        );

END;
GO
