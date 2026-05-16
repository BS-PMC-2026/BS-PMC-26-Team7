---
phase: 02-manager-ui
plan: 04
subsystem: ui
tags: [react, nextjs, typescript, tailwind, anomaly, recurring-badge]

# Dependency graph
requires:
  - phase: 02-manager-ui
    provides: RecurringBadge component (02-03), anomaly service with recurring filter support (02-02)
provides:
  - RecurringBadge rendered inline next to metric name in anomaly table (UI-01)
  - Recurring only toggle filter button on Manager anomaly dashboard (UI-02)
  - filterRecurring state wired to both table and chart fetches
affects: [future-manager-ui-plans, anomaly-dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Conditional filter param: recurring ? true : undefined pattern to avoid sending false to API"
    - "Toggle button with amber active state alongside existing select filters"

key-files:
  created: []
  modified:
    - pepper-farm/frontend/src/components/anomalies/RecentAnomaliesTable.tsx
    - pepper-farm/frontend/src/app/manager/anomalies/page.tsx

key-decisions:
  - "Badge placed inline inside flex span wrapping metricName — gap-1.5 flex-wrap for compact layout"
  - "Recurring only toggle placed leftmost in filter bar before severity and status selects"
  - "filterRecurring ? true : undefined avoids sending false string to backend"

patterns-established:
  - "RecurringBadge: import and render inline next to data cell — null return for non-recurring is safe"
  - "Filter toggle: handleFilterChange() + setFilter toggled together to reset pagination on filter change"

requirements-completed: [UI-01, UI-02]

# Metrics
duration: 8min
completed: 2026-05-16
---

# Phase 2 Plan 04: Manager UI Assembly Summary

**Amber RecurringBadge wired inline into anomaly table metric cell, with Recurring only filter toggle driving both table and chart fetches on the Manager anomaly dashboard**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-05-16T13:16:05Z
- **Completed:** 2026-05-16T13:24:00Z
- **Tasks:** 2 of 3 complete (checkpoint pending human verification)
- **Files modified:** 2

## Accomplishments
- RecurringBadge imported and rendered inline next to metric name in RecentAnomaliesTable — amber pill badge for recurring rows, invisible for non-recurring
- filterRecurring boolean state added to anomaly dashboard page
- Both getRecentAlerts calls (table and chart) updated to pass recurring: true when filter is active
- "Recurring only" toggle button added as leftmost filter control with amber active styling
- loadAlerts dependency array updated to include filterRecurring for proper re-fetch on toggle

## Task Commits

Each task was committed atomically:

1. **Task 1: Render RecurringBadge inline next to metric name** - `6349e158` (feat)
2. **Task 2: Add filterRecurring state and Recurring only toggle** - `0e71bfef` (feat)

**Plan metadata:** pending (awaiting checkpoint resolution)

## Files Created/Modified
- `pepper-farm/frontend/src/components/anomalies/RecentAnomaliesTable.tsx` - Added RecurringBadge import and inline render next to metricName in metric table cell
- `pepper-farm/frontend/src/app/manager/anomalies/page.tsx` - Added filterRecurring state, recurring param to both fetches, dependency array update, Recurring only toggle button

## Decisions Made
- Badge placed inside `<span className="flex items-center gap-1.5 flex-wrap">` to keep layout clean and handle long metric names
- Toggle button uses `handleFilterChange()` before `setFilterRecurring` to reset offset=0 on filter change (same pattern as severity/status selects)
- `filterRecurring ? true : undefined` avoids sending `recurring=false` to the API

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Pre-existing TypeScript errors exist in e2e/ files (missing @playwright/test), src/components/ui/RevealSection.tsx (margin prop), and tests/alertToTask.test.ts — all pre-existing, out of scope for this plan.

Pre-existing Jest test failures in 7 unrelated test suites (DeletePepper, CompletedTasksHistory, EditPepperPage, ManagerPeppersPage, Card, VisitorPage, UserRoleTable) — all pre-existing, unrelated to recurring badge changes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- UI-01 and UI-02 satisfied: recurring badge and filter fully wired
- Awaiting human visual verification (checkpoint Task 3) before plan is finalized
- After checkpoint approval, phase 02-manager-ui is complete

---
*Phase: 02-manager-ui*
*Completed: 2026-05-16*
