from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

class User(Base):
    __tablename__ = "Users"

    UserId        = Column(Integer, primary_key=True, autoincrement=True)
    FullName      = Column(String(100), nullable=False)
    Email         = Column(String(100), nullable=False, unique=True)
    PasswordHash  = Column(String(255), nullable=False)
    RoleId        = Column(Integer, ForeignKey("Roles.RoleId"), nullable=False)
    IsActive      = Column(Boolean, nullable=False, default=True)
    CreatedAt     = Column(DateTime, nullable=False, server_default=func.sysutcdatetime())
    # US39: EmailConsent is intentionally NOT mapped as a SQLAlchemy column.
    # In SQLAlchemy 2.0, any nullable mapped column is included in INSERT as NULL
    # even when deferred and never explicitly set — causing "Invalid column name"
    # on SQL Server until the migration is applied.
    # EmailConsent is added to the DB via add_email_consent_to_users.sql (DEFAULT 1).
    # Newsletter/discount routers filter by it using text("Users.EmailConsent = 1")
    # with an OperationalError fallback so existing behaviour is unaffected until
    # the migration runs.

    role = relationship("Role", lazy="joined")
