# Coding Conventions

**Analysis Date:** 2026-05-16

## Naming Patterns

**Files:**
- React components: PascalCase (e.g., `LoginForm.tsx`, `TaskCard.tsx`, `Button.tsx`)
- Service files: camelCase (e.g., `userService.ts`, `anomalies.ts`, `auth.ts`)
- Type/interface files: lowercase with feature name (e.g., `user.ts`, `task.ts`, `inventory.ts`)
- Python models: PascalCase (e.g., `User.py`, `Task.py`, `FarmZone.py`)
- Python services: snake_case (e.g., `auth_service.py`, `task_service.py`)
- Test files: `[ComponentName].test.tsx` or `[service_name].test.ts` or `test_[feature].py`

**Functions:**
- TypeScript/React: camelCase (e.g., `getAllUsers()`, `promoteUser()`, `getAnomalySummary()`)
- Python: snake_case (e.g., `register()`, `hash_password()`, `get_completed_tasks()`)

**Variables:**
- TypeScript: camelCase (e.g., `isActive`, `userId`, `taskStatus`)
- Python: snake_case (e.g., `existing_user`, `user_id`, `is_active`)

**Types/Interfaces:**
- PascalCase (e.g., `UserData`, `TaskStatus`, `AlertInfo`, `Worker`)
- Interface prefixes: no "I" prefix convention observed
- Type exports: `export interface Name { ... }` or `export type Name = ...`

**Database Columns (Python Models):**
- PascalCase in model definitions (e.g., `UserId`, `FullName`, `RoleId`, `CreatedAt`)

**Constants:**
- UPPER_SNAKE_CASE for exported constants (e.g., `API_URL`, `BASE_URL`, `ROLE_ROUTES`)
- camelCase for component-level constants (e.g., `PRIORITY_BADGE_STYLES`, `STATUS_STYLES`, `SEVERITY_STYLES`)

## Code Style

**Formatting:**
- No explicit prettier/eslint configuration found in repository
- Default Next.js linting used via `npm run lint`
- Spacing: 2 spaces observed in indentation (TypeScript/React files)

**Import Organization:**
- Order observed in files:
  1. External libraries (e.g., `import { ButtonHTMLAttributes } from 'react'`)
  2. Local types/interfaces (e.g., `import { Task } from '@/types/task'`)
  3. Local components (e.g., `import Badge from '@/components/ui/Badge'`)
  4. Local utilities/services (e.g., `import { extractErrorMessage } from '@/lib/api'`)
  5. Constants/configs (e.g., `import { API_URL } from "@/lib/constants"`)

**Path Aliases:**
- `@/*` maps to `./src/*` (configured in `tsconfig.json`)
- Used consistently across all imports

## Error Handling

**Patterns:**

**TypeScript/React Services:**
```typescript
// API function error handling
export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  try {
    const res = await fetch(`${BASE_URL}${path}`, { ...options });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(extractErrorMessage(err, res.statusText || "Request failed"));
    }
    return res.json() as Promise<T>;
  } catch (error) {
    // Error is thrown up to caller
    throw error;
  }
}

// Function-level error handling with try/catch
export async function getAllUsers(token: string): Promise<UserData[]> {
  const res = await fetch(`${API_URL}/api/users`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.detail ?? "Failed to fetch users.");
  return json;
}
```

**Python FastAPI Routes:**
```python
# Route-level error handling
@router.post("/register", response_model=RegisterResponse, status_code=201)
def register_endpoint(data: RegisterRequest, db: Session = Depends(get_db)):
    try:
        user, error = register(db, data)
        if error:
            if "already registered" in error:
                raise HTTPException(status_code=409, detail=error)
            raise HTTPException(status_code=400, detail=error)
    except OperationalError:
        db.rollback()
        raise HTTPException(status_code=503, detail="Database connection timeout.")
    except HTTPException:
        raise
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Unexpected server error.")
```

**Python Services:**
```python
# Return tuple pattern: (result, error_message)
def register(db: Session, data: RegisterRequest) -> tuple[User | None, str | None]:
    existing = db.query(User).filter(User.Email == data.email).first()
    if existing:
        return None, "Email already registered."
    # ... create and return
    return user, None
```

**Error Messages:**
- User-facing: Descriptive and ending with period (e.g., "Email already registered.")
- API responses: `json.detail` preferred over `json.message`

## Logging

**Framework:** No centralized logging framework observed in code

**Patterns:**
- No structured logging found
- Console/print statements used minimally
- Errors thrown and propagated up the call stack

## Comments

**When to Comment:**
- Rarely used in code
- JSDoc/TSDoc observed in Button component describing variants and sizes:
```typescript
/**
 * Global button primitive — Pepper Farm design system.
 *
 * Variants:
 *   primary   → deep green (#2F6F4E)
 *   secondary → olive green (#6FA36F)
 *   danger    → pepper red (#D64545)
 *   outline   → bordered, transparent bg
 *   ghost     → no border, subtle hover fill
 *
 * Sizes: sm | md (default) | lg
 */
```

**JSDoc/TSDoc:**
- Minimal use; only for complex or public API components
- Format: standard block comment with description of purpose, variants, and options

## Function Design

**Size:** Functions typically 10-50 lines; components 50-150 lines

**Parameters:**
- TypeScript functions: Named parameters preferred (destructuring)
- React components: Props passed as single object with destructuring
- Python functions: Positional + keyword arguments

**Return Values:**
- TypeScript: Explicit Promise types (e.g., `Promise<UserData>`, `Promise<T>`)
- Python services: Tuple pattern for optional errors (e.g., `tuple[User | None, str | None]`)
- React components: JSX.Element (implicit)

**Example:**
```typescript
// Typed generic function
export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T>

// Component with typed props interface
interface TaskCardProps {
  task: Task;
  workers: Worker[];
  onEdit?: (task: Task) => void;
  onStatusChange?: (task: Task, newStatus: TaskStatus) => void;
}

export default function TaskCard({ task, workers, onEdit, onStatusChange }: TaskCardProps)
```

## Module Design

**Exports:**
- Named exports used throughout
- Default exports used for React components
- Services export individual functions, not class instances

**Barrel Files:**
- No barrel file pattern observed
- Direct imports used (e.g., `import { Button } from '@/components/ui/Button'`)

**Example Service Module:** `users.ts`
```typescript
export interface UserData { ... }
export async function getAllUsers(token: string): Promise<UserData[]> { ... }
export async function promoteUser(...): Promise<UserData> { ... }
export async function searchUsers(...): Promise<UserData[]> { ... }
```

## Type Safety

**TypeScript Strictness:**
- `strict: true` in `tsconfig.json`
- All functions have explicit return types
- All parameters should be typed

**Python Type Hints:**
- Used throughout models and services
- Return type hints present on all functions
- Example: `def register(db: Session, data: RegisterRequest) -> tuple[User | None, str | None]:`

---

*Convention analysis: 2026-05-16*
