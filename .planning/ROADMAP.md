# Roadmap: Pepper Farm — Recurring Anomalies Milestone

## Overview

This milestone delivers recurring anomaly detection for the Pepper Farm platform. Phase 1 builds the backend detection engine that identifies chronic sensor problems. Phase 2 surfaces those detections in the Manager UI so chronic issues are immediately visible at a glance.

## Phases

- [x] **Phase 1: Detection Engine** - Backend detects recurring anomalies by frequency and reappearance after resolution (completed 2026-05-16)
- [ ] **Phase 2: Manager UI** - Managers see recurring anomalies visually distinguished with configurable thresholds

## Phase Details

### Phase 1: Detection Engine
**Goal**: The backend reliably identifies which anomalies are recurring — by frequency within a time window and by reappearance after resolution
**Depends on**: Nothing (first phase)
**Requirements**: RECUR-01, RECUR-02
**Success Criteria** (what must be TRUE):
  1. When the same sensor triggers the same anomaly type N times within a configured window, the system flags it as recurring
  2. When an anomaly is resolved and then the same type reappears on the same sensor, the system flags the new occurrence as a recurrence
  3. Non-recurring anomalies are unaffected — single or rare alerts show no recurrence flag
**Plans**: 3 plans

Plans:
- [ ] 01-01-PLAN.md — Add IsRecurring column to SensorAlert model and create recurrence_config.py constants
- [ ] 01-02-PLAN.md — Create recurrence_detection_service.py and integrate into anomaly detection pipeline
- [ ] 01-03-PLAN.md — Unit tests for recurrence detection service (SQLite in-memory, 11 test cases)

### Phase 2: Manager UI
**Goal**: Managers can immediately distinguish recurring from first-time anomalies — recurring alerts show an amber badge with occurrence count and sort to the top; a filter toggle isolates them instantly
**Depends on**: Phase 1
**Requirements**: RECUR-03, RECUR-04, UI-01, UI-02
**Success Criteria** (what must be TRUE):
  1. Recurring anomalies show a distinct amber badge with occurrence count inline next to the metric name in the Manager anomaly list
  2. A Manager can look at the anomaly list and immediately tell which entries are recurring vs first-time without opening any detail view
  3. RECUR-03 and RECUR-04 satisfied by Phase 1 constants (DEFAULT_RECURRENCE_COUNT, DEFAULT_WINDOW_HOURS) — no config UI in this phase per user decision
**Plans**: 4 plans

Plans:
- [ ] 02-01-PLAN.md — Backend: add get_occurrence_count helper + extend /recent API with isRecurring, occurrenceCount, recurring filter, sort-to-top
- [ ] 02-02-PLAN.md — Frontend contract: add isRecurring + occurrenceCount to RecentAlert type, recurring filter to AlertFilters + service
- [ ] 02-03-PLAN.md — RecurringBadge component (TDD): amber pill badge with ×N text and tooltip
- [ ] 02-04-PLAN.md — Wire: RecurringBadge into table + "Recurring only" toggle in page + human-verify checkpoint

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Detection Engine | 3/3 | Complete    | 2026-05-16 |
| 2. Manager UI | 0/4 | Not started | - |
