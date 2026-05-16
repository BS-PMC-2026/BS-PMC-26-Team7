---
phase: 02-manager-ui
plan: 01
subsystem: backend-api
tags: [recurrence, api, anomalies, filter, sort]
dependency_graph:
  requires: [01-02, 01-03]
  provides: [isRecurring field in /recent response, occurrenceCount field, recurring filter param]
  affects: [pepper-farm/backend/routers/anomalies.py, pepper-farm/backend/services/recurrence_detection_service.py]
tech_stack:
  added: []
  patterns: [N+1 avoidance for non-recurring rows, nullslast sort for nullable bool]
key_files:
  created: []
  modified:
    - pepper-farm/backend/services/recurrence_detection_service.py
    - pepper-farm/backend/routers/anomalies.py
decisions:
  - "N+1 acceptable at page size 50 for occurrenceCount — only called when IsRecurring=True"
  - "nullslast() used on IsRecurring.desc() to push NULL (non-recurring) rows below True rows"
metrics:
  duration: ~8 minutes
  completed: 2026-05-16
---

# Phase 02 Plan 01: Extend /recent API with recurring alert data Summary

Extended the backend /recent anomaly endpoint to expose `isRecurring` and `occurrenceCount` per alert, with a `recurring=true` filter param and sort-to-top ordering for recurring alerts.

## What Was Built

- `get_occurrence_count(db, sensor_id, metric_name, window_hours)` helper added to `recurrence_detection_service.py` — counts SensorAlert rows for a sensor+metric within a rolling time window
- `RecentAlertResponse` schema extended with `isRecurring: bool` and `occurrenceCount: int`
- `GET /api/manager/anomalies/recent` now accepts `recurring: Optional[bool]` query param
- When `recurring=true`, query filters to `IsRecurring == True` only
- ORDER BY changed to `IsRecurring.desc().nullslast(), CreatedAtUtc.desc()` — recurring alerts always sort above non-recurring
- `occurrenceCount` only calls `get_occurrence_count` when `alert.IsRecurring` is truthy — avoids N+1 for non-recurring rows

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Add get_occurrence_count to recurrence_detection_service.py | ad9b03b1 |
| 2 | Extend /recent endpoint — schema, filter, sort, occurrenceCount population | bb9318c2 |

## Verification

- Import check: `from services.recurrence_detection_service import get_occurrence_count` — OK
- Import check: `from routers.anomalies import router` — OK
- All 462 backend tests pass — no regressions

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- `pepper-farm/backend/services/recurrence_detection_service.py` — FOUND: get_occurrence_count defined
- `pepper-farm/backend/routers/anomalies.py` — FOUND: isRecurring field in RecentAlertResponse
- Commit ad9b03b1 — FOUND
- Commit bb9318c2 — FOUND
- 462 tests pass — VERIFIED
