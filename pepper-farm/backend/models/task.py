from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

class Task(Base):
    __tablename__ = "Tasks"

    Id               = Column(Integer, primary_key=True, autoincrement=True)
    Title            = Column(String(200), nullable=False)
    Description      = Column(String(1000), nullable=True)
    Status           = Column(String(50), nullable=False, default="todo")
    Priority         = Column(String(50), nullable=False, default="medium")
    TaskType         = Column(String(100), nullable=False)
    CreatedByUserId  = Column(Integer, ForeignKey("Users.UserId"), nullable=False)
    AssignedToUserId = Column(Integer, ForeignKey("Users.UserId"), nullable=True)
    DueDate          = Column(DateTime, nullable=True)
    StartedAt        = Column(DateTime, nullable=True)
    CompletedAt      = Column(DateTime, nullable=True)
    PepperId         = Column(Integer, ForeignKey("PepperVarieties.PepperId"), nullable=True)
    ZoneId           = Column(Integer, ForeignKey("FarmZones.ZoneId"), nullable=True)
    AnomalyId        = Column(Integer, ForeignKey("SensorAlerts.AlertId"), nullable=True)
    CreatedAt        = Column(DateTime, nullable=False, server_default=func.sysdatetime())
    UpdatedAt        = Column(DateTime, nullable=False, server_default=func.sysdatetime())

    created_by  = relationship("User", foreign_keys=[CreatedByUserId], lazy="joined")
    assigned_to = relationship("User", foreign_keys=[AssignedToUserId], lazy="joined")
    zone        = relationship("FarmZone", foreign_keys=[ZoneId], lazy="joined")
    alert       = relationship("SensorAlert", foreign_keys=[AnomalyId], lazy="joined")
    checklist_items = relationship(
        "TaskChecklistItem",
        back_populates="task",
        cascade="all, delete-orphan",
        order_by="TaskChecklistItem.Position",
    )


class TaskChecklistItem(Base):
    __tablename__ = "TaskChecklistItems"

    ItemId      = Column(Integer, primary_key=True, autoincrement=True)
    TaskId      = Column(Integer, ForeignKey("Tasks.Id"), nullable=False)
    Title       = Column(String(200), nullable=False)
    IsCompleted = Column(Boolean, nullable=False, default=False)
    Position    = Column(Integer, nullable=False, default=0)
    CreatedAt   = Column(DateTime, nullable=False, server_default=func.sysdatetime())
    UpdatedAt   = Column(DateTime, nullable=False, server_default=func.sysdatetime())

    task = relationship("Task", back_populates="checklist_items")
