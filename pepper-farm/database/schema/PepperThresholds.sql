-- ============================================================
-- Table: PepperThresholds
-- Description: Acceptable sensor value ranges per pepper variety.
--              Used by anomaly detection to determine what is
--              "normal" for a given crop.
-- Units:
--   Temperature  : Celsius
--   Humidity     : Percentage (0-100)
--   Leak         : Arbitrary index (>= 0); MaxLeak is upper bound
--   Radiation    : W/m²
-- ============================================================

IF NOT EXISTS (
    SELECT 1 FROM sys.tables WHERE name = 'PepperThresholds'
)
BEGIN
    CREATE TABLE PepperThresholds (
        PepperId        INT   NOT NULL,
        MinTemperature  FLOAT NOT NULL,
        MaxTemperature  FLOAT NOT NULL,
        MinHumidity     FLOAT NOT NULL,
        MaxHumidity     FLOAT NOT NULL,
        MaxLeak         FLOAT NOT NULL,  -- Leak has no lower bound (0 is fine)
        MinRadiation    FLOAT NOT NULL,
        MaxRadiation    FLOAT NOT NULL,
        IsActive        BIT   NOT NULL DEFAULT 1,

        CONSTRAINT PK_PepperThresholds PRIMARY KEY (PepperId),

        CONSTRAINT CK_PepperThresholds_Temp
            CHECK (MinTemperature < MaxTemperature),
        CONSTRAINT CK_PepperThresholds_Humidity
            CHECK (MinHumidity < MaxHumidity AND MinHumidity >= 0 AND MaxHumidity <= 100),
        CONSTRAINT CK_PepperThresholds_MaxLeak
            CHECK (MaxLeak >= 0),
        CONSTRAINT CK_PepperThresholds_Radiation
            CHECK (MinRadiation < MaxRadiation AND MinRadiation >= 0)
    );
END;
