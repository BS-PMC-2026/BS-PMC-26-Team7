from datetime import datetime

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database import Base
from models.pepper_variety import PepperVariety
from services.pepper_service import delete_pepper


SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(SQLALCHEMY_DATABASE_URL)

TestingSessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)


def setup_function():
    Base.metadata.create_all(bind=engine)


def teardown_function():
    Base.metadata.drop_all(bind=engine)


def test_delete_existing_pepper():
    db = TestingSessionLocal()

    pepper = PepperVariety(
        PepperName="Test Pepper",
        IsActive=True,
        CreatedAt=datetime.utcnow(),
    )

    db.add(pepper)
    db.commit()
    db.refresh(pepper)

    deleted = delete_pepper(db, pepper.PepperId)

    assert deleted is not None
    assert deleted.IsActive is False

    db.close()


def test_delete_non_existing_pepper():
    db = TestingSessionLocal()

    deleted = delete_pepper(db, 999)

    assert deleted is None

    db.close()