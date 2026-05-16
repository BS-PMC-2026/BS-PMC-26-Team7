# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-16)

**Core value:** Managers can immediately identify sensors and zones with persistent problems so chronic issues get prioritized before they damage crops.
**Current focus:** Phase 2 — Manager UI

## Current Position

Phase: 2 of 2 (Manager UI)
Plan: 3 of ? in current phase
Status: In progress
Last activity: 2026-05-16 — Completed 02-03 (RecurringBadge TDD component)

Progress: [█████░░░░░] 50%

## Performance Metrics

**Velocity:**
- Total plans completed: 4
- Average duration: ~7 minutes
- Total execution time: ~26 minutes

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-detection-engine | 3 | ~18m | ~6m |
| 02-manager-ui | 3 | ~26m | ~9m |

**Recent Trend:**
- Last 5 plans: 01-01, 01-02, 01-03, 02-01, 02-02, 02-03
- Trend: stable

*Updated after each plan completion*
| Phase 02-manager-ui P03 | 10 | 2 tasks | 2 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Recurrence detection in backend service (consistent with existing anomaly_detection_service pattern)
- Visual indicator only — no escalation or priority changes
- Manager-only visibility — Workers excluded from recurrence context
- flush-check-flag-commit pattern: db.flush() to assign AlertIds, check_recurrence per alert, set IsRecurring, single db.commit()
- IsRecurring only set to True explicitly — model default=False handles non-recurring cases
- Import all FK-chain models in test files (role, pepper_variety, farm_zone, user, plant, sensor) to avoid NoReferencedTableError during SQLAlchemy create_all
- [Phase 02-manager-ui]: N+1 acceptable at page size 50 for occurrenceCount — only called when IsRecurring=True
- [Phase 02-manager-ui]: nullslast() used on IsRecurring.desc() to push NULL rows below True rows
- [Phase 02-manager-ui]: RecurringBadge is self-contained (no Badge.tsx composition), uses native title tooltip, defaults windowHours=168

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-05-16
Stopped at: Completed 02-03-PLAN.md — RecurringBadge component TDD
Resume file: None
