-- Migration: Create Notifications table (US40 – in-app notifications for messages/announcements)
-- Safe to re-run: table creation guarded by sys.tables existence check.
-- NOTE: This table is for APP notifications only (messages, system announcements).
--       Newsletter sends do NOT create rows in this table (see US40 rule 40.5).

IF NOT EXISTS (
    SELECT 1 FROM sys.tables WHERE name = 'Notifications' AND schema_id = SCHEMA_ID('dbo')
)
BEGIN
    CREATE TABLE dbo.Notifications (
        NotificationId      INT IDENTITY(1,1) PRIMARY KEY,
        UserId              INT             NOT NULL,
        Title               NVARCHAR(200)   NOT NULL,
        Message             NVARCHAR(2000)  NULL,
        NotificationType    NVARCHAR(30)    NOT NULL DEFAULT 'message',  -- message / system
        RelatedEntityType   NVARCHAR(50)    NULL,
        RelatedEntityId     INT             NULL,
        IsRead              BIT             NOT NULL DEFAULT 0,
        CreatedAtUtc        DATETIME2       NOT NULL DEFAULT SYSUTCDATETIME(),
        ReadAtUtc           DATETIME2       NULL,

        CONSTRAINT FK_Notifications_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(UserId)
    );

    CREATE INDEX IX_Notifications_UserId_IsRead
        ON dbo.Notifications (UserId, IsRead);
END;
