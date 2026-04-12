from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

class User(Base):
    __tablename__ = "Users"

    UserId       = Column(Integer, primary_key=True, autoincrement=True)
    FullName     = Column(String(100), nullable=False)
    Email        = Column(String(100), nullable=False, unique=True)
    PasswordHash = Column(String(255), nullable=False)
    RoleId       = Column(Integer, ForeignKey("Roles.RoleId"), nullable=False)
    IsActive     = Column(Boolean, nullable=False, default=True)
    CreatedAt    = Column(DateTime, nullable=False, server_default=func.sysutcdatetime())

    role = relationship("Role", lazy="joined")
