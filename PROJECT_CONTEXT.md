# PROJECT_CONTEXT.md

> Navigation map for the Pepper Farm Management System. Read this before touching any file.
> Auto-generated sections are wrapped in `<!-- AUTO-GENERATED-START/END -->` markers.
> Everything outside those markers is manually maintained — do not overwrite.

---

## 1. Project Overview

A full-stack farm management system for a pepper-growing operation. It lets **Farm Managers** monitor IoT sensors in real time, detect anomalies, assign tasks to workers, and manage inventory/products/peppers. **Workers** view their assigned tasks, complete checklists, and submit pesticide spray reports. A public **Visitor** landing page presents farm products.

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS 4 |
| Backend | FastAPI, SQLAlchemy 2.0, Uvicorn |
| Database | Microsoft SQL Server (Azure SQL) via pyodbc |
| IoT | Atomation sensor API (external) |
| Real-time | Server-Sent Events (SSE) via `sse-starlette` |
| Scheduler | APScheduler (sensor auto-sync) |
| Auth | JWT (`python-jose`), `passlib`/`bcrypt` |
| Email | SMTP (Gmail) |
| Testing (BE) | pytest |
| Testing (FE) | Jest + `@testing-library/react`, Playwright (E2E) |
| Deployment | Azure App Service (backend) + Azure Web Apps (frontend) |
| Charts | Recharts |
| Export | html2canvas, jsPDF, xlsx |
| Animations | Framer Motion |

---

## 3. Repository Structure

```
BS-PMC-26-Team7/
├── package.json                     # Root scripts: setup, dev, dev:frontend, dev:backend
├── PROJECT_CONTEXT.md               # This file
├── scripts/
│   └── generate_project_context.py  # Auto-updates AUTO-GENERATED sections below
├── pepper-farm/
│   ├── backend/                     # FastAPI application
│   │   ├── main.py                  # App entry point, router registration, CORS
│   │   ├── database.py              # SQLAlchemy engine + session factory
│   │   ├── models/                  # SQLAlchemy ORM models (one file per domain)
│   │   ├── schemas/                 # Pydantic request/response schemas
│   │   ├── routers/                 # FastAPI route handlers (one file per domain)
│   │   ├── services/                # Business logic layer
│   │   ├── utils/                   # JWT helpers, auth decorators
│   │   ├── tests/                   # pytest test files
│   │   └── requirements.txt
│   ├── frontend/                    # Next.js application
│   │   ├── src/
│   │   │   ├── app/                 # Next.js App Router pages + layouts
│   │   │   ├── components/          # Reusable React components
│   │   │   ├── services/            # API client functions (one file per domain)
│   │   │   ├── types/               # TypeScript interfaces
│   │   │   ├── context/             # React Context (global state)
│   │   │   ├── lib/                 # Utility helpers (alertToTask, constants, etc.)
│   │   │   └── i18n/               # Internationalization config
│   │   ├── tests/                   # Jest unit/integration tests
│   │   ├── e2e/                     # Playwright E2E tests
│   │   └── package.json
│   └── database/
│       ├── schema/                  # CREATE TABLE SQL files
│       ├── migrations/              # Alembic migration files
│       ├── seed/                    # Initial seed data scripts
│       └── procedures/              # SQL stored procedures
```

---

## 4. Frontend Map

| Route | File | Purpose | Key API Calls | Main Components |
|---|---|---|---|---|
| `/` | `src/app/page.tsx` | Visitor landing page | Products, Peppers | LandingNavbar, hero sections |
| `/login` | `src/app/login/page.tsx` | Login | `POST /api/auth/login` | LoginForm |
| `/register` | `src/app/register/page.tsx` | Registration | `POST /api/auth/register` | RegisterForm |
| `/visitor` | `src/app/visitor/page.tsx` | Visitor homepage | Products, Peppers | LandingNavbar |
| `/manager` | `src/app/manager/page.tsx` | Manager dashboard | anomalies summary, zones, trends, tasks | AnomalySummaryCards, RecentAlerts, zone health |
| `/manager/anomalies` | `src/app/manager/anomalies/page.tsx` | Alert management | `/api/manager/anomalies/*` | AnomalySummaryCards, RecentAlerts, SSE stream |
| `/manager/sensors` | `src/app/manager/sensors/page.tsx` | Sensor monitoring | `/api/sensors/*` | SensorCard, SensorMap |
| `/manager/tasks` | `src/app/manager/tasks/page.tsx` | Task management | `/api/tasks/*` | TaskCard, TaskForm, TaskFilters, CompletedTasksHistory |
| `/manager/inventory` | `src/app/manager/inventory/page.tsx` | Inventory management | `/api/inventory/*` | InventoryReport |
| `/manager/map` | `src/app/manager/map/page.tsx` | Farm map (plant assignment) | Zones, Plants | FarmMap |
| `/manager/spray-map` | `src/app/manager/spray-map/page.tsx` | **US28** Spray safety map — zone spray status, last spray date, re-entry windows | `GET /api/spray-reports/zone-map` | SprayZoneMap |
| `/manager/peppers` | `src/app/manager/peppers/page.tsx` | Pepper variety CRUD | `/api/peppers/*` | PepperCard, PepperForm, DeletePepperModal |
| `/manager/products` | `src/app/manager/products/page.tsx` | Product catalog | `/api/products/*` | Product components |
| `/manager/reports` | `src/app/manager/reports/page.tsx` | Reports & export | `/api/tasks/report`, `/api/inventory/report` | ExportModal |
| `/manager/users` | `src/app/manager/users/page.tsx` | User role management | `/api/users/*` | UserRoleTable |
| `/worker` | `src/app/worker/page.tsx` | Worker dashboard | `/api/tasks/my` | Task summary |
| `/worker/my-tasks` | `src/app/worker/my-tasks/page.tsx` | Personal task list | `/api/tasks/my`, checklist endpoints | TaskCard, TaskForm |
| `/worker/spray-report` | `src/app/worker/spray-report/page.tsx` | Spray reporting | `/api/spray-reports/*` | SprayReport form |
| `/worker/inventory` | `src/app/worker/inventory/page.tsx` | View inventory | `/api/inventory/*` | InventoryReport (read-only) |
| `/worker/plants` | `src/app/worker/plants/page.tsx` | View plants | `/api/plants/*` | Plant list |
| `/worker/products` | `src/app/worker/products/page.tsx` | View products | `/api/products/*` | Product list |
| `/manager/spray-alerts` | `src/app/manager/spray-alerts/page.tsx` | **US30** Redirect only — immediately sends to `/manager/spray-map#spray-alerts` (keeps old bookmarks working) | — | — |
| `/manager/spray-map` _(extended)_ | `src/app/manager/spray-map/page.tsx` | **US28 + US30** Spray safety map (zones) + Spray Alert History section (`id="spray-alerts"`) | `GET /api/spray-reports/zone-map`, `GET /api/spray-reports/alerts` | SprayZoneMap, spray-alerts table |
| `/worker/spray-restrictions` | `src/app/worker/spray-restrictions/page.tsx` | **US31** Read-only spray restriction map for workers — shows which zones are currently restricted due to spraying | `GET /api/spray-reports/restricted-zones` | SprayZoneMap, restriction banner, zone table |
| `/visitor/spray-restrictions` | `src/app/visitor/spray-restrictions/page.tsx` | **US31** Read-only spray restriction map for visitors — same safety data, visitor-friendly presentation | `GET /api/spray-reports/restricted-zones` | SprayZoneMap, restriction banner, zone table |

**Proxy architecture:** The frontend calls `/api/...` relative paths. `next.config.ts` rewrites these to `API_PROXY_TARGET` (localhost:8000 in dev, Azure in prod), eliminating CORS.

---

## 5. Backend Map

| Domain | Router | Service | Model | Schema | Prefix |
|---|---|---|---|---|---|
| Auth | `routers/auth.py` | `services/auth_service.py` | `models/user.py` | `schemas/user.py` | `/api/auth` |
| Users | `routers/users.py` | `services/user_service.py` | `models/user.py` | `schemas/user.py` | `/api/users` |
| Tasks | `routers/tasks.py` | `services/task_service.py` | `models/task.py` | `schemas/task.py` | `/api/tasks` |
| Peppers | `routers/peppers.py` | `services/pepper_service.py` | `models/pepper.py` | `schemas/pepper.py` | `/api/peppers` |
| Plants | `routers/plants.py` | `services/plant_service.py` | `models/plant.py` | `schemas/plant.py` | `/api/plants` |
| Products | `routers/products.py` | `services/product_service.py` | `models/product.py` | `schemas/product.py` | `/api/products` |
| Inventory | `routers/inventory.py` | `services/inventory_service.py` | `models/inventory.py` | `schemas/inventory.py` | `/api/inventory` |
| Zones | `routers/zones.py` | _(inline)_ | `models/farm_zone.py` | — | `/api/zones` |
| Sensors | `routers/sensors.py` | `services/sensor_service.py` + `atomation_service.py` | `models/sensor.py` | `schemas/sensor.py` | `/api/sensors` |
| Sensor Readings | `routers/sensor_readings.py` | `services/anomaly_detection_service.py` | `models/sensor_reading.py` | `schemas/sensor_reading.py` | `/api/sensor-readings` |
| Anomalies | `routers/anomalies.py` | `services/recurrence_detection_service.py` | `models/sensor_alert.py` | `schemas/sensor.py` | `/api/manager/anomalies` |
| Sensor Alerts | `routers/anomalies.py` | — | `models/sensor_alert.py` | — | `/api/sensor-alerts` |
| Spray Reports / Map | `routers/spray.py` | `services/spray_service.py` | `models/spray.py` | `schemas/spray.py` | `/api/spray-reports` |
| Health | `main.py` | — | — | — | `/api/health` |

---

## 6. API Endpoint Index

<!-- AUTO-GENERATED-START:endpoints -->
| Method | Path | Router File | Purpose |
|---|---|---|---|
| POST | `/api/auth/login` | `pepper-farm/backend/routers/auth.py` |  |
| POST | `/api/auth/register` | `pepper-farm/backend/routers/auth.py` |  |
| POST | `/api/auth/token` | `pepper-farm/backend/routers/auth.py` |  |
| GET | `/api/health/db` | `pepper-farm/backend/main.py` |  |
| GET | `/api/inventory/by-variety` | `pepper-farm/backend/routers/inventory.py` |  |
| GET | `/api/inventory/report` | `pepper-farm/backend/routers/inventory.py` |  |
| GET | `/api/inventory/{inventory_id}` | `pepper-farm/backend/routers/inventory.py` |  |
| PUT | `/api/inventory/{inventory_id}` | `pepper-farm/backend/routers/inventory.py` |  |
| GET | `/api/inventory` | `pepper-farm/backend/routers/inventory.py` |  |
| POST | `/api/inventory` | `pepper-farm/backend/routers/inventory.py` |  |
| GET | `/api/manager/anomalies/by-zone` | `pepper-farm/backend/routers/anomalies.py` |  |
| GET | `/api/manager/anomalies/recent` | `pepper-farm/backend/routers/anomalies.py` |  |
| GET | `/api/manager/anomalies/recurrence-config` | `pepper-farm/backend/routers/anomalies.py` |  |
| PATCH | `/api/manager/anomalies/recurrence-config` | `pepper-farm/backend/routers/anomalies.py` |  |
| GET | `/api/manager/anomalies/stream` | `pepper-farm/backend/routers/anomalies.py` |  |
| GET | `/api/manager/anomalies/summary` | `pepper-farm/backend/routers/anomalies.py` |  |
| GET | `/api/manager/anomalies/trends` | `pepper-farm/backend/routers/anomalies.py` |  |
| POST | `/api/peppers/upload-image` | `pepper-farm/backend/routers/peppers.py` |  |
| DELETE | `/api/peppers/{pepper_id}` | `pepper-farm/backend/routers/peppers.py` |  |
| GET | `/api/peppers/{pepper_id}` | `pepper-farm/backend/routers/peppers.py` |  |
| PUT | `/api/peppers/{pepper_id}` | `pepper-farm/backend/routers/peppers.py` |  |
| GET | `/api/peppers` | `pepper-farm/backend/routers/peppers.py` |  |
| POST | `/api/peppers` | `pepper-farm/backend/routers/peppers.py` |  |
| PUT | `/api/plants/{plant_id}/location` | `pepper-farm/backend/routers/plants.py` |  |
| GET | `/api/plants/{plant_id}` | `pepper-farm/backend/routers/plants.py` |  |
| GET | `/api/plants` | `pepper-farm/backend/routers/plants.py` |  |
| POST | `/api/plants` | `pepper-farm/backend/routers/plants.py` |  |
| GET | `/api/products/{product_id}` | `pepper-farm/backend/routers/products.py` |  |
| PUT | `/api/products/{product_id}` | `pepper-farm/backend/routers/products.py` |  |
| GET | `/api/products` | `pepper-farm/backend/routers/products.py` |  |
| POST | `/api/products` | `pepper-farm/backend/routers/products.py` |  |
| POST | `/api/sensor-readings` | `pepper-farm/backend/routers/sensor_readings.py` |  |
| POST | `/api/sensors/auto-sync/run-now` | `pepper-farm/backend/routers/sensors.py` |  |
| POST | `/api/sensors/export/email` | `pepper-farm/backend/routers/sensors.py` |  |
| POST | `/api/sensors/sync` | `pepper-farm/backend/routers/sensors.py` |  |
| GET | `/api/sensors/{sensor_id}/alerts` | `pepper-farm/backend/routers/sensors.py` |  |
| GET | `/api/sensors/{sensor_id}/latest` | `pepper-farm/backend/routers/sensors.py` |  |
| POST | `/api/sensors/{sensor_id}/live` | `pepper-farm/backend/routers/sensors.py` |  |
| GET | `/api/sensors/{sensor_id}/readings` | `pepper-farm/backend/routers/sensors.py` |  |
| POST | `/api/sensors/{sensor_id}/refresh` | `pepper-farm/backend/routers/sensors.py` |  |
| GET | `/api/sensors` | `pepper-farm/backend/routers/sensors.py` |  |
| GET | `/api/spray-reports/alerts` | `pepper-farm/backend/routers/spray.py` | **US30** List all spray alerts (FarmManager only) |
| PATCH | `/api/spray-reports/alerts/{alert_id}/read` | `pepper-farm/backend/routers/spray.py` | **US30** Mark a spray alert as read (FarmManager only) |
| GET | `/api/spray-reports/alerts/{alert_id}` | `pepper-farm/backend/routers/spray.py` | **US30** Get a single spray alert by ID (FarmManager only) |
| GET | `/api/spray-reports/pesticides` | `pepper-farm/backend/routers/spray.py` |  |
| GET | `/api/spray-reports/restricted-zones` | `pepper-farm/backend/routers/spray.py` | **US31** All-user restricted zone map (FarmManager, Worker, Visitor) |
| GET | `/api/spray-reports/zone-map` | `pepper-farm/backend/routers/spray.py` |  |
| POST | `/api/spray-reports` | `pepper-farm/backend/routers/spray.py` |  |
| GET | `/api/tasks/completed` | `pepper-farm/backend/routers/tasks.py` |  |
| GET | `/api/tasks/my` | `pepper-farm/backend/routers/tasks.py` |  |
| GET | `/api/tasks/report` | `pepper-farm/backend/routers/tasks.py` |  |
| DELETE | `/api/tasks/{task_id}/checklist/{item_id}` | `pepper-farm/backend/routers/tasks.py` |  |
| PATCH | `/api/tasks/{task_id}/checklist/{item_id}` | `pepper-farm/backend/routers/tasks.py` |  |
| POST | `/api/tasks/{task_id}/checklist` | `pepper-farm/backend/routers/tasks.py` |  |
| PATCH | `/api/tasks/{task_id}` | `pepper-farm/backend/routers/tasks.py` |  |
| GET | `/api/tasks` | `pepper-farm/backend/routers/tasks.py` |  |
| POST | `/api/tasks` | `pepper-farm/backend/routers/tasks.py` |  |
| GET | `/api/users/search` | `pepper-farm/backend/routers/users.py` |  |
| GET | `/api/users/workers` | `pepper-farm/backend/routers/users.py` |  |
| PUT | `/api/users/{user_id}/role` | `pepper-farm/backend/routers/users.py` |  |
| GET | `/api/users` | `pepper-farm/backend/routers/users.py` |  |
| GET | `/api/zones/{zone_code}` | `pepper-farm/backend/routers/zones.py` |  |
| GET | `/api/zones` | `pepper-farm/backend/routers/zones.py` |  |
<!-- AUTO-GENERATED-END:endpoints -->

---

## 7. Database / Models Map

<!-- AUTO-GENERATED-START:models -->
| Model | Table | File | Key Fields | Relationships |
|---|---|---|---|---|
| `FarmZone` | `FarmZones` | `pepper-farm/backend/models/farm_zone.py` |  |  |
| `Inventory` | `Inventory` | `pepper-farm/backend/models/inventory.py` |  |  |
| `PepperEditLog` | `PepperEditLog` | `pepper-farm/backend/models/pepper_edit_log.py` |  |  |
| `PepperVariety` | `PepperVarieties` | `pepper-farm/backend/models/pepper_variety.py` |  |  |
| `Plant` | `Plants` | `pepper-farm/backend/models/plant.py` |  |  |
| `Product` | `Products` | `pepper-farm/backend/models/product.py` |  |  |
| `Role` | `Roles` | `pepper-farm/backend/models/role.py` |  |  |
| `Sensor` | `Sensors` | `pepper-farm/backend/models/sensor.py` |  |  |
| `SensorAssignment` | `SensorAssignments` | `pepper-farm/backend/models/sensor.py` |  |  |
| `SensorReading` | `SensorReadings` | `pepper-farm/backend/models/sensor.py` |  |  |
| `SensorSyncState` | `SensorSyncState` | `pepper-farm/backend/models/sensor.py` |  |  |
| `SensorAlert` | `SensorAlerts` | `pepper-farm/backend/models/sensor.py` |  |  |
| `RecurrenceConfig` | `RecurrenceConfig` | `pepper-farm/backend/models/sensor.py` |  |  |
| `Pesticide` | `Pesticides` | `pepper-farm/backend/models/spray.py` |  |  |
| `SprayReport` | `SprayReports` | `pepper-farm/backend/models/spray.py` |  |  |
| `SprayAlert` | `SprayAlerts` | `pepper-farm/backend/models/spray.py` | SprayAlertId, SprayReportId, ZoneId, Severity (`high\|medium\|low`), IsRead, CreatedAt | FK → SprayReports, FarmZones, Users |
| `Task` | `Tasks` | `pepper-farm/backend/models/task.py` |  |  |
| `TaskChecklistItem` | `TaskChecklistItems` | `pepper-farm/backend/models/task.py` |  |  |
| `User` | `Users` | `pepper-farm/backend/models/user.py` |  |  |
<!-- AUTO-GENERATED-END:models -->

---

## 8. External Interfaces

| Service | Purpose | Env Vars | Key Files |
|---|---|---|---|
| **Atomation IoT API** | Fetches sensor readings from physical devices | `ATOMATION_API_BASE_URL`, `ATOMATION_BEARER_TOKEN`, `ATOMATION_EMAIL`, `ATOMATION_PASSWORD`, `ATOMATION_APP_VERSION`, `ATOMATION_ACCESS_TYPE` | `services/atomation_service.py`, `routers/sensors.py` |
| **Azure SQL Database** | Production database (MSSQL) | `DATABASE_URL` | `database.py` |
| **Azure App Service** | Hosts FastAPI backend in production | — | `.github/workflows/` |
| **Gmail SMTP** | Email export of sensor data | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | `routers/sensors.py` (export/email endpoint) |

**Atomation base URL:** `https://atapi.atomation.net/api/v1/s2s/v1_0`  
**Production backend URL:** `https://hadinerim.azurewebsites.net`

---

## 9. Environment Variables

<!-- AUTO-GENERATED-START:envvars -->
| Variable | Used In (sample) | Purpose |
|---|---|---|
| `API_PROXY_TARGET` | pepper-farm/frontend/next.config.ts |  |
| `ATOMATION_ACCESS_TYPE` | pepper-farm/backend/services/atomation_service.py |  |
| `ATOMATION_API_BASE_URL` | pepper-farm/backend/services/atomation_service.py |  |
| `ATOMATION_APP_VERSION` | pepper-farm/backend/services/atomation_service.py |  |
| `ATOMATION_BEARER_TOKEN` | pepper-farm/backend/services/atomation_service.py |  |
| `ATOMATION_EMAIL` | pepper-farm/backend/services/atomation_service.py |  |
| `ATOMATION_PASSWORD` | pepper-farm/backend/services/atomation_service.py |  |
| `DATABASE_URL` | pepper-farm/backend/database.py |  |
| `NEXT_PUBLIC_API_BASE_URL` | pepper-farm/frontend/next.config.ts, pepper-farm/frontend/src/lib/constants.ts |  |
| `SECRET_KEY` | pepper-farm/backend/utils/jwt.py |  |
| `SMTP_FROM` | pepper-farm/backend/routers/sensors.py |  |
| `SMTP_HOST` | pepper-farm/backend/routers/sensors.py |  |
| `SMTP_PASSWORD` | pepper-farm/backend/routers/sensors.py |  |
| `SMTP_PORT` | pepper-farm/backend/routers/sensors.py |  |
| `SMTP_USER` | pepper-farm/backend/routers/sensors.py |  |
<!-- AUTO-GENERATED-END:envvars -->

---

## 10. Known Project Rules / Decisions

> **Read this section before modifying any business logic.**

1. **Pepper thresholds live in `PepperVarieties`, not `PepperThresholds`.**  
   `PepperThresholds` table/model is deprecated and must not be used. All threshold comparisons in anomaly detection read from `PepperVarieties` (`OptimalTempMinC/MaxC`, `OptimalSoilMoistureMin/Max`, `OptimalPARMin/Max`).

2. **PAR fields exist on `PepperVarieties`.**  
   `OptimalPARMin` and `OptimalPARMax` are valid fields. They were intentionally added and must not be removed.

3. **UV/Sunlight fields must not be reintroduced.**  
   UV and Sunlight sensor fields were removed. Do not add them back.

4. **Atomation is the sole external sensor provider.**  
   All IoT data flows through `services/atomation_service.py`. Do not introduce alternative sensor APIs without updating this service.

5. **Manager sidebar must include a Sensors link.**  
   `ManagerNavbar` must always render a navigation item for `/manager/sensors`. Do not remove it.

6. **Task checklist items must be preserved on task update.**  
   `PATCH /api/tasks/{task_id}` must not delete checklist items as a side effect. Checklist management has its own dedicated endpoints.

7. **RTL/LTR layout must be preserved.**  
   The app supports Hebrew (RTL) and English (LTR). Any layout or CSS change must not break text direction switching.

8. **Authentication uses JWT stored in `localStorage`.**  
   The frontend `apiClient.ts` reads `localStorage.getItem('token')` and attaches it as `Authorization: Bearer`. Do not change the storage key without updating `apiClient.ts`.

9. **Role names are case-sensitive strings: `"Worker"` and `"FarmManager"`.**  
   Backend `require_role()` and frontend role checks compare against these exact strings.

10. **All backend API paths are prefixed with `/api/`.**  
    The Next.js rewrite rule matches `/api/:path*`. Adding non-prefixed routes will bypass the proxy.

11. **`apiFetch` in `src/services/apiClient.ts` is the single HTTP entry point.**  
    All frontend service files must use `apiFetch`, not raw `fetch` or `axios`. It handles deduplication, auth injection, and timeouts.

12. **Sensor auto-sync runs on a schedule via APScheduler.**  
    `services/sensor_auto_sync_service.py` is started in `main.py` lifespan. Do not create competing sync schedulers.

13. **Spray map data comes from `GET /api/spray-reports/zone-map` (FarmManager only).**  
    Safety status is computed live from the most-recent completed `SprayReport` per zone joined to `Pesticide.ReEntryIntervalHours` and `PreHarvestIntervalDays`. Do not duplicate this logic on the frontend. Status values: `safe | unsafe | requires_approval | pending | never_sprayed`.

14. **US28 spray map only colours sprayable zones.**  
    Zones with codes starting `GH-`, `GERM-`, or equal to `NURSERY` receive spray overlays. Non-sprayable zones (SHED-MAIN, VIS-CENTER, FACTORY) are shown in zone-type colour only. This intentionally matches the worker form's zone filter in `SprayReportForm.tsx`.

15. **US30: Every spray report submission generates exactly one `SprayAlert` (best-effort).**  
    `_generate_spray_alert()` is called inside `create_spray_report()` after the report is committed, wrapped in `try/except`. If `SprayAlerts` table is missing (DDL not yet run), the spray report still returns 201 — no crash. Severity: `high` = unverified pesticide, `medium` = completed + within REI window, `low` = planned or past REI.

16. **US30: `SprayAlert` is a separate model from `SensorAlert`.**  
    `SensorAlert` requires sensor-specific fields (SensorId, ReadingId, MetricName, ActualValue) that are incompatible with spray data. Do not merge or reuse `SensorAlert` for spray alerts.

17. **US30: Spray alerts are polled (not SSE) every 30 s via `AnomalyNotificationContext`.**  
    The context polls `GET /api/spray-reports/alerts` on a `sprayPollRef` interval. The bell-panel badge merges `unreadCount` (sensor alerts + tasks) with `sprayUnreadCount`. Do not add a separate SSE stream for spray alerts.

18. **US30: `SprayAlerts` table requires manual DDL in production.**  
    The project has no Alembic auto-migration. Run `pepper-farm/database/schema/SprayAlerts.sql` against the Azure SQL instance before deploying the US30 backend. If spray reports already exist without matching alerts, run `pepper-farm/database/schema/backfill_spray_alerts.sql` once to backfill them.

20. **US31: Restricted-zone map uses the same `ZoneSprayStatusResponse` schema as US28.**  
    `GET /api/spray-reports/restricted-zones` is the all-user (FarmManager, Worker, Visitor) counterpart of the manager-only `GET /api/spray-reports/zone-map`. Both call `get_zone_spray_map()` — auth is the only difference. Worker route: `/worker/spray-restrictions`. Visitor route: `/visitor/spray-restrictions`. The `SprayZoneMap` component is shared; neither page exposes spray-alert management UI.

19. **US30: Spray alert UX lives in the Spray Map page, not a separate route.**  
    The bell-panel "View all" link and each spray-alert item link to `/manager/spray-map#spray-alerts`. The `/manager/spray-alerts` route is a client-side redirect to that anchor. The manager navbar has no separate "Spray Alerts" nav item — alerts are reached via the "Spray Map" link or the bell panel.

---

## 11. Testing Map

| Area | Type | Files | Run Command |
|---|---|---|---|
| Backend — auth | Unit/API | `tests/test_auth_api.py`, `test_login_api.py`, `test_swagger_token.py` | `cd pepper-farm/backend && pytest` |
| Backend — tasks | Unit/API | `tests/test_tasks_api.py`, `test_task_service.py`, `test_get_tasks.py`, `test_completed_tasks.py`, `test_task_report.py` | same |
| Backend — sensors | Unit/API | `tests/test_sensors_api.py`, `test_sensor_service.py`, `test_sensor_readings_api.py`, `test_sensor_auto_sync_service.py`, `test_atomation_service.py` | same |
| Backend — anomalies | Unit/API | `tests/test_anomalies_api.py`, `test_anomaly_detection_service.py`, `test_recurrence_detection_service.py` | same |
| Backend — peppers | Unit/API | `tests/test_create_pepper.py`, `test_update_pepper.py`, `test_delete_pepper.py` | same |
| Backend — inventory | Unit/API | `tests/test_inventory_service.py`, `test_inventory_schema.py`, `test_inventory_report.py` | same |
| Backend — spray | Unit/API | `tests/test_spray_api.py`, `test_spray_service.py` | same |
| Backend — spray alerts | Unit/API | `tests/test_spray_alerts_api.py` (21 tests — list, get, mark-read, role enforcement, graceful failure when table missing) | same |
| Backend — users | Unit/API | `tests/test_users_api.py`, `test_user_service.py` | same |
| Backend — products | Unit/API | `tests/test_create_product_item.py`, `test_product_authorization.py` | same |
| Backend — plants | Unit | `tests/test_plant_service.py` | same |
| Backend — map | Unit | `tests/test_farm_map.py` | same |
| Frontend — components | Jest | `tests/*.test.tsx` (LoginForm, RegisterForm, TaskCard, PepperCard, etc.) | `npm --prefix pepper-farm/frontend run test` |
| Frontend — services | Jest | `tests/*.test.ts` (anomaliesService, sensorsService, tasksService, managerDashboardApi) | same |
| Frontend — integration | Jest | `tests/ManagerDashboard.integration.test.tsx` | same |
| Frontend — E2E | Playwright | `e2e/test_edit_pepper_flow.spec.ts`, `e2e/navbar.spec.ts` | `npx playwright test` (from `pepper-farm/frontend`) |

| Backend — spray map | Unit/API | `tests/test_spray_map_api.py` (12 tests) | same |
| Backend — spray restrictions | Unit/API | `tests/test_spray_restrictions_api.py` (16 tests — role access for Manager/Worker/Visitor, US28 zone-map still 403 for Worker/Visitor, REI logic, sanitisation, insertion-order robustness) | same |
| Frontend — spray alerts redirect | Jest | `tests/SprayAlertsPage.test.tsx` (2 tests — verifies redirect to spray-map#spray-alerts) | `npm --prefix pepper-farm/frontend run test` |
| Frontend — spray map page (US28 + US30) | Jest | `tests/SprayMapPage.test.tsx` (8 tests — zone map title, alerts section loading/empty/list/error) | same |
| Frontend — spray restrictions page (US31) | Jest | `tests/SprayRestrictionsPage.test.tsx` (13 tests — title, loading, map renders, safety notice, summary cards, restricted banner, zone table, status labels, error state, no manager alerts) | same |
| Frontend — manager navbar (US30 additions) | Jest | `tests/ManagerNavbar.test.tsx` (updated — spray map nav link, bell panel spray section, anchor hrefs, badge count) | same |

**Notable gaps:** No backend tests for Zones router. No E2E coverage for worker flows (tasks, spray). No frontend tests for sensor detail views. `tests/test_task_report.py` has 3 pre-existing failures unrelated to US28/29/30 — needs investigation.

---

## 12. Common Commands

```bash
# Install all dependencies (from repo root)
npm run setup

# Run frontend + backend together (from repo root)
npm run dev

# Run frontend only (Next.js on port 3000)
npm run dev:frontend

# Run backend only (FastAPI on port 8000)
npm run dev:backend

# Run backend tests
cd pepper-farm/backend && pytest

# Run backend tests with output
cd pepper-farm/backend && pytest -v

# Run frontend unit tests
npm --prefix pepper-farm/frontend run test

# Run frontend unit tests in watch mode
npm --prefix pepper-farm/frontend run test:watch

# Run Playwright E2E tests
cd pepper-farm/frontend && npx playwright test

# Build frontend for production
npm --prefix pepper-farm/frontend run build

# Regenerate AUTO-GENERATED sections in this file
npm run context:update
# or directly:
python scripts/generate_project_context.py
```

---

## 13. Current Important Files

Files a new agent should read first when starting work:

| File | Why |
|---|---|
| [pepper-farm/backend/main.py](pepper-farm/backend/main.py) | App entry point — router registration, CORS, lifespan hooks |
| [pepper-farm/backend/database.py](pepper-farm/backend/database.py) | DB engine + session dependency |
| [pepper-farm/backend/models/pepper.py](pepper-farm/backend/models/pepper.py) | PepperVariety model — thresholds live here, not in PepperThresholds |
| [pepper-farm/backend/models/sensor_alert.py](pepper-farm/backend/models/sensor_alert.py) | SensorAlert + RecurrenceConfig models |
| [pepper-farm/backend/services/anomaly_detection_service.py](pepper-farm/backend/services/anomaly_detection_service.py) | Core anomaly logic — reads thresholds from PepperVariety |
| [pepper-farm/backend/routers/anomalies.py](pepper-farm/backend/routers/anomalies.py) | All anomaly + SSE endpoints |
| [pepper-farm/frontend/src/services/apiClient.ts](pepper-farm/frontend/src/services/apiClient.ts) | Central HTTP client — all requests go through here |
| [pepper-farm/frontend/src/app/manager/page.tsx](pepper-farm/frontend/src/app/manager/page.tsx) | Manager dashboard — largest and most complex frontend page |
| [pepper-farm/frontend/next.config.ts](pepper-farm/frontend/next.config.ts) | API proxy rewrite rules |
| [pepper-farm/backend/utils/auth.py](pepper-farm/backend/utils/auth.py) | JWT verification + role enforcement decorators |

---

## 14. Last Updated

- **Generated:** 2026-05-23 (US31 added)
- **Method:** Manual initial creation based on full codebase scan; AUTO-GENERATED sections can be refreshed by running `python scripts/generate_project_context.py` from the repo root.
- **To update:** Run `npm run context:update` or `python scripts/generate_project_context.py`. The script rewrites only content between `<!-- AUTO-GENERATED-START:* -->` and `<!-- AUTO-GENERATED-END:* -->` markers. All other sections are left untouched.
