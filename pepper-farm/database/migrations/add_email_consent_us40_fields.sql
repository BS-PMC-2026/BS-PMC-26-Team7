-- Migration: Add US40 email consent management fields to Users table
-- Run AFTER add_email_consent_to_users.sql.
-- Safe to re-run: all columns guarded by sys.columns existence checks.

-- When the customer updates their consent via the profile toggle.
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.Users') AND name = 'EmailMarketingConsentUpdatedAtUtc'
)
BEGIN
    ALTER TABLE dbo.Users ADD EmailMarketingConsentUpdatedAtUtc DATETIME2 NULL;
END;

-- Secure random token included in marketing email footers for one-click unsubscribe.
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.Users') AND name = 'EmailUnsubscribeToken'
)
BEGIN
    ALTER TABLE dbo.Users ADD EmailUnsubscribeToken NVARCHAR(128) NULL;
END;

-- Set when user unsubscribes (EmailConsent is also set to 0 at the same time).
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.Users') AND name = 'EmailUnsubscribedAtUtc'
)
BEGIN
    ALTER TABLE dbo.Users ADD EmailUnsubscribedAtUtc DATETIME2 NULL;
END;
