from sqlalchemy.orm import Session
from models.user import User
from models.role import Role

def get_workers(db: Session) -> list[User]:
    return (
        db.query(User)
        .join(Role, User.RoleId == Role.RoleId)
        .filter(Role.RoleName == "Worker")
        .all()
    )
