# Architecture

**Analysis Date:** 2026-05-16

## Pattern Overview

**Overall:** Monorepo with Full-Stack Separation (Frontend/Backend)

**Key Characteristics:**
- Next.js 15 frontend with React 19 using app router (SSR/CSR hybrid)
- FastAPI Python backend with SQLAlchemy ORM
- REST API architecture with CORS-enabled communication
- Role-based access control (RBAC) via JWT authentication
- Database abstraction layer with SQLAlchemy models
- Event-driven anomaly detection and sensor synchronization via APScheduler

## Layers

**Presentation Layer (Frontend):**
- Purpose: User-facing web interface with role-based views (Visitor, Worker, Manager)
- Location: `pepper-farm/frontend/src/`
- Contains: Next.js app router pages, React components, UI primitives, context providers, service adapters
- Depends on: REST API (backend), localStorage (token persistence), Framer Motion (animations), Recharts (visualizations)
- Used by: End users via browser

**API Layer (Backend):**
- Purpose: RESTful endpoint routing and request/response handling
- Location: `pepper-farm/backend/routers/`
- Contains: FastAPI routers organized by domain (auth, users, tasks, peppers, plants, products, inventory, sensors, anomalies, spray, zones)
- Depends on: Services layer, Database layer, Schemas for validation
- Used by: Frontend, external sensor integrations

**Business Logic Layer (Backend):**
- Purpose: Core domain logic, data transformations, external integrations
- Location: `pepper-farm/backend/services/`
- Contains: Services for auth, users, tasks, peppers, plants, products, inventory, sensors, anomalies, spray, automation
- Depends on: Database models, utils (JWT, password, email validation)
- Used by: Routers, scheduled tasks

**Data Layer (Backend):**
- Purpose: ORM models, database access, schema validation
- Location: `pepper-farm/backend/models/` (SQLAlchemy), `pepper-farm/backend/schemas/` (Pydantic)
- Contains: SQLAlchemy declarative models (User, Role, Task, Plant, Pepper, Sensor, etc.), Pydantic request/response schemas
- Depends on: Database connection, SQLAlchemy Base, Pydantic validation
- Used by: Services, Routers, Database migrations

**Persistence Layer:**
- Purpose: Database connection management, session lifecycle
- Location: `pepper-farm/backend/database.py`
- Contains: SQLAlchemy engine, SessionLocal factory, Base class, dependency injection
- Depends on: DATABASE_URL environment variable (supports SQL Server, SQLite)
- Used by: All database-dependent services and routers

**Utilities & Infrastructure:**
- Location: `pepper-farm/backend/utils/`, `pepper-farm/frontend/src/lib/`
- Contains: Password hashing (bcrypt), JWT token creation/validation, constants, error extraction, alert-to-task conversion

## Data Flow

**Authentication Flow:**

1. User submits email/password on login page (`pepper-farm/frontend/src/app/login/`)
2. Frontend calls `loginUser()` from `auth.ts` service
3. Request reaches `POST /api/auth/login` router in `routers/auth.py`
4. Router calls `services/auth_service.py:login()` which verifies credentials and calls `create_token()`
5. Token (JWT) stored in localStorage
6. Subsequent API requests include `Authorization: Bearer <token>` header
7. Protected routers validate token via `Depends()` pattern

**Sensor Data Ingestion & Anomaly Detection:**

1. Sensors push readings to `POST /api/sensor-readings` (from IoT devices or manual sync)
2. `routers/sensor_readings.py` validates and stores in database
3. `SensorAutoSyncScheduler` runs APScheduler job periodically
4. `services/sensor_auto_sync_service.py` calls sensor sync APIs
5. New readings trigger `services/anomaly_detection_service.py` which analyzes patterns
6. Anomalies created in database and pushed to frontend via context notifications
7. Frontend `AnomalyNotificationContext` displays alerts and allows conversion to tasks

**Task Management Flow:**

1. Manager/Worker creates task via form in `pepper-farm/frontend/src/app/manager/tasks/`
2. Form submission calls `services/tasks.ts:createTask()`
3. Request reaches `POST /api/tasks` router in `routers/tasks.py`
4. Router validates with Pydantic schema, calls `services/task_service.py:create_task()`
5. Task stored with status, assigned user, and optional plant/pepper relations
6. Frontend polls or receives real-time updates for status changes
7. Completed tasks stored in history with timestamps

**Component Composition (Frontend):**

1. Page component (e.g., `manager/tasks/page.tsx`) acts as container
2. Page imports feature components (`TaskForm`, `TaskList`, `TaskFilters`)
3. Feature components import UI primitives (`Button`, `Card`, `Modal`, `Alert`)
4. UI primitives handle styling via Tailwind CSS + custom CSS modules
5. Services (`tasks.ts`, `auth.ts`, `api.ts`) handle HTTP communication
6. Context providers (`ToastContext`, `AnomalyNotificationContext`) inject global state

## Key Abstractions

**Router Pattern (Backend):**
- Purpose: Encapsulate API endpoints by domain
- Examples: `routers/auth.py`, `routers/tasks.py`, `routers/sensors.py`
- Pattern: FastAPI APIRouter with prefix, status codes, dependency injection

**Service Layer Pattern (Backend):**
- Purpose: Isolate business logic from HTTP concerns
- Examples: `services/auth_service.py`, `services/task_service.py`, `services/anomaly_detection_service.py`
- Pattern: Pure functions returning tuples `(success_data, error_string)` or single dict

**Model-Schema Separation (Backend):**
- Purpose: Distinguish ORM models from request/response contracts
- Examples: `models/user.py` (SQLAlchemy), `schemas/user.py` (Pydantic)
- Pattern: Models define database structure with relationships, schemas define API contracts

**Service Layer Pattern (Frontend):**
- Purpose: Encapsulate API communication and error handling
- Examples: `services/auth.ts`, `services/tasks.ts`, `services/api.ts`
- Pattern: Async functions with type-safe request/response types, centralized error extraction

**Context Providers (Frontend):**
- Purpose: Share global state without prop drilling
- Examples: `context/ToastContext.tsx`, `context/AnomalyNotificationContext.tsx`
- Pattern: React.createContext with custom hooks (useToast, useAnomalyNotification)

**Role-Based Access Control:**
- Purpose: Restrict features based on user role
- Implementation: JWT token contains role claim, checked in routers and frontend routes
- Roles: Visitor (read-only), Worker (execute tasks), Manager (full control)

## Entry Points

**Frontend:**
- Location: `pepper-farm/frontend/src/app/page.tsx` (landing page) or `login/page.tsx`
- Triggers: User navigates to domain or direct URL
- Responsibilities: Render landing/auth UI, authenticate user, redirect to role-based dashboard

**Backend:**
- Location: `pepper-farm/backend/main.py`
- Triggers: Server startup via `uvicorn main:app --reload`
- Responsibilities: Initialize FastAPI app, register CORS middleware, include all routers, start APScheduler for background tasks, mount static file directory

**Database:**
- Location: `pepper-farm/database/schema/` (SQL scripts), `pepper-farm/database/migrations/` (Alembic)
- Triggers: Initial setup or schema changes
- Responsibilities: Define tables, relationships, constraints, stored procedures, seed data

**Background Jobs:**
- Location: `pepper-farm/backend/services/sensor_auto_sync_service.py`
- Triggers: App lifespan (startup/shutdown events in `main.py`)
- Responsibilities: Schedule periodic sensor data syncing and anomaly detection

## Error Handling

**Strategy:** Layered error handling with context-specific responses

**Patterns:**

Backend Routers (HTTP errors):
```python
try:
    # business logic
except OperationalError:
    raise HTTPException(status_code=503, detail="Database timeout")
except HTTPException:
    raise  # re-raise for FastAPI
except Exception:
    raise HTTPException(status_code=500, detail="Unexpected error")
```

Backend Services (tuple returns):
```python
def operation(db, data):
    if validation_fails:
        return None, "Error message"
    return success_data, None
```

Frontend API calls (error extraction):
```typescript
function extractErrorMessage(err, fallback): string {
  // Handles array validation errors, string details, or message fields
  // Returns human-readable error
}
```

Frontend Components (Toast notifications):
```typescript
try {
  await operation();
  useToast().show({ type: 'success', message: 'Done' });
} catch (e) {
  useToast().show({ type: 'error', message: extractErrorMessage(e) });
}
```

## Cross-Cutting Concerns

**Logging:** Python `logging` module (backend) or `console.log` (frontend) — No centralized logging service detected

**Validation:**
- Backend: Pydantic schemas validate all inputs at router layer
- Frontend: Form libraries handle basic validation; backend validation errors displayed via Toast

**Authentication:**
- JWT tokens created and validated via `python-jose` (backend), stored in localStorage (frontend)
- All protected endpoints require valid token in Authorization header

**Database Connection:**
- SQLAlchemy SessionLocal dependency injection via `Depends(get_db)` in routers
- Automatic session cleanup in finally block

**CORS:**
- Configured globally in `main.py` with allow_origins=["*"] (permissive for development)

**File Uploads:**
- Uploaded files (pepper images) stored in `pepper-farm/backend/uploads/pepper_images/`
- Static files served via FastAPI's StaticFiles mount at `/uploads`

---

*Architecture analysis: 2026-05-16*
