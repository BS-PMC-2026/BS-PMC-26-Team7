-- Migration: Add EmailConsent field to Users table (US39 – Send Mail / Newsletter)
-- Run once against the production database.
-- Safe to re-run: guarded by a column-existence check.
-- Default FALSE (US40): new users are NOT subscribed by default — explicit opt-in required.

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.Users') AND name = 'EmailConsent'
)
BEGIN
    ALTER TABLE dbo.Users ADD EmailConsent BIT NOT NULL DEFAULT 0;
END;
