-- Migration: US39 – TaskChecklistItems table
-- Safe to run multiple times (uses IF NOT EXISTS pattern via object-existence check).
-- Target: SQL Server (Azure SQL / MS SQL Server)

IF NOT EXISTS (
    SELECT 1
    FROM   sys.tables
    WHERE  name = 'TaskChecklistItems'
      AND  SCHEMA_NAME(schema_id) = 'dbo'
)
BEGIN
    CREATE TABLE dbo.TaskChecklistItems (
        ItemId      INT           NOT NULL IDENTITY(1,1) PRIMARY KEY,
        TaskId      INT           NOT NULL,
        Title       NVARCHAR(200) NOT NULL,
        IsCompleted BIT           NOT NULL DEFAULT 0,
        Position    INT           NOT NULL DEFAULT 0,
        CreatedAt   DATETIME2     NOT NULL DEFAULT SYSDATETIME(),
        UpdatedAt   DATETIME2     NOT NULL DEFAULT SYSDATETIME(),

        CONSTRAINT FK_TaskChecklistItems_Tasks
            FOREIGN KEY (TaskId) REFERENCES dbo.Tasks (Id)
            ON DELETE CASCADE
    );

    CREATE INDEX IX_TaskChecklistItems_TaskId
        ON dbo.TaskChecklistItems (TaskId);
END;
