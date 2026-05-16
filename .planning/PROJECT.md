# Pepper Farm

## What This Is

Pepper Farm is an agricultural IoT management platform for a pepper farm operation. It lets farm managers, workers, and visitors monitor sensor data from IoT devices, respond to anomalies, manage tasks, and track plants, peppers, products, and inventory. This milestone adds a **recurring anomalies feature** — the ability to detect when the same type of anomaly keeps happening on a sensor (by frequency within a time window and/or by reappearing after resolution) and surface that visually to managers.

## Core Value

Managers can immediately identify sensors and zones with persistent problems — not just one-off alerts — so chronic issues get prioritized before they damage crops.

## Requirements

### Validated

<!-- Existing capabilities confirmed in codebase -->

- ✓ Role-based access control (Manager, Worker, Visitor) — existing
- ✓ Sensor data ingestion via Atomation IoT API with periodic auto-sync — existing
- ✓ Anomaly detection service that creates alerts from sensor readings — existing
- ✓ Anomaly notifications shown to frontend via AnomalyNotificationContext — existing
- ✓ Anomaly-to-task conversion — existing
- ✓ JWT authentication with 60-minute token expiry — existing
- ✓ Task management with assignment and history — existing
- ✓ Plant, pepper, product, inventory tracking — existing
- ✓ Spray reports and zone management — existing
- ✓ Alert history log — existing

### Active

<!-- New requirements for this milestone -->

- [ ] System detects recurring anomalies — same sensor + same anomaly type appearing N+ times in a configurable time window
- [ ] System detects recurrence after resolution — same anomaly type reappears on a sensor after a previous one was closed/resolved
- [ ] Recurring anomalies are marked with a distinct visual indicator in the Manager anomaly UI
- [ ] Manager can distinguish at a glance which anomalies are recurring vs first-time

### Out of Scope

- Auto-task creation for recurring anomalies — not requested for this milestone
- Escalation / priority changes on recurring anomalies — not requested
- Recurrence visibility for Worker or Visitor roles — Manager-only for now
- Push notifications or email alerts for recurrence — deferred

## Context

- Stack: Next.js 15 + React 19 frontend, FastAPI Python backend, SQLAlchemy ORM, SQL Server/Azure SQL DB
- Anomaly detection lives in `pepper-farm/backend/services/anomaly_detection_service.py`
- Existing `SensorAlert` model in `pepper-farm/backend/models/sensor.py`
- Anomaly UI is in `pepper-farm/frontend/src/app/manager/` (anomaly-related components and pages)
- `AnomalyNotificationContext` handles frontend state for alerts
- CONCERNS.md flags: no centralized logging, CORS allows all origins, no audit logging — these are pre-existing and out of scope

## Constraints

- **Tech stack**: Must stay within existing stack (FastAPI + SQLAlchemy + Next.js + TypeScript)
- **Database**: Schema changes must be SQL Server compatible
- **Auth**: Manager-only visibility — use existing RBAC dependency injection (`require_role`)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Recurrence detection in backend service | Keeps detection logic server-side, consistent with existing anomaly_detection_service pattern | — Pending |
| Visual indicator only (no escalation) | Scope-controlled — simpler first delivery, escalation can be added later | — Pending |
| Manager-only | Workers don't need recurrence context in their workflow yet | — Pending |

---
*Last updated: 2026-05-16 after initialization*
