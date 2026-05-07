-- Migration: Add PAR (Photosynthetically Active Radiation) fields
-- Run once against the production database.

-- 1. Add PAR column to SensorReadings
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('SensorReadings') AND name = 'PAR'
)
BEGIN
    ALTER TABLE SensorReadings
        ADD PAR FLOAT NULL;
END;

-- 2. Add OptimalPARMin / OptimalPARMax columns to PepperVarieties
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('PepperVarieties') AND name = 'OptimalPARMin'
)
BEGIN
    ALTER TABLE PepperVarieties
        ADD OptimalPARMin DECIMAL(7,2) NULL,
            OptimalPARMax DECIMAL(7,2) NULL;
END;
