-- Table: Roles
-- Description: Defines user roles in the system (e.g. Manager, Employee)

-- | Column          | Type          | Nullable | Default           | Notes                  |
-- |-----------------|---------------|----------|-------------------|------------------------|
-- | RoleId          | INT           | NO       | IDENTITY (auto)   | Primary Key            |
-- | RoleName        | NVARCHAR(50)  | NO       |                   | Unique                 |
-- | RoleDescription | NVARCHAR(255) | YES      |                   |                        |
-- | IsActive        | BIT           | NO       | 1                 |                        |
-- | CreatedAt       | DATETIME2     | NO       | SYSUTCDATETIME()  |                        |
