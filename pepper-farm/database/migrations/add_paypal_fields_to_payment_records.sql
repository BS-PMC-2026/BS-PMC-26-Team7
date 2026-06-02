-- Migration: Add real PayPal Sandbox fields to PaymentRecords table
-- Run once against the production database.
-- Safe to re-run: all changes guarded by sys.columns existence checks.
-- These fields store PayPal order/capture IDs returned by the PayPal Orders API v2.
-- PAYPAL_CLIENT_SECRET is backend-only and is NEVER stored in this table.

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.PaymentRecords') AND name = 'ProviderOrderId'
)
BEGIN
    ALTER TABLE dbo.PaymentRecords ADD ProviderOrderId NVARCHAR(100) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.PaymentRecords') AND name = 'ProviderCaptureId'
)
BEGIN
    ALTER TABLE dbo.PaymentRecords ADD ProviderCaptureId NVARCHAR(100) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.PaymentRecords') AND name = 'ProviderStatus'
)
BEGIN
    ALTER TABLE dbo.PaymentRecords ADD ProviderStatus NVARCHAR(50) NULL;
END;
