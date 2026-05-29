-- Migration: Add EmailConsent field to Users table (US39 – Send Mail / Newsletter)
-- Run once against the production database.
-- Safe to re-run: guarded by a column-existence check.
-- Default TRUE so existing registered customers are opted in by default.

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.Users') AND name = 'EmailConsent'
)
BEGIN
    ALTER TABLE dbo.Users ADD EmailConsent BIT NOT NULL DEFAULT 1;
END;
