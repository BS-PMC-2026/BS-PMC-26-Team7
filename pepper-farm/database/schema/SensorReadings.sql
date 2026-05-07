-- ============================================================
-- Table: SensorReadings
-- Description: Raw telemetry data collected from IoT sensors
--              deployed across farm zones.
-- ============================================================

IF NOT EXISTS (
    SELECT 1 FROM sys.tables WHERE name = 'SensorReadings'
)
BEGIN
    CREATE TABLE SensorReadings (
        ReadingId     INT           IDENTITY(1,1) PRIMARY KEY,
        SensorId      NVARCHAR(100) NOT NULL,
        Temperature   FLOAT         NULL,          -- Celsius
        Humidity      FLOAT         NULL,          -- Percentage (0-100)
        Leak          FLOAT         NULL,          -- Arbitrary leak index (>=0)
        Radiation     FLOAT         NULL,          -- W/m²
        SampleTimeUtc DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
        RawJson       NVARCHAR(MAX) NULL
    );

    CREATE INDEX IX_SensorReadings_SensorId
        ON SensorReadings (SensorId);

    CREATE INDEX IX_SensorReadings_SampleTimeUtc
        ON SensorReadings (SampleTimeUtc DESC);
END;
