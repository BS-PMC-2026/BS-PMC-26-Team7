-- ============================================================
-- Table: TaskChecklistItems
-- Description: Checklist items belonging to a Task. A task may have
--              zero or more items; the UI progress bar is computed
--              as completed/total. Deleting a task cascades to its
--              checklist items.
-- ============================================================

-- | Column      | Type           | Nullable | Default          | Notes                       |
-- |-------------|----------------|----------|------------------|-----------------------------|
-- | ItemId      | INT            | NO       | IDENTITY (auto)  | Primary Key                 |
-- | TaskId      | INT            | NO       |                  | FK -> Tasks.Id (CASCADE)    |
-- | Title       | NVARCHAR(200)  | NO       |                  | Item text                   |
-- | IsCompleted | BIT            | NO       | 0                | 0 = open, 1 = done          |
-- | Position    | INT            | NO       | 0                | Display order within a task |
-- | CreatedAt   | DATETIME2      | NO       | SYSDATETIME()    |                             |
-- | UpdatedAt   | DATETIME2      | NO       | SYSDATETIME()    |                             |
--
-- Migration required: run database/migrations/add_task_checklist_items.sql

IF NOT EXISTS (
    SELECT 1 FROM sys.tables WHERE name = 'TaskChecklistItems'
)
BEGIN
    CREATE TABLE TaskChecklistItems (
        ItemId      INT            IDENTITY(1,1) PRIMARY KEY,
        TaskId      INT            NOT NULL,
        Title       NVARCHAR(200)  NOT NULL,
        IsCompleted BIT            NOT NULL DEFAULT 0,
        Position    INT            NOT NULL DEFAULT 0,
        CreatedAt   DATETIME2      NOT NULL DEFAULT SYSDATETIME(),
        UpdatedAt   DATETIME2      NOT NULL DEFAULT SYSDATETIME(),

        CONSTRAINT FK_TaskChecklistItems_Tasks
            FOREIGN KEY (TaskId) REFERENCES Tasks (Id)
            ON DELETE CASCADE
    );

    CREATE INDEX IX_TaskChecklistItems_TaskId
        ON TaskChecklistItems (TaskId);
END;
