from datetime import datetime
from typing import Literal, Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from services.analytics_service import get_product_statistics, get_task_statistics
from schemas.analytics import ProductStatisticsResponse, TaskStatisticsResponse
from utils.jwt import require_role

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/task-statistics", response_model=TaskStatisticsResponse)
def task_statistics_endpoint(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    worker_id: Optional[int] = None,
    period: Literal["daily", "weekly", "monthly", "yearly"] = "monthly",
    db: Session = Depends(get_db),
    _: dict = Depends(require_role("FarmManager")),
):
    """US45 — Task performance statistics dashboard for FarmManagers."""
    return get_task_statistics(
        db,
        start_date=start_date,
        end_date=end_date,
        worker_id=worker_id,
        period=period,
    )


@router.get("/product-statistics", response_model=ProductStatisticsResponse)
def product_statistics_endpoint(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    period: Literal["daily", "weekly", "monthly", "yearly"] = "monthly",
    db: Session = Depends(get_db),
    _: dict = Depends(require_role("FarmManager")),
):
    """Product / purchase analytics for FarmManagers."""
    return get_product_statistics(
        db,
        start_date=start_date,
        end_date=end_date,
        period=period,
    )
