from datetime import datetime, timezone

from sqlalchemy import text
from sqlalchemy.orm import Session

from models.user import User
from models.role import Role
from schemas.user import RegisterRequest, LoginRequest
from utils.password import hash_password, verify_password
from utils.jwt import create_token


def register(
    db: Session, data: RegisterRequest
) -> tuple[User | None, str | None]:

    existing = db.query(User).filter(User.Email == data.email).first()
    if existing:
        return None, "Email already registered."

    visitor_role = db.query(Role).filter(Role.RoleName == "Visitor").first()
    if not visitor_role:
        return None, "Default role 'Visitor' not found in database."

    user = User(
        FullName=data.fullName,
        Email=data.email,
        PasswordHash=hash_password(data.password),
        RoleId=visitor_role.RoleId,
        IsActive=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # US40: persist email consent choice from the registration checkbox.
    # Wrapped in try/except so registration never fails when the migration
    # (add_email_consent_to_users.sql + add_email_consent_us40_fields.sql) has
    # not yet been applied to the database.
    if data.emailConsent:
        try:
            now = datetime.now(timezone.utc).replace(tzinfo=None)
            db.execute(
                text("""
                    UPDATE Users
                    SET EmailConsent = 1,
                        EmailMarketingConsentUpdatedAtUtc = :now
                    WHERE UserId = :uid
                """),
                {"now": now, "uid": user.UserId},
            )
            db.commit()
        except Exception:
            db.rollback()   # consent update failed — user still created with DEFAULT 0

    return user, None


def login(
    db: Session, data: LoginRequest
) -> tuple[dict | None, str | None]:

    user = db.query(User).filter(User.Email == data.email).first()
    if not user:
        return None, "Invalid email or password."

    if not verify_password(data.password, user.PasswordHash):
        return None, "Invalid email or password."

    if not user.IsActive:
        return None, "Account is disabled."

    token = create_token({
        "sub":  str(user.UserId),
        "role": user.role.RoleName
    })

    return {
        "accessToken": token,
        "tokenType":   "bearer",
        "role":        user.role.RoleName,
        "fullName":    user.FullName,
    }, None