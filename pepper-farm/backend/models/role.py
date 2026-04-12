from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.sql import func
from database import Base

class Role(Base):
    __tablename__ = "Roles"

    RoleId          = Column(Integer, primary_key=True, autoincrement=True)
    RoleName        = Column(String(50), nullable=False, unique=True)
    RoleDescription = Column(String(255), nullable=True)
    IsActive        = Column(Boolean, nullable=False, default=True)
    CreatedAt       = Column(DateTime, nullable=False, server_default=func.sysutcdatetime())
