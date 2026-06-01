-- Migration: Add discount fields to Products table (US38 – Discounts)
-- Run once against the production database.
-- Safe to re-run: all changes are guarded by column-existence checks.

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.Products') AND name = 'DiscountPercentage'
)
BEGIN
    ALTER TABLE dbo.Products ADD DiscountPercentage DECIMAL(5, 2) NULL DEFAULT 0;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.Products') AND name = 'DiscountActive'
)
BEGIN
    ALTER TABLE dbo.Products ADD DiscountActive BIT NOT NULL DEFAULT 0;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.Products') AND name = 'DiscountStartDate'
)
BEGIN
    ALTER TABLE dbo.Products ADD DiscountStartDate DATETIME2 NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.Products') AND name = 'DiscountEndDate'
)
BEGIN
    ALTER TABLE dbo.Products ADD DiscountEndDate DATETIME2 NULL;
END;
