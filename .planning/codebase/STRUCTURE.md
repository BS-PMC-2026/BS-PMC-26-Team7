# STRUCTURE.md — Directory Layout & Organization

## Overview

Monorepo with a clear frontend/backend/database separation under `pepper-farm/`.

```
BS-PMC-26-Team7/
└── pepper-farm/
    ├── frontend/          # Next.js 15 + React 19 app
    ├── backend/           # FastAPI Python app
    └── database/          # SQL schemas, migrations, seeds
```

---

## Frontend (`pepper-farm/frontend/`)

```
frontend/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── (auth)/             # Login/register routes
│   │   ├── manager/            # Manager role pages
│   │   ├── worker/             # Worker role pages
│   │   └── visitor/            # Visitor role pages
│   ├── components/             # React components, organized by feature
│   │   ├── anomalies/
│   │   ├── sensors/
│   │   ├── tasks/
│   │   ├── peppers/
│   │   └── ui/                 # Shared UI primitives
│   ├── services/               # API client functions (domain.ts)
│   │   ├── auth.ts
│   │   ├── sensors.ts
│   │   ├── anomalies.ts
│   │   └── tasks.ts
│   ├── types/                  # TypeScript type definitions (domain.ts)
│   └── lib/                    # Utilities and helpers
├── __tests__/                  # Jest unit/integration tests (29 files)
├── e2e/                        # Playwright E2E tests
├── public/                     # Static assets
├── next.config.ts
├── jest.config.ts
└── playwright.config.ts
```

### Key Frontend Files

| File | Purpose |
|------|---------|
| `src/app/layout.tsx` | Root layout, providers |
| `src/lib/axios.ts` / `api.ts` | HTTP client configuration |
| `src/types/*.ts` | Domain type definitions |
| `src/services/*.ts` | API call functions |

### Path Aliases

- `@/*` → `./src/*`

---

## Backend (`pepper-farm/backend/`)

```
backend/
├── routers/                    # FastAPI route handlers (13 routers)
│   ├── anomalies.py
│   ├── auth.py
│   ├── peppers.py
│   ├── sensors.py
│   ├── tasks.py
│   └── ...
├── services/                   # Business logic layer
│   ├── sensor_service.py
│   ├── anomaly_detection_service.py
│   └── ...
├── models/                     # SQLAlchemy ORM models
├── schemas/                    # Pydantic request/response schemas
├── utils/                      # Helpers (JWT, password, etc.)
│   ├── jwt.py
│   └── password.py
├── tests/                      # pytest test files
├── main.py                     # FastAPI app entry point
├── database.py                 # DB connection and session
└── requirements.txt
```

### Key Backend Files

| File | Purpose |
|------|---------|
| `main.py` | App factory, router registration |
| `database.py` | SQLAlchemy engine and session |
| `utils/jwt.py` | Token creation/validation |
| `services/anomaly_detection_service.py` | Core detection logic |

---

## Database (`pepper-farm/database/`)

```
database/
├── *.sql                       # Table schemas (Users, Tasks, Sensors, SensorAlerts, ...)
├── migrations/                 # Schema evolution scripts
├── seeds/                      # Seed data for dev/test
└── stored_procedures/          # SQL stored procedures
```

---

## Naming Conventions

### Frontend (TypeScript/React)

| Artifact | Convention | Example |
|----------|-----------|---------|
| Components | PascalCase | `SensorCard.tsx` |
| Services | camelCase | `sensors.ts` |
| Types | camelCase | `sensor.ts` |
| Test files | `*.test.ts(x)` | `SensorCard.test.tsx` |
| E2E tests | `*.spec.ts` | `sensor.spec.ts` |

### Backend (Python)

| Artifact | Convention | Example |
|----------|-----------|---------|
| Files | snake_case | `sensor_service.py` |
| Classes | PascalCase | `SensorReading` |
| Functions | snake_case | `get_sensor_by_id` |
| Routes | kebab-case | `/api/sensor-alerts` |

---

## Adding New Code

### New Frontend Feature

1. Add types to `src/types/<domain>.ts`
2. Add API calls to `src/services/<domain>.ts`
3. Create components in `src/components/<feature>/`
4. Add pages to `src/app/<role>/<feature>/page.tsx`
5. Add tests to `__tests__/<feature>/`

### New Backend Endpoint

1. Add Pydantic schemas to `schemas/<domain>.py`
2. Add business logic to `services/<domain>_service.py`
3. Add route handler to `routers/<domain>.py`
4. Register router in `main.py`
5. Add tests to `tests/test_<domain>.py`

---

*Generated: 2026-05-16*
