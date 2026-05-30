-- Migration: Create EmailLogs table (US39 – Send Mail / SMTP / Newsletter)
-- Run once against the production database.
-- Safe to re-run: table creation is guarded by a sys.tables existence check.

IF NOT EXISTS (
    SELECT 1 FROM sys.tables WHERE name = 'EmailLogs' AND schema_id = SCHEMA_ID('dbo')
)
BEGIN
    CREATE TABLE dbo.EmailLogs (
        EmailLogId                  INT IDENTITY(1,1) PRIMARY KEY,
        RecipientEmail              NVARCHAR(200)   NOT NULL,
        RecipientName               NVARCHAR(100)   NULL,
        RecipientType               NVARCHAR(20)    NOT NULL,   -- customer / worker / manager / unknown
        Subject                     NVARCHAR(500)   NOT NULL,
        MessagePreview              NVARCHAR(500)   NULL,
        EmailType                   NVARCHAR(50)    NOT NULL,   -- discount_promotion / newsletter / announcement / system
        Status                      NVARCHAR(20)    NOT NULL,   -- pending / sent / failed / skipped
        ErrorMessage                NVARCHAR(1000)  NULL,
        RelatedProductId            INT             NULL,
        RelatedDiscountPercentage   DECIMAL(5,2)    NULL,
        SentAtUtc                   DATETIME2       NULL,
        CreatedAtUtc                DATETIME2       NOT NULL DEFAULT SYSUTCDATETIME(),
        CreatedBy                   INT             NULL        -- UserId of the manager who triggered the send
    );
END;
