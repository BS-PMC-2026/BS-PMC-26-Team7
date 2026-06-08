from fastapi import FastAPI

from fastapi.middleware.cors import CORSMiddleware
from routers import tasks, users, auth, peppers, plants, products, inventory, sensor_readings, sensors, zones, spray, chatbot
from routers.anomalies import router as anomalies_router, resolve_router
from routers.emails import router as emails_router
from routers.newsletter_templates import router as newsletter_templates_router
from routers.email_consent import router as email_consent_router
from routers.notifications import router as notifications_router
from routers.cart import router as cart_router
from routers.checkout import router as checkout_router
from routers.payments import router as payments_router
from routers.coupons import router as coupons_router
from routers.employee_discount import router as employee_discount_router
from routers.orders import router as orders_router
from routers.analytics import router as analytics_router
from routers.worker_dashboard import router as worker_dashboard_router
import models.role  # noqa: F401
import models.pepper_variety  # noqa: F401
import models.farm_zone  # noqa: F401
import models.user  # noqa: F401
import models.task  # noqa: F401
import models.plant  # noqa: F401
import models.product    # noqa: F401
import models.inventory  # noqa: F401
import models.sensor  # noqa: F401  — registers Sensor, SensorAssignment, SensorReading, SensorSyncState, SensorAlert
import models.spray  # noqa: F401  — registers Pesticide, SprayReport, SprayAlert, OverdueSprayAlert
import models.email_log              # noqa: F401  — US39: EmailLogs table
import models.newsletter_template    # noqa: F401  — US39: NewsletterTemplates table
import models.notification           # noqa: F401  — US40: Notifications table
from database import SessionLocal
from sqlalchemy import text
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import services.sensor_auto_sync_service as _sensor_sync
from services.sensor_auto_sync_service import start_sensor_scheduler, stop_sensor_scheduler
from services.overdue_spray_check_service import (
    OVERDUE_CHECK_INTERVAL_HOURS,
    run_overdue_check_once,
)
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    start_sensor_scheduler()
    # US32: add overdue spray check job to the existing scheduler.
    # Access _sensor_sync.scheduler at runtime (after start_sensor_scheduler() has
    # assigned it) rather than at import time, when it is still None.
    if _sensor_sync.scheduler is not None:
        _sensor_sync.scheduler.add_job(
            run_overdue_check_once,
            trigger="interval",
            hours=OVERDUE_CHECK_INTERVAL_HOURS,
            id="overdue_spray_check_job",
            replace_existing=True,
            max_instances=1,
            coalesce=True,
        )
        print(f"[Overdue Spray Check] Job scheduled every {OVERDUE_CHECK_INTERVAL_HOURS} hours.")
    yield
    stop_sensor_scheduler()

app = FastAPI(
    title="Pepper Farm API",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).resolve().parent
UPLOADS_DIR = BASE_DIR / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)
(UPLOADS_DIR / "pepper_images").mkdir(exist_ok=True)
(UPLOADS_DIR / "newsletter_images").mkdir(exist_ok=True)  # US39: newsletter image uploads
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

app.include_router(auth.router)
app.include_router(tasks.router)
app.include_router(users.router)
app.include_router(peppers.router)
app.include_router(plants.router)
app.include_router(products.router)
app.include_router(zones.router)
app.include_router(inventory.router)
app.include_router(sensor_readings.router)
app.include_router(anomalies_router)
app.include_router(resolve_router)
app.include_router(spray.router)
app.include_router(chatbot.router)

app.include_router(sensors.router)
app.include_router(emails_router)
app.include_router(newsletter_templates_router)
app.include_router(email_consent_router)
app.include_router(notifications_router)
app.include_router(cart_router)
app.include_router(checkout_router)
app.include_router(payments_router)
app.include_router(coupons_router)
app.include_router(employee_discount_router)
app.include_router(orders_router)
app.include_router(analytics_router)
app.include_router(worker_dashboard_router)

app.include_router(weather.router)

@app.get("/api/health/db")
def db_health():
    db = SessionLocal()
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ok", "database": "connected"}
    finally:
        db.close()

        