# Roadmap: Pepper Farm — Recurring Anomalies Milestone

## Overview

This milestone delivers recurring anomaly detection for the Pepper Farm platform. Phase 1 builds the backend detection engine that identifies chronic sensor problems. Phase 2 surfaces those detections in the Manager UI so chronic issues are immediately visible at a glance.

## Phases

- [ ] **Phase 1: Detection Engine** - Backend detects recurring anomalies by frequency and reappearance after resolution
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
**Goal**: Managers can immediately distinguish recurring from first-time anomalies and configure detection thresholds without touching code
**Depends on**: Phase 1
**Requirements**: RECUR-03, RECUR-04, UI-01, UI-02
**Success Criteria** (what must be TRUE):
  1. Recurring anomalies show a distinct badge or icon in the Manager anomaly list
  2. A Manager can look at the anomaly list and immediately tell which entries are recurring vs first-time without opening any detail view
  3. Manager can set the minimum occurrence count threshold (globally or per sensor) and it takes effect on new detections
  4. Manager can set the recurrence time window (e.g., last X days) and it takes effect on new detections
**Plans**: TBD

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Detection Engine | 0/3 | Ready to execute | - |
| 2. Manager UI | 0/? | Not started | - |
