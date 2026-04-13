from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import tasks, users
import models.role  # noqa: F401
import models.pepper_variety  # noqa: F401
import models.farm_zone  # noqa: F401
import models.user  # noqa: F401
import models.task  # noqa: F401
import models.plant  # noqa: F401
from database import SessionLocal
from sqlalchemy import text
from routers import peppers
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from routers import peppers, plants

app = FastAPI(title="PepperFarm API", version="1.0.0")

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

app.include_router(tasks.router)
app.include_router(users.router)
app.include_router(peppers.router)
app.include_router(plants.router)

@app.get("/api/health/db")
def db_health():
    db = SessionLocal()
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ok", "database": "connected"}
    finally:
        db.close()