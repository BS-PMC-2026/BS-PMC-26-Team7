-- Migration: Link Tasks to SensorAlerts (US24 – Manager Assigns Employee to Alert)
-- Run once against the production database.
-- Safe to re-run: all changes are guarded by IF NOT EXISTS checks.

-- 1. Add nullable AnomalyId column to Tasks
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.Tasks') AND name = 'AnomalyId'
)
BEGIN
    ALTER TABLE dbo.Tasks
        ADD AnomalyId INT NULL;
END;

-- 2. Add FK constraint from Tasks.AnomalyId to SensorAlerts.AlertId
IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = 'FK_Tasks_SensorAlerts'
      AND parent_object_id = OBJECT_ID('dbo.Tasks')
)
BEGIN
    ALTER TABLE dbo.Tasks
        ADD CONSTRAINT FK_Tasks_SensorAlerts
            FOREIGN KEY (AnomalyId) REFERENCES dbo.SensorAlerts (AlertId);
END;

-- 3. Index to support fast lookup of tasks created from a given alert
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_Tasks_AnomalyId'
      AND object_id = OBJECT_ID('dbo.Tasks')
)
BEGIN
    CREATE INDEX IX_Tasks_AnomalyId
        ON dbo.Tasks (AnomalyId)
        WHERE AnomalyId IS NOT NULL;
END;
