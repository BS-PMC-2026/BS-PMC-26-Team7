-- ============================================================
-- Table: SensorAssignments
-- Description: Maps a physical sensor to a specific pepper
--              variety, zone, and optionally a plant.
--              Only one active assignment per sensor is expected.
-- ============================================================

IF NOT EXISTS (
    SELECT 1 FROM sys.tables WHERE name = 'SensorAssignments'
)
BEGIN
    CREATE TABLE SensorAssignments (
        SensorId  NVARCHAR(100) NOT NULL,
        PepperId  INT           NOT NULL,
        ZoneId    INT           NOT NULL,
        PlantId   INT           NULL,
        IsActive  BIT           NOT NULL DEFAULT 1,

        CONSTRAINT PK_SensorAssignments PRIMARY KEY (SensorId, PepperId)
    );

    -- Fast lookup when joining to SensorReadings
    CREATE INDEX IX_SensorAssignments_SensorId_Active
        ON SensorAssignments (SensorId, IsActive);
END;
