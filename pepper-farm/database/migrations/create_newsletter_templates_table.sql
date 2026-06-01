-- Migration: Create NewsletterTemplates table (US39 extension — newsletter template builder)
-- Run once against the production database.
-- Safe to re-run: table creation is guarded by a sys.tables existence check.

IF NOT EXISTS (
    SELECT 1 FROM sys.tables WHERE name = 'NewsletterTemplates' AND schema_id = SCHEMA_ID('dbo')
)
BEGIN
    CREATE TABLE dbo.NewsletterTemplates (
        NewsletterTemplateId    INT IDENTITY(1,1) PRIMARY KEY,
        Title                   NVARCHAR(200)   NOT NULL,
        Subject                 NVARCHAR(500)   NOT NULL,
        Preheader               NVARCHAR(300)   NULL,
        HeroImageUrl            NVARCHAR(500)   NULL,
        ContentJson             NVARCHAR(MAX)   NOT NULL DEFAULT '[]',
        BodyText                NVARCHAR(MAX)   NULL,
        CtaText                 NVARCHAR(200)   NULL,
        CtaUrl                  NVARCHAR(500)   NULL,
        FooterText              NVARCHAR(500)   NULL,
        Status                  NVARCHAR(20)    NOT NULL DEFAULT 'draft',  -- draft / ready / archived
        CreatedAtUtc            DATETIME2       NOT NULL DEFAULT SYSUTCDATETIME(),
        UpdatedAtUtc            DATETIME2       NOT NULL DEFAULT SYSUTCDATETIME(),
        CreatedBy               INT             NULL,
        UpdatedBy               INT             NULL
    );
END;
