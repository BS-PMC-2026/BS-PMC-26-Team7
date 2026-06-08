"""
US37 — Worker Dashboard backend endpoints.

GET  /api/worker/analytics   → KPI stats scoped to the logged-in worker (Worker role required)

Worker identity is always derived from JWT; the frontend must NOT pass workerId.
Task status update and checklist update reuse the existing /api/tasks/* endpoints
which already enforce ownership for the Worker role.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from schemas.worker_dashboard import WorkerAnalyticsResponse
from services.worker_dashboard_service import get_worker_analytics
from utils.jwt import require_role

router = APIRouter(prefix="/api/worker", tags=["Worker Dashboard"])


@router.get("/analytics", response_model=WorkerAnalyticsResponse)
def worker_analytics_endpoint(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("Worker")),
):
    """Return task analytics scoped to the currently authenticated worker."""
    return get_worker_analytics(db, current_user["user_id"])
