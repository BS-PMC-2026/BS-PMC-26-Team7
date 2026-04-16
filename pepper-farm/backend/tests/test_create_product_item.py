
import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from database import Base
from models.pepper_variety import PepperVariety
from models.product import Product
from schemas.product import ProductCreate
from services.product_service import create_product


SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(SQLALCHEMY_DATABASE_URL)
@event.listens_for(engine, "connect")
def sqlite_fix(dbapi_connection, connection_record):
    dbapi_connection.create_function("sysutcdatetime", 0, lambda: "2024-01-01 00:00:00")
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def setup_function():
    Base.metadata.create_all(bind=engine)


def teardown_function():
    Base.metadata.drop_all(bind=engine)


def seed_pepper(db):
    pepper = PepperVariety(
        PepperName="Jalapeno",
        ScientificName="Capsicum annuum",
        IsActive=True,
    )
    db.add(pepper)
    db.commit()
    db.refresh(pepper)
    return pepper


def test_create_product_with_valid_pepper_link():
    db = TestingSessionLocal()
    try:
        pepper = seed_pepper(db)

        payload = ProductCreate(
            ProductName="Jalapeno Sauce",
            ProductDescription="Mild green pepper sauce",
            Category="Sauce",
            Price=25.50,
            ImageUrl="https://example.com/jalapeno-sauce.jpg",
            PepperId=pepper.PepperId,
            IsActive=True,
        )

        created = create_product(db, payload)

        assert created.ProductId is not None
        assert created.ProductName == "Jalapeno Sauce"
        assert float(created.Price) == 25.50
        assert created.PepperId == pepper.PepperId
        assert created.IsActive is True
    finally:
        db.close()


def test_create_product_without_pepper_link():
    db = TestingSessionLocal()
    try:
        payload = ProductCreate(
            ProductName="Farm Gift Box",
            ProductDescription="Mixed farm products",
            Category="Gift Box",
            Price=99.00,
            ImageUrl=None,
            PepperId=None,
            IsActive=True,
        )

        created = create_product(db, payload)

        assert created.ProductId is not None
        assert created.PepperId is None
    finally:
        db.close()


def test_create_product_with_missing_pepper_raises_error():
    db = TestingSessionLocal()
    try:
        payload = ProductCreate(
            ProductName="Ghost Pepper Powder",
            ProductDescription="Hot chili powder",
            Category="Spice",
            Price=35.00,
            ImageUrl=None,
            PepperId=9999,
            IsActive=True,
        )

        with pytest.raises(ValueError, match="Linked pepper variety not found."):
            create_product(db, payload)
    finally:
        db.close()