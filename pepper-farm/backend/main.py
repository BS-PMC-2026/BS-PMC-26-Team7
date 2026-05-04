from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import tasks, users, auth, peppers, plants, products, inventory, sensor_readings
from routers.anomalies import router as anomalies_router, resolve_router
from routers import tasks, users, auth, peppers, plants, products, inventory, sensors, zones
import models.role  # noqa: F401
import models.pepper_variety  # noqa: F401
import models.farm_zone  # noqa: F401
import models.user  # noqa: F401
import models.task  # noqa: F401
import models.plant  # noqa: F401
import models.product    # noqa: F401
import models.inventory  # noqa: F401
import models.sensor_reading    # noqa: F401
import models.sensor_assignment  # noqa: F401
import models.pepper_threshold  # noqa: F401
import models.sensor_alert      # noqa: F401
import models.sensor  # noqa: F401
from database import SessionLocal
from sqlalchemy import text
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from routers import peppers, plants, zones
from services.sensor_auto_sync_service import (
    start_sensor_scheduler,
    stop_sensor_scheduler,
)
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    start_sensor_scheduler()
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

app.include_router(sensors.router)

@app.get("/api/health/db")
def db_health():
    db = SessionLocal()
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ok", "database": "connected"}
    finally:
        db.close()

        