from pydantic import BaseModel, field_validator
from datetime import datetime
from typing import Optional

ALLOWED_PRIORITIES = {"low", "medium", "high", "critical"}

class CreateTaskRequest(BaseModel):
    title: str
    taskType: str
    description: Optional[str] = None
    priority: str = "medium"
    assignedToUserId: Optional[int] = None
    dueDate: Optional[datetime] = None
    pepperId: Optional[int] = None
    zoneId: Optional[int] = None

    @field_validator("title")
    @classmethod
    def title_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Title is required.")
        return v

    @field_validator("taskType")
    @classmethod
    def task_type_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("TaskType is required.")
        return v

class TaskResponse(BaseModel):
    id: int
    title: str
    description: Optional[str]
    status: str
    priority: str
    taskType: str
    createdByUserId: int
    assignedToUserId: Optional[int]
    dueDate: Optional[datetime]
    startedAt: Optional[datetime]
    completedAt: Optional[datetime]
    pepperId: Optional[int]
    zoneId: Optional[int]
    zoneCode: Optional[str]
    createdAt: datetime
    updatedAt: datetime

    model_config = {"from_attributes": True}
