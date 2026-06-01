import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import pytest
from datetime import datetime, timedelta
from pydantic import ValidationError
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from database import Base
from models.product import Product
from schemas.product import ProductCreate, ProductResponse
from services.product_service import create_product, update_product


# ── In-memory SQLite setup ────────────────────────────────────────────────────

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


# ── ProductCreate schema validation ──────────────────────────────────────────

def test_valid_active_discount_percentage():
    payload = ProductCreate(
        ProductName="Chili Oil",
        Price=15.0,
        DiscountActive=True,
        DiscountPercentage=20.0,
    )
    assert payload.DiscountPercentage == 20.0
    assert payload.DiscountActive is True


def test_invalid_discount_percentage_below_zero():
    with pytest.raises(ValidationError):
        ProductCreate(ProductName="Test", Price=10.0, DiscountPercentage=-1.0)


def test_invalid_discount_percentage_above_100():
    with pytest.raises(ValidationError):
        ProductCreate(ProductName="Test", Price=10.0, DiscountPercentage=101.0)


def test_active_discount_with_zero_percentage_fails():
    with pytest.raises(ValidationError, match="must be greater than 0"):
        ProductCreate(
            ProductName="Test",
            Price=10.0,
            DiscountActive=True,
            DiscountPercentage=0.0,
        )


def test_end_date_before_start_date_fails():
    now = datetime.utcnow()
    with pytest.raises(ValidationError, match="DiscountEndDate must be after"):
        ProductCreate(
            ProductName="Test",
            Price=10.0,
            DiscountActive=True,
            DiscountPercentage=10.0,
            DiscountStartDate=now,
            DiscountEndDate=now - timedelta(hours=1),
        )


def test_unlimited_discount_is_valid():
    payload = ProductCreate(
        ProductName="Unlimited Deal",
        Price=50.0,
        DiscountActive=True,
        DiscountPercentage=15.0,
        DiscountEndDate=None,
    )
    assert payload.DiscountActive is True
    assert payload.DiscountEndDate is None


def test_inactive_discount_with_zero_percentage_is_valid():
    payload = ProductCreate(
        ProductName="No Discount",
        Price=30.0,
        DiscountActive=False,
        DiscountPercentage=0.0,
    )
    assert payload.DiscountActive is False


# ── ProductResponse discount computation ─────────────────────────────────────

def _resp(**kwargs):
    defaults = {
        "ProductId": 1,
        "ProductName": "Test Product",
        "Price": 100.0,
        "IsActive": True,
        "AllocatedQuantity": 10,
        "DiscountPercentage": 0.0,
        "DiscountActive": False,
        "DiscountStartDate": None,
        "DiscountEndDate": None,
    }
    defaults.update(kwargs)
    return ProductResponse(**defaults)


def test_no_discount_final_price_equals_price():
    r = _resp(Price=50.0)
    assert r.FinalPrice == 50.0
    assert r.DiscountIsCurrentlyValid is False


def test_unlimited_discount_computes_final_price():
    r = _resp(Price=100.0, DiscountActive=True, DiscountPercentage=20.0)
    assert r.DiscountIsCurrentlyValid is True
    assert r.FinalPrice == 80.0


def test_expired_discount_does_not_apply():
    past = datetime.utcnow() - timedelta(hours=1)
    r = _resp(Price=100.0, DiscountActive=True, DiscountPercentage=25.0, DiscountEndDate=past)
    assert r.DiscountIsCurrentlyValid is False
    assert r.FinalPrice == 100.0


def test_future_start_date_discount_not_yet_active():
    future = datetime.utcnow() + timedelta(hours=2)
    r = _resp(Price=100.0, DiscountActive=True, DiscountPercentage=10.0, DiscountStartDate=future)
    assert r.DiscountIsCurrentlyValid is False
    assert r.FinalPrice == 100.0


def test_time_limited_discount_in_range_calculates_price():
    start = datetime.utcnow() - timedelta(hours=1)
    end = datetime.utcnow() + timedelta(hours=1)
    r = _resp(
        Price=200.0,
        DiscountActive=True,
        DiscountPercentage=10.0,
        DiscountStartDate=start,
        DiscountEndDate=end,
    )
    assert r.DiscountIsCurrentlyValid is True
    assert r.FinalPrice == 180.0


def test_inactive_discount_does_not_apply():
    r = _resp(Price=100.0, DiscountActive=False, DiscountPercentage=30.0)
    assert r.DiscountIsCurrentlyValid is False
    assert r.FinalPrice == 100.0


def test_response_includes_all_discount_fields():
    r = _resp(Price=50.0, DiscountActive=True, DiscountPercentage=50.0)
    assert hasattr(r, "DiscountPercentage")
    assert hasattr(r, "DiscountActive")
    assert hasattr(r, "FinalPrice")
    assert hasattr(r, "DiscountIsCurrentlyValid")
    assert r.FinalPrice == 25.0


# ── Service integration tests (with DB) ──────────────────────────────────────

def test_create_product_with_unlimited_discount():
    db = TestingSessionLocal()
    try:
        payload = ProductCreate(
            ProductName="Unlimited Discount Product",
            Price=100.0,
            DiscountActive=True,
            DiscountPercentage=20.0,
        )
        created = create_product(db, payload)
        assert float(created.DiscountPercentage) == 20.0
        assert created.DiscountActive is True
        assert created.DiscountEndDate is None
    finally:
        db.close()


def test_create_product_without_discount():
    db = TestingSessionLocal()
    try:
        payload = ProductCreate(ProductName="Plain Product", Price=40.0)
        created = create_product(db, payload)
        assert created.DiscountActive is False
        assert float(created.DiscountPercentage) == 0.0
    finally:
        db.close()


def test_update_product_with_time_limited_discount():
    db = TestingSessionLocal()
    try:
        payload = ProductCreate(ProductName="Timed Deal Product", Price=50.0)
        created = create_product(db, payload)

        start = datetime.utcnow() - timedelta(hours=1)
        end = datetime.utcnow() + timedelta(days=1)
        update_payload = ProductCreate(
            ProductName="Timed Deal Product",
            Price=50.0,
            DiscountActive=True,
            DiscountPercentage=10.0,
            DiscountStartDate=start,
            DiscountEndDate=end,
        )
        updated = update_product(db, created.ProductId, update_payload)
        assert updated["DiscountActive"] is True
        assert updated["DiscountPercentage"] == 10.0
        assert updated["DiscountStartDate"] is not None
        assert updated["DiscountEndDate"] is not None
    finally:
        db.close()


def test_update_product_clears_discount():
    db = TestingSessionLocal()
    try:
        payload = ProductCreate(
            ProductName="Clear Discount Product",
            Price=80.0,
            DiscountActive=True,
            DiscountPercentage=30.0,
        )
        created = create_product(db, payload)

        clear_payload = ProductCreate(
            ProductName="Clear Discount Product",
            Price=80.0,
            DiscountActive=False,
            DiscountPercentage=0.0,
        )
        updated = update_product(db, created.ProductId, clear_payload)
        assert updated["DiscountActive"] is False
        assert updated["DiscountPercentage"] == 0.0
    finally:
        db.close()


def test_fetch_product_catalog_includes_discount_data():
    from services.product_service import get_products
    db = TestingSessionLocal()
    try:
        payload = ProductCreate(
            ProductName="Catalog Discount Product",
            Price=120.0,
            DiscountActive=True,
            DiscountPercentage=10.0,
        )
        create_product(db, payload)
        products = get_products(db)
        assert len(products) >= 1
        p = next(x for x in products if x["ProductName"] == "Catalog Discount Product")
        assert "DiscountPercentage" in p
        assert "DiscountActive" in p
        assert p["DiscountPercentage"] == 10.0
        assert p["DiscountActive"] is True
    finally:
        db.close()


def test_expired_discount_serializes_without_validity():
    r = _resp(
        Price=100.0,
        DiscountActive=True,
        DiscountPercentage=50.0,
        DiscountEndDate=datetime.utcnow() - timedelta(minutes=5),
    )
    assert r.DiscountIsCurrentlyValid is False
    assert r.FinalPrice == 100.0
