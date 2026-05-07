-- ============================================================
-- Table: SensorAlerts
-- Description: One row per anomaly detected per metric per reading.
--              Populated by sp_DetectSensorAnomalies.
-- Severity values: 'High' | 'Medium'
-- MetricName values: 'Temperature' | 'Humidity' | 'Leak' | 'Radiation'
-- ============================================================

IF NOT EXISTS (
    SELECT 1 FROM sys.tables WHERE name = 'SensorAlerts'
)
BEGIN
    CREATE TABLE SensorAlerts (
        AlertId      INT           IDENTITY(1,1) PRIMARY KEY,
        SensorId     NVARCHAR(100) NOT NULL,
        ReadingId    INT           NOT NULL,
        PepperId     INT           NOT NULL,
        MetricName   NVARCHAR(50)  NOT NULL,
        ActualValue  FLOAT         NOT NULL,
        MinAllowed   FLOAT         NULL,   -- NULL for one-sided checks (e.g. Leak)
        MaxAllowed   FLOAT         NULL,
        Severity     NVARCHAR(20)  NOT NULL,
        Message      NVARCHAR(500) NULL,
        IsResolved   BIT           NOT NULL DEFAULT 0,
        CreatedAtUtc DATETIME2     NOT NULL DEFAULT GETUTCDATE(),

        CONSTRAINT CK_SensorAlerts_Severity
            CHECK (Severity IN ('High', 'Medium')),
        CONSTRAINT CK_SensorAlerts_MetricName
            CHECK (MetricName IN ('Temperature', 'Humidity', 'Leak', 'Radiation'))
    );

    -- Support fast queries like "unresolved alerts for sensor X"
    CREATE INDEX IX_SensorAlerts_SensorId_Resolved
        ON SensorAlerts (SensorId, IsResolved, CreatedAtUtc DESC);

    -- Deduplication index used by the stored procedure
    CREATE UNIQUE INDEX UX_SensorAlerts_ReadingMetric
        ON SensorAlerts (ReadingId, MetricName);
END;
