from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, text, case, cast, Date
from sqlalchemy.orm import Session
from sqlalchemy.exc import OperationalError

from database import get_db
from models.sensor import SensorAlert
from models.sensor import SensorAssignment
from models.sensor import SensorReading
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
    zoneName: Optional[str]
    zoneCode: Optional[str]
    plantCode: Optional[str]
    pepperName: Optional[str]


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


@router.get("/recent", response_model=list[RecentAlertResponse])
def get_recent_alerts(
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """
    Returns the most recent sensor alerts enriched with zone, plant,
    and pepper variety names for display in the anomaly table.
    """
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
            .filter(SensorAssignment.IsActive == True)  # noqa: E712
            .order_by(SensorAlert.CreatedAtUtc.desc())
            .limit(limit)
            .all()
        )

        return [
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
                zoneName=zone_name,
                zoneCode=zone_code,
                plantCode=plant_code,
                pepperName=pepper_name,
            )
            for alert, zone_name, zone_code, plant_code, pepper_name in rows
        ]
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
