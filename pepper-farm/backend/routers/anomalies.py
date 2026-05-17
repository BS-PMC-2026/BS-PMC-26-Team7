import asyncio
import json
from datetime import datetime, timedelta, timezone
from typing import Optional
from sse_starlette.sse import EventSourceResponse
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from sqlalchemy import func, text, case, cast, Date
from sqlalchemy.orm import Session
from sqlalchemy.exc import OperationalError
from sse_starlette.sse import EventSourceResponse

from database import get_db
from services.recurrence_detection_service import get_occurrence_count, get_recurrence_config, invalidate_recurrence_config_cache
from models.sensor import SensorAlert, SensorAssignment, SensorReading, RecurrenceConfig
from models.farm_zone import FarmZone
from models.plant import Plant
from models.pepper_variety import PepperVariety

router = APIRouter(prefix="/api/manager/anomalies", tags=["Anomalies"])


# ---------------------------------------------------------------------------
# Pydantic response schemas
# ---------------------------------------------------------------------------

class AnomalySummaryResponse(BaseModel):
    activeAlerts: int
    highSeverity: int
    affectedZones: int
    latestReadingUtc: Optional[str]


class RecentAlertResponse(BaseModel):
    alertId: int
    sensorId: int
    readingId: int
    metricName: str
    actualValue: float
    minAllowed: Optional[float]
    maxAllowed: Optional[float]
    severity: str
    message: str
    isResolved: bool
    createdAtUtc: str
    resolvedAtUtc: Optional[str]
    zoneName: Optional[str]
    zoneCode: Optional[str]
    plantCode: Optional[str]
    pepperName: Optional[str]
    isRecurring: bool
    occurrenceCount: int


class PaginatedAlertResponse(BaseModel):
    total: int
    items: list[RecentAlertResponse]


class TrendPointResponse(BaseModel):
    date: str
    count: int
    highCount: int


class ZoneHealthResponse(BaseModel):
    zoneId: int
    zoneName: str
    zoneCode: Optional[str]
    totalAlerts: int
    highAlerts: int
    health: str  # 'normal' | 'medium' | 'high'


class ResolvedAlertResponse(BaseModel):
    alertId: int
    isResolved: bool
    resolvedAtUtc: Optional[str]


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/summary", response_model=AnomalySummaryResponse)
def get_anomaly_summary(db: Session = Depends(get_db)):
    """
    Returns top-level KPI counts for the manager dashboard:
    - Total unresolved alerts
    - Unresolved High-severity alerts
    - Number of distinct zones with unresolved alerts
    - Timestamp of the most recent sensor reading
    """
    try:
        active_alerts = (
            db.query(func.count(SensorAlert.AlertId))
            .filter(SensorAlert.IsResolved == False)  # noqa: E712
            .scalar() or 0
        )

        high_severity = (
            db.query(func.count(SensorAlert.AlertId))
            .filter(SensorAlert.IsResolved == False, SensorAlert.Severity == "High")  # noqa: E712
            .scalar() or 0
        )

        # Distinct zones with at least one unresolved alert
        affected_zones = (
            db.query(func.count(func.distinct(SensorAssignment.ZoneId)))
            .join(SensorAlert, SensorAlert.SensorId == SensorAssignment.SensorId)
            .filter(
                SensorAssignment.IsActive == True,  # noqa: E712
                SensorAlert.IsResolved == False,    # noqa: E712
            )
            .scalar() or 0
        )

        latest_reading = db.query(func.max(SensorReading.SampleTimeUtc)).scalar()
        latest_str = latest_reading.isoformat() if latest_reading else None

        return AnomalySummaryResponse(
            activeAlerts=active_alerts,
            highSeverity=high_severity,
            affectedZones=affected_zones,
            latestReadingUtc=latest_str,
        )
    except OperationalError:
        raise HTTPException(status_code=503, detail="Database connection timeout.")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/recent", response_model=PaginatedAlertResponse)
def get_recent_alerts(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    since: Optional[datetime] = Query(default=None, description="ISO UTC timestamp — only return alerts created after this time"),
    severity: Optional[str] = Query(default=None, pattern="^(High|Medium)$"),
    status: Optional[str] = Query(default=None, pattern="^(active|resolved|all)$"),
    zone_id: Optional[int] = Query(default=None, ge=1),
    recurring: Optional[bool] = Query(default=None, description="If true, return only recurring alerts"),
    db: Session = Depends(get_db),
):
    """
    Returns paginated sensor alerts enriched with zone, plant, and pepper variety names.
    Supports filtering by severity, status (active/resolved/all), zone, and timestamp.
    """
    try:
        q = (
            db.query(
                SensorAlert,
                FarmZone.ZoneName,
                FarmZone.ZoneCode,
                Plant.PlantCode,
                PepperVariety.PepperName,
            )
            .join(SensorAssignment, SensorAssignment.SensorId == SensorAlert.SensorId)
            .outerjoin(FarmZone, FarmZone.ZoneId == SensorAssignment.ZoneId)
            .outerjoin(Plant, Plant.PlantId == SensorAssignment.PlantId)
            .outerjoin(PepperVariety, PepperVariety.PepperId == SensorAlert.PepperId)
            .filter(
                SensorAssignment.IsActive == True,       # noqa: E712
                SensorAssignment.AssignedToUtc == None,  # noqa: E711
            )
        )
        if since:
            q = q.filter(SensorAlert.CreatedAtUtc > since)
        if severity:
            q = q.filter(SensorAlert.Severity == severity)
        if status == "active":
            q = q.filter(SensorAlert.IsResolved == False)   # noqa: E712
        elif status == "resolved":
            q = q.filter(SensorAlert.IsResolved == True)    # noqa: E712
        if zone_id:
            q = q.filter(SensorAssignment.ZoneId == zone_id)
        if recurring is True:
            q = q.filter(SensorAlert.IsRecurring == True)  # noqa: E712

        total = q.with_entities(func.count(SensorAlert.AlertId)).scalar() or 0
        # SQL Server does not support NULLS LAST syntax — use CASE expression to sort recurring first
        from sqlalchemy import case
        recurring_sort = case((SensorAlert.IsRecurring == True, 0), else_=1)  # noqa: E712
        rows = q.order_by(recurring_sort, SensorAlert.CreatedAtUtc.desc()).limit(limit).offset(offset).all()

        return PaginatedAlertResponse(
            total=total,
            items=[
                RecentAlertResponse(
                    alertId=alert.AlertId,
                    sensorId=alert.SensorId,
                    readingId=alert.ReadingId,
                    metricName=alert.MetricName,
                    actualValue=alert.ActualValue,
                    minAllowed=alert.MinAllowed,
                    maxAllowed=alert.MaxAllowed,
                    severity=alert.Severity,
                    message=alert.Message,
                    isResolved=bool(alert.IsResolved),
                    createdAtUtc=alert.CreatedAtUtc.isoformat(),
                    resolvedAtUtc=alert.ResolvedAtUtc.isoformat() if alert.ResolvedAtUtc else None,
                    zoneName=zone_name,
                    zoneCode=zone_code,
                    plantCode=plant_code,
                    pepperName=pepper_name,
                    isRecurring=bool(alert.IsRecurring) if alert.IsRecurring is not None else False,
                    occurrenceCount=get_occurrence_count(db, alert.SensorId, alert.MetricName) if alert.IsRecurring else 0,
                )
                for alert, zone_name, zone_code, plant_code, pepper_name in rows
            ],
        )
    except OperationalError:
        raise HTTPException(status_code=503, detail="Database connection timeout.")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/trends", response_model=list[TrendPointResponse])
def get_anomaly_trends(
    days: int = Query(default=7, ge=1, le=30),
    db: Session = Depends(get_db),
):
    """
    Returns daily alert counts for the last N days.
    Each point has total count and high-severity count.
    Used to render the trend line chart on the dashboard.
    """
    try:
        cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=days)

        rows = (
            db.query(
                cast(SensorAlert.CreatedAtUtc, Date).label("day"),
                func.count(SensorAlert.AlertId).label("total"),
                func.sum(
                    case((SensorAlert.Severity == "High", 1), else_=0)
                ).label("high_count"),
            )
            .filter(SensorAlert.CreatedAtUtc >= cutoff)
            .group_by(cast(SensorAlert.CreatedAtUtc, Date))
            .order_by(cast(SensorAlert.CreatedAtUtc, Date))
            .all()
        )

        # Build a full date range so missing days appear as zero
        result: list[TrendPointResponse] = []
        existing = {str(r.day): (r.total, r.high_count or 0) for r in rows}
        for i in range(days):
            d = (cutoff + timedelta(days=i + 1)).date()
            key = str(d)
            total, high = existing.get(key, (0, 0))
            result.append(TrendPointResponse(date=key, count=total, highCount=high))

        return result
    except OperationalError:
        raise HTTPException(status_code=503, detail="Database connection timeout.")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/by-zone", response_model=list[ZoneHealthResponse])
def get_zone_health(db: Session = Depends(get_db)):
    """
    Returns all zones that have at least one unresolved alert,
    with a health level: 'high' | 'medium' | 'normal'.
    """
    try:
        rows = (
            db.query(
                FarmZone.ZoneId,
                FarmZone.ZoneName,
                FarmZone.ZoneCode,
                func.count(SensorAlert.AlertId).label("total"),
                func.sum(
                    case((SensorAlert.Severity == "High", 1), else_=0)
                ).label("high_count"),
            )
            .join(SensorAssignment, SensorAssignment.ZoneId == FarmZone.ZoneId)
            .join(SensorAlert, SensorAlert.SensorId == SensorAssignment.SensorId)
            .filter(
                SensorAssignment.IsActive == True,  # noqa: E712
                SensorAlert.IsResolved == False,    # noqa: E712
            )
            .group_by(FarmZone.ZoneId, FarmZone.ZoneName, FarmZone.ZoneCode)
            .order_by(func.count(SensorAlert.AlertId).desc())
            .all()
        )

        result = []
        for zone_id, zone_name, zone_code, total, high_count in rows:
            high = int(high_count or 0)
            health = "high" if high > 0 else "medium" if total > 0 else "normal"
            result.append(ZoneHealthResponse(
                zoneId=zone_id,
                zoneName=zone_name,
                zoneCode=zone_code,
                totalAlerts=total,
                highAlerts=high,
                health=health,
            ))

        return result
    except OperationalError:
        raise HTTPException(status_code=503, detail="Database connection timeout.")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ---------------------------------------------------------------------------
# SSE stream endpoint
# ---------------------------------------------------------------------------

@router.get("/stream")
async def stream_alerts(
    request: Request,
    last_alert_id: int = Query(default=0, description="Highest AlertId the client has seen; server streams rows with AlertId > this value"),
    db: Session = Depends(get_db),
):
    """
    Server-Sent Events endpoint that streams new SensorAlert rows as they appear.
    The client passes last_alert_id (the highest AlertId it has seen).
    The server polls the DB every 2 s and yields new rows as SSE events.

    Note: Authorization header is intentionally not required here because the
    browser EventSource API cannot set custom headers. Manager routes are
    protected at the Next.js navigation level.
    """
    async def event_generator():
        cursor = last_alert_id
        while True:
            if await request.is_disconnected():
                break
            try:
                rows = (
                    db.query(
                        SensorAlert,
                        FarmZone.ZoneName,
                        FarmZone.ZoneCode,
                        Plant.PlantCode,
                        PepperVariety.PepperName,
                    )
                    .join(SensorAssignment, SensorAssignment.SensorId == SensorAlert.SensorId)
                    .outerjoin(FarmZone, FarmZone.ZoneId == SensorAssignment.ZoneId)
                    .outerjoin(Plant, Plant.PlantId == SensorAssignment.PlantId)
                    .outerjoin(PepperVariety, PepperVariety.PepperId == SensorAlert.PepperId)
                    .filter(
                        SensorAssignment.IsActive == True,       # noqa: E712
                        SensorAssignment.AssignedToUtc == None,  # noqa: E711
                        SensorAlert.AlertId > cursor,
                    )
                    .order_by(SensorAlert.AlertId.asc())
                    .limit(20)
                    .all()
                )
                for alert, zone_name, zone_code, plant_code, pepper_name in rows:
                    cursor = alert.AlertId
                    payload = json.dumps({
                        "alertId": alert.AlertId,
                        "sensorId": alert.SensorId,
                        "readingId": alert.ReadingId,
                        "metricName": alert.MetricName,
                        "actualValue": alert.ActualValue,
                        "minAllowed": alert.MinAllowed,
                        "maxAllowed": alert.MaxAllowed,
                        "severity": alert.Severity,
                        "message": alert.Message,
                        "isResolved": bool(alert.IsResolved),
                        "createdAtUtc": alert.CreatedAtUtc.isoformat() if alert.CreatedAtUtc else None,
                        "zoneName": zone_name,
                        "zoneCode": zone_code,
                        "plantCode": plant_code,
                        "pepperName": pepper_name,
                    })
                    yield {"event": "alert", "data": payload}
            except Exception:
                pass  # DB hiccup — retry next cycle
            await asyncio.sleep(2)

    return EventSourceResponse(event_generator())


# ---------------------------------------------------------------------------
# Recurrence configuration endpoints (RECUR-03, RECUR-04)
# ---------------------------------------------------------------------------

class RecurrenceConfigResponse(BaseModel):
    minCount: int
    windowHours: int


class RecurrenceConfigUpdate(BaseModel):
    minCount: Optional[int] = None
    windowHours: Optional[int] = None


@router.get("/recurrence-config", response_model=RecurrenceConfigResponse)
def get_recurrence_config_endpoint(db: Session = Depends(get_db)):
    """Returns the current global recurrence detection thresholds."""
    min_count, window_hours = get_recurrence_config(db)
    return RecurrenceConfigResponse(minCount=min_count, windowHours=window_hours)


@router.patch("/recurrence-config", response_model=RecurrenceConfigResponse)
def update_recurrence_config(payload: RecurrenceConfigUpdate, db: Session = Depends(get_db)):
    """Updates global recurrence detection thresholds (RECUR-03, RECUR-04)."""
    cfg = db.query(RecurrenceConfig).filter(RecurrenceConfig.ConfigId == 1).first()
    if not cfg:
        cfg = RecurrenceConfig(ConfigId=1, MinCount=3, WindowHours=24)
        db.add(cfg)
    if payload.minCount is not None:
        cfg.MinCount = payload.minCount
    if payload.windowHours is not None:
        cfg.WindowHours = payload.windowHours
    db.commit()
    db.refresh(cfg)
    invalidate_recurrence_config_cache()
    return RecurrenceConfigResponse(minCount=cfg.MinCount, windowHours=cfg.WindowHours)


# ---------------------------------------------------------------------------
# Resolve endpoint (separate prefix)
# ---------------------------------------------------------------------------

resolve_router = APIRouter(prefix="/api/sensor-alerts", tags=["Anomalies"])


@resolve_router.patch("/{alert_id}/resolve", response_model=ResolvedAlertResponse)
def resolve_alert(alert_id: int, db: Session = Depends(get_db)):
    """
    Marks a sensor alert as resolved. Idempotent — resolving an already-resolved
    alert returns the existing record unchanged.
    """
    try:
        alert = db.query(SensorAlert).filter(SensorAlert.AlertId == alert_id).first()
        if not alert:
            raise HTTPException(status_code=404, detail=f"Alert {alert_id} not found.")

        if not alert.IsResolved:
            alert.IsResolved = True
            alert.ResolvedAtUtc = datetime.now(timezone.utc).replace(tzinfo=None)
            db.commit()
            db.refresh(alert)

        return ResolvedAlertResponse(
            alertId=alert.AlertId,
            isResolved=bool(alert.IsResolved),
            resolvedAtUtc=alert.ResolvedAtUtc.isoformat() if alert.ResolvedAtUtc else None,
        )
    except HTTPException:
        raise
    except OperationalError:
        db.rollback()
        raise HTTPException(status_code=503, detail="Database connection timeout.")
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(exc))
