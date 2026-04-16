from sqlalchemy.orm import Session
from models.user import User
from models.role import Role


def get_all_users(db: Session) -> list[User]:
    return db.query(User).order_by(User.FullName.asc()).all()


def get_user_by_id(db: Session, user_id: int) -> User | None:
    return db.query(User).filter(User.UserId == user_id).first()


def promote_user(db: Session, user_id: int, role_id: int) -> tuple[User | None, str | None]:
    user = get_user_by_id(db, user_id)
    if user is None:
        return None, "User not found."

    role = db.query(Role).filter(Role.RoleId == role_id).first()
    if role is None:
        return None, "Role not found."

    user.RoleId = role_id
    db.commit()
    db.refresh(user)
    return user, None


def search_users_by_name(db: Session, name: str) -> list[User]:
    return db.query(User).filter(
        User.FullName.ilike(f"%{name}%")
    ).order_by(User.FullName.asc()).all()