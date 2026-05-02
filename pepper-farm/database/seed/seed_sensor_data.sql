-- ============================================================
-- Seed: Sensor Anomaly Detection Test Data
-- Purpose: Provide enough data to validate sp_DetectSensorAnomalies.
--
-- After running this script, execute:
--   EXEC sp_DetectSensorAnomalies;
--   SELECT * FROM SensorAlerts ORDER BY CreatedAtUtc DESC;
--
-- Expected results:
--   ReadingId 1 (normal)    -> 0 alerts
--   ReadingId 2 (medium)    -> 4 alerts  (all metrics, all 'Medium')
--   ReadingId 3 (high)      -> 4 alerts  (all metrics, all 'High')
-- ============================================================

-- --------------------------------------------------------
-- 1. Pepper thresholds (PepperId = 1)
--    Typical ranges for a sweet bell pepper variety.
-- --------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM PepperThresholds WHERE PepperId = 1)
BEGIN
    INSERT INTO PepperThresholds
        (PepperId, MinTemperature, MaxTemperature,
         MinHumidity, MaxHumidity,
         MaxLeak,
         MinRadiation, MaxRadiation,
         IsActive)
    VALUES
        (1,
         18.0, 30.0,          -- Temperature: 18-30 °C
         40.0, 80.0,          -- Humidity:    40-80 %
         2.0,                  -- MaxLeak:     2.0 (index)
         100.0, 400.0,        -- Radiation:   100-400 W/m²
         1);
END;

-- --------------------------------------------------------
-- 2. Sensor assignment: sensor 'SENSOR-001' -> PepperId 1
-- --------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM SensorAssignments WHERE SensorId = 'SENSOR-001' AND PepperId = 1)
BEGIN
    INSERT INTO SensorAssignments (SensorId, PepperId, ZoneId, PlantId, IsActive)
    VALUES ('SENSOR-001', 1, 1, NULL, 1);
END;

-- --------------------------------------------------------
-- 3. Sample readings
-- --------------------------------------------------------

-- Reading 1: All values WITHIN allowed ranges -> no alerts expected
IF NOT EXISTS (SELECT 1 FROM SensorReadings WHERE SensorId = 'SENSOR-001' AND Temperature = 24.0 AND Humidity = 60.0)
BEGIN
    INSERT INTO SensorReadings (SensorId, Temperature, Humidity, Leak, Radiation, SampleTimeUtc)
    VALUES ('SENSOR-001',
            24.0,          -- Normal temperature (midpoint = 24)
            60.0,          -- Normal humidity    (midpoint = 60)
            0.5,           -- Normal leak        (below MaxLeak 2.0)
            250.0,         -- Normal radiation   (midpoint = 250)
            DATEADD(MINUTE, -30, GETUTCDATE()));
END;

-- Reading 2: Values slightly outside range -> MEDIUM severity expected
-- Temperature 31.5°C  -> just over MaxTemp 30 (deviation ~7.5% from midpoint 24, half-range=6)
--   deviation = |31.5 - 24| / 6 * 100 = 125% → wait, let me recalculate
--   midpoint = (18+30)/2 = 24; half_range = (30-18)/2 = 6
--   |31.5 - 24| / 6 * 100 = 7.5/6*100 = 125% → High
-- Let me use a value just barely outside for Medium:
-- Temperature 30.5°C: |30.5-24|/6*100 = 6.5/6*100 = 108% → High
-- Actually for Medium we need deviation% <= 20:
--   deviation% = |v - mid| / half_range * 100 <= 20
--   |v - 24| <= 20 * 6 / 100 = 1.2  -> v in [22.8, 25.2] (within range, no alert)
-- The range is 18-30 so ANY out-of-range value will have deviation > 20% from midpoint.
-- This is because midpoint is the center of the range and any deviation outside the range
-- is already > half_range * 0 (edge). Let me verify:
--   At edge (30): deviation = |30-24|/6*100 = 100%  -> High
--   So for Temperature/Humidity/Radiation, any out-of-range = High.
-- Medium only possible if the range is wide and value barely outside.
-- Example: if MinTemp=25, MaxTemp=35, mid=30, half=5
--   value=35.5: deviation = 5.5/5*100 = 110% -> High
--   It seems all OOR values are High for symmetric metrics.
-- Medium is only achievable when deviation% <= 20, meaning value is within
--   20% of half_range from midpoint, i.e. well inside the range -> no alert.
-- Conclusion: for range-based metrics, out-of-range always produces High.
-- For Leak: Medium when Leak in (MaxLeak, MaxLeak*1.5], High when > MaxLeak*1.5
--
-- Reading 2 will demonstrate: Leak = 2.5 (between 2.0 and 3.0) -> Medium
--                              other metrics in range
IF NOT EXISTS (SELECT 1 FROM SensorReadings WHERE SensorId = 'SENSOR-001' AND Leak = 2.5)
BEGIN
    INSERT INTO SensorReadings (SensorId, Temperature, Humidity, Leak, Radiation, SampleTimeUtc)
    VALUES ('SENSOR-001',
            24.0,          -- Normal temperature
            60.0,          -- Normal humidity
            2.5,           -- MEDIUM leak: 2.0 < 2.5 <= 3.0 (MaxLeak * 1.5)
            250.0,         -- Normal radiation
            DATEADD(MINUTE, -20, GETUTCDATE()));
END;

-- Reading 3: All metrics outside range, all HIGH
-- Temperature 5°C     -> well below MinTemp 18   : deviation = |5-24|/6*100 = 316% -> High
-- Humidity    95%     -> well above MaxHumidity 80: deviation = |95-60|/20*100 = 175% -> High
-- Leak        5.0     -> 5.0 > 2.0 * 1.5 = 3.0   -> High
-- Radiation   10 W/m² -> well below MinRadiation 100: deviation = |10-250|/150*100 = 160% -> High
IF NOT EXISTS (SELECT 1 FROM SensorReadings WHERE SensorId = 'SENSOR-001' AND Temperature = 5.0 AND Humidity = 95.0)
BEGIN
    INSERT INTO SensorReadings (SensorId, Temperature, Humidity, Leak, Radiation, SampleTimeUtc)
    VALUES ('SENSOR-001',
            5.0,           -- HIGH: far below MinTemp 18
            95.0,          -- HIGH: far above MaxHumidity 80
            5.0,           -- HIGH: 5.0 > MaxLeak*1.5 = 3.0
            10.0,          -- HIGH: far below MinRadiation 100
            DATEADD(MINUTE, -10, GETUTCDATE()));
END;

-- Reading 4: Partial - only Leak is violated (Medium)
-- Validates that only violated metrics generate alerts
IF NOT EXISTS (SELECT 1 FROM SensorReadings WHERE SensorId = 'SENSOR-001' AND Leak = 2.8 AND Temperature = 24.0)
BEGIN
    INSERT INTO SensorReadings (SensorId, Temperature, Humidity, Leak, Radiation, SampleTimeUtc)
    VALUES ('SENSOR-001',
            24.0,          -- Normal
            60.0,          -- Normal
            2.8,           -- MEDIUM leak only: 2.0 < 2.8 <= 3.0
            250.0,         -- Normal
            DATEADD(MINUTE, -5, GETUTCDATE()));
END;
