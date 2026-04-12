from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import tasks, users
import models.role  # noqa: F401
import models.pepper_variety  # noqa: F401
import models.farm_zone  # noqa: F401
import models.user  # noqa: F401
import models.task  # noqa: F401

app = FastAPI(title="PepperFarm API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tasks.router)
app.include_router(users.router)
