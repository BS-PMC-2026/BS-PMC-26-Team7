"""US32: Periodic overdue spray check service.

Runs on a schedule (every 6 hours by default) to identify farm zones that have
not been sprayed within the configured interval and create OverdueSprayAlert
records so the manager can take action.

Overdue rule:
  A zone is overdue if the most-recent completed SprayReport.CompletedAtUtc is
  older than DEFAULT_SPRAY_INTERVAL_DAYS, or if the zone has no completed spray
  history and was created more than DEFAULT_SPRAY_INTERVAL_DAYS ago.

Default: 30 days. Chosen as a reasonable preventive treatment cycle for
greenhouse pepper crops with no existing per-zone or per-pesticide interval.

Duplicate prevention: only one unresolved OverdueSprayAlert per zone is
allowed. If an active alert already exists for a zone the check skips it.
"""

from datetime import datetime, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from database import SessionLocal
from models.farm_zone import FarmZone
from models.spray import OverdueSprayAlert, SprayReport

# Named constant — single source of truth for the overdue threshold.
DEFAULT_SPRAY_INTERVAL_DAYS = 30

# How often the scheduler runs this check.
OVERDUE_CHECK_INTERVAL_HOURS = 6


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _is_sprayable_zone(zone_code: str | None) -> bool:
    """Return True only for zones that are expected to receive spray treatment.

    Matches the same filter used by the worker spray-report form and the US28
    spray map colour logic (rule 14 in PROJECT_CONTEXT.md).
    Non-sprayable zones (SHED-MAIN, VIS-CENTER, FACTORY) must not generate
    overdue alerts — they are not agricultural areas.
    """
    if not zone_code:
        return False
    return (
        zone_code.startswith("GH-")
        or zone_code.startswith("GERM-")
        or zone_code == "NURSERY"
    )


def _compute_overdue_severity(
    now: datetime,
    last_sprayed: datetime | None,
    interval_days: int,
) -> str:
    """Severity based on how far past the threshold the zone is.

    'high'   — overdue by more than 100% extra (> 2× interval)
    'medium' — overdue by more than 50% extra (> 1.5× interval)
    'low'    — just crossed the threshold (≥ 1× interval)
    """
    if last_sprayed is None:
        return "high"
    days_overdue = (now - last_sprayed).days - interval_days
    if days_overdue > interval_days:
        return "high"
    if days_overdue > interval_days // 2:
        return "medium"
    return "low"


def _build_overdue_message(
    zone_name: str,
    zone_code: str,
    last_sprayed: datetime | None,
    interval_days: int,
    now: datetime,
) -> str:
    if last_sprayed is None:
        return (
            f"Zone {zone_code} ({zone_name}) has never been sprayed. "
            f"Preventive treatment is recommended every {interval_days} days."
        )
    days_since = (now - last_sprayed).days
    return (
        f"Zone {zone_code} ({zone_name}) has not been sprayed for {days_since} days "
        f"(threshold: {interval_days} days). Preventive treatment is overdue."
    )


# ---------------------------------------------------------------------------
# Core check logic
# ---------------------------------------------------------------------------

def check_overdue_spray_zones(db: Session) -> int:
    """Inspect all active sprayable zones and create OverdueSprayAlert records
    where the zone is overdue and no active alert already exists.

    Returns the number of new alerts created.
    """
    now = datetime.utcnow()
    interval = DEFAULT_SPRAY_INTERVAL_DAYS
    cutoff = now - timedelta(days=interval)

    # 1. All active zones.
    all_zones = (
        db.query(FarmZone)
        .filter(FarmZone.IsActive == True)  # noqa: E712
        .all()
    )
    sprayable_zones = [z for z in all_zones if _is_sprayable_zone(z.ZoneCode)]

    # 2. Latest completed SprayReport.CompletedAtUtc per zone.
    latest_sub = (
        db.query(
            SprayReport.ZoneId,
            func.max(SprayReport.CompletedAtUtc).label("max_completed"),
        )
        .filter(SprayReport.Status == "completed")
        .group_by(SprayReport.ZoneId)
        .subquery()
    )
    completed_rows = db.query(latest_sub).all()
    last_sprayed_by_zone: dict[int, datetime] = {
        row.ZoneId: row.max_completed for row in completed_rows if row.max_completed is not None
    }

    # 3. Zone IDs that already have an active (unresolved) overdue alert.
    active_alert_zone_ids: set[int] = {
        row[0]
        for row in db.query(OverdueSprayAlert.ZoneId)
        .filter(OverdueSprayAlert.IsResolved == False)  # noqa: E712
        .all()
    }

    created = 0
    for zone in sprayable_zones:
        zid = zone.ZoneId
        last_sprayed = last_sprayed_by_zone.get(zid)

        # Determine if overdue.
        if last_sprayed is None:
            # Never sprayed — overdue after the zone has existed for interval_days.
            is_overdue = (now - zone.CreatedAt).days >= interval
            overdue_since = zone.CreatedAt + timedelta(days=interval)
        else:
            is_overdue = last_sprayed <= cutoff
            overdue_since = last_sprayed + timedelta(days=interval)

        if not is_overdue:
            continue

        # Duplicate guard — skip if active alert already exists.
        if zid in active_alert_zone_ids:
            continue

        severity = _compute_overdue_severity(now, last_sprayed, interval)
        message = _build_overdue_message(
            zone.ZoneName, zone.ZoneCode or "", last_sprayed, interval, now
        )

        alert = OverdueSprayAlert(
            ZoneId=zid,
            ZoneCode=zone.ZoneCode or "",
            ZoneName=zone.ZoneName,
            LastSprayedAtUtc=last_sprayed,
            OverdueSinceUtc=overdue_since,
            SprayIntervalDays=interval,
            Severity=severity,
            Message=message,
            IsRead=False,
            IsResolved=False,
        )
        db.add(alert)
        created += 1

    if created:
        db.commit()

    return created


# ---------------------------------------------------------------------------
# Scheduler entry point
# ---------------------------------------------------------------------------

def run_overdue_check_once() -> dict:
    """Open a DB session, run the overdue check, and return a summary dict.

    Called by APScheduler — must not raise uncaught exceptions so the
    scheduler job stays alive even if the DB is temporarily unavailable.
    """
    db = SessionLocal()
    try:
        created = check_overdue_spray_zones(db)
        return {"status": "ok", "alertsCreated": created}
    except Exception as exc:
        db.rollback()
        return {"status": "error", "error": str(exc)}
    finally:
        db.close()
