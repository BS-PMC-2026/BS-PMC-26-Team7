-- Migration: Add TaskChecklistItems table (US39 – Task Progress Bar / Checklist)
-- Run once against the production database.
-- Safe to re-run: all changes are guarded by IF NOT EXISTS checks.

-- 1. Create TaskChecklistItems table
IF NOT EXISTS (
    SELECT 1 FROM sys.tables WHERE name = 'TaskChecklistItems'
)
BEGIN
    CREATE TABLE dbo.TaskChecklistItems (
        ItemId      INT            IDENTITY(1,1) PRIMARY KEY,
        TaskId      INT            NOT NULL,
        Title       NVARCHAR(200)  NOT NULL,
        IsCompleted BIT            NOT NULL DEFAULT 0,
        Position    INT            NOT NULL DEFAULT 0,
        CreatedAt   DATETIME2      NOT NULL DEFAULT SYSDATETIME(),
        UpdatedAt   DATETIME2      NOT NULL DEFAULT SYSDATETIME()
    );
END;

-- 2. Add FK constraint from TaskChecklistItems.TaskId to Tasks.Id
--    ON DELETE CASCADE: when a task is removed, its checklist items go with it.
IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = 'FK_TaskChecklistItems_Tasks'
      AND parent_object_id = OBJECT_ID('dbo.TaskChecklistItems')
)
BEGIN
    ALTER TABLE dbo.TaskChecklistItems
        ADD CONSTRAINT FK_TaskChecklistItems_Tasks
            FOREIGN KEY (TaskId) REFERENCES dbo.Tasks (Id)
            ON DELETE CASCADE;
END;

-- 3. Index to support fast "load all items for a given task"
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_TaskChecklistItems_TaskId'
      AND object_id = OBJECT_ID('dbo.TaskChecklistItems')
)
BEGIN
    CREATE INDEX IX_TaskChecklistItems_TaskId
        ON dbo.TaskChecklistItems (TaskId);
END;
