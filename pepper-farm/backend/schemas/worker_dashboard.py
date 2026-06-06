from pydantic import BaseModel
from typing import Optional


class WorkerAnalyticsResponse(BaseModel):
    openTasksCount: int
    completedTasksCount: int
    avgCompletionTimeHours: Optional[float]
    fastestCompletionTimeHours: Optional[float]
    slowestCompletionTimeHours: Optional[float]
    fastestTaskTitle: Optional[str]
    slowestTaskTitle: Optional[str]
