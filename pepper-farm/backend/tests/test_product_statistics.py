"""
Product / Purchase Statistics: unit tests for get_product_statistics service.
Uses an in-memory SQLite DB (no SQL Server required).
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from datetime import datetime, timedelta
from decimal import Decimal

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database import Base
from models.role import Role
from models.user import User
from models.order import Order, OrderItem
from services.analytics_service import get_product_statistics

# ── DB setup ──────────────────────────────────────────────────────────────────

SQLALCHEMY_TEST_URL = "sqlite:///:memory:"
engine = create_engine(SQLALCHEMY_TEST_URL, connect_args={"check_same_thread": False})
TestSession = sessionmaker(bind=engine)

ROLE_ID  = 1
BUYER_A  = 10
BUYER_B  = 11

NOW = datetime(2026, 6, 1, 12, 0, 0)


@pytest.fixture()
def db():
    Base.metadata.create_all(bind=engine)
    session = TestSession()

    session.add(Role(RoleId=ROLE_ID, RoleName="FarmManager", IsActive=True, CreatedAt=NOW))
    session.add_all([
        User(UserId=BUYER_A, FullName="Alice Buyer", Email="alice@shop.com", PasswordHash="x", RoleId=ROLE_ID, IsActive=True, CreatedAt=NOW),
        User(UserId=BUYER_B, FullName="Bob Buyer",   Email="bob@shop.com",   PasswordHash="x", RoleId=ROLE_ID, IsActive=True, CreatedAt=NOW),
    ])
    session.commit()

    yield session

    session.close()
    Base.metadata.drop_all(bind=engine)


def _order(session, *, order_id, user_id=BUYER_A, status="paid",
           total=100.0, created=None, num=None) -> Order:
    o = Order(
        OrderId=order_id,
        UserId=user_id,
        OrderNumber=num or f"ORD-{order_id:04d}",
        Status=status,
        Subtotal=Decimal(str(total)),
        ProductDiscountTotal=Decimal("0"),
        EmployeeDiscountTotal=Decimal("0"),
        CouponDiscountTotal=Decimal("0"),
        TotalAmount=Decimal(str(total)),
        Currency="ILS",
        PaymentMethod="mock_credit_card",
        CreatedAtUtc=created or NOW,
        PaidAtUtc=created or NOW if status == "paid" else None,
    )
    session.add(o)
    session.commit()
    return o


def _item(session, *, order_id, name="Pepper Oil", qty=1,
          unit_price=50.0, line_total=None) -> OrderItem:
    lt = line_total if line_total is not None else unit_price * qty
    i = OrderItem(
        OrderId=order_id,
        ProductId=None,
        ProductNameSnapshot=name,
        UnitPriceOriginal=Decimal(str(unit_price)),
        UnitPriceAfterProductDiscount=Decimal(str(unit_price)),
        UnitPriceAfterEmployeeDiscount=Decimal(str(unit_price)),
        Quantity=qty,
        LineSubtotal=Decimal(str(lt)),
        LineDiscountTotal=Decimal("0"),
        LineTotal=Decimal(str(lt)),
    )
    session.add(i)
    session.commit()
    return i


# ── 1. Empty DB ───────────────────────────────────────────────────────────────

def test_empty_db_returns_zeros(db):
    result = get_product_statistics(db)
    s = result.summary
    assert s.total_orders == 0
    assert s.total_revenue == 0.0
    assert s.total_units_sold == 0
    assert s.avg_order_value == 0.0
    assert s.unique_buyers == 0
    assert s.best_selling_product is None
    assert s.cheapest_sold_product is None
    assert s.most_expensive_sold_product is None
    assert result.best_selling_products == []
    assert result.revenue_by_period == []
    assert result.recent_orders == []


# ── 2. Only paid orders counted ───────────────────────────────────────────────

def test_cancelled_orders_excluded(db):
    _order(db, order_id=1, status="paid",      total=100.0)
    _order(db, order_id=2, status="cancelled", total=50.0)
    _order(db, order_id=3, status="failed",    total=30.0)

    result = get_product_statistics(db)
    assert result.summary.total_orders == 1
    assert result.summary.total_revenue == 100.0


# ── 3. Revenue calculation ────────────────────────────────────────────────────

def test_revenue_sums_all_paid_orders(db):
    _order(db, order_id=1, total=150.0)
    _order(db, order_id=2, total=250.0)

    result = get_product_statistics(db)
    assert result.summary.total_revenue == 400.0


# ── 4. Units sold ─────────────────────────────────────────────────────────────

def test_units_sold_sums_order_items(db):
    _order(db, order_id=1, total=100.0)
    _item(db, order_id=1, name="Pepper Oil", qty=3)
    _item(db, order_id=1, name="Hot Sauce",  qty=2)

    result = get_product_statistics(db)
    assert result.summary.total_units_sold == 5


# ── 5. Average order value ────────────────────────────────────────────────────

def test_avg_order_value(db):
    _order(db, order_id=1, total=100.0)
    _order(db, order_id=2, total=200.0)

    result = get_product_statistics(db)
    assert result.summary.avg_order_value == 150.0


# ── 6. Unique buyers ──────────────────────────────────────────────────────────

def test_unique_buyers_counted(db):
    _order(db, order_id=1, user_id=BUYER_A)
    _order(db, order_id=2, user_id=BUYER_A)
    _order(db, order_id=3, user_id=BUYER_B)

    result = get_product_statistics(db)
    assert result.summary.unique_buyers == 2


# ── 7. Best selling product ───────────────────────────────────────────────────

def test_best_selling_product(db):
    _order(db, order_id=1, total=100.0)
    _item(db, order_id=1, name="Pepper Oil", qty=5, unit_price=20.0)
    _item(db, order_id=1, name="Hot Sauce",  qty=2, unit_price=50.0)

    result = get_product_statistics(db)
    assert result.summary.best_selling_product == "Pepper Oil"


# ── 8. Best selling products table ───────────────────────────────────────────

def test_best_selling_products_table(db):
    _order(db, order_id=1, total=200.0)
    _item(db, order_id=1, name="Pepper Oil", qty=4, unit_price=20.0, line_total=80.0)
    _item(db, order_id=1, name="Hot Sauce",  qty=2, unit_price=60.0, line_total=120.0)

    result = get_product_statistics(db)
    assert len(result.best_selling_products) == 2
    # Sorted by units sold descending
    assert result.best_selling_products[0].product_name == "Pepper Oil"
    assert result.best_selling_products[0].units_sold == 4
    assert result.best_selling_products[1].product_name == "Hot Sauce"


# ── 9. Cheapest and most expensive ───────────────────────────────────────────

def test_cheapest_and_most_expensive(db):
    _order(db, order_id=1, total=200.0)
    _item(db, order_id=1, name="Cheap Sauce",     qty=1, unit_price=10.0)
    _item(db, order_id=1, name="Premium Oil",     qty=1, unit_price=200.0)
    _item(db, order_id=1, name="Mid Range Spice", qty=1, unit_price=50.0)

    result = get_product_statistics(db)
    assert result.summary.cheapest_sold_product == "Cheap Sauce"
    assert result.summary.most_expensive_sold_product == "Premium Oil"


def test_zero_price_excluded_from_extremes(db):
    _order(db, order_id=1, total=100.0)
    # Product with zero price should be excluded from cheapest/most expensive
    _item(db, order_id=1, name="Free Sample", qty=1, unit_price=0.0)
    _item(db, order_id=1, name="Real Product", qty=1, unit_price=50.0)

    result = get_product_statistics(db)
    # Zero-price product excluded; only Real Product has valid price
    assert result.summary.cheapest_sold_product == "Real Product"
    assert result.summary.most_expensive_sold_product == "Real Product"


# ── 10. Date range filter ─────────────────────────────────────────────────────

def test_date_range_filter(db):
    may1  = datetime(2026, 5, 1)
    may15 = datetime(2026, 5, 15)
    june1 = datetime(2026, 6, 1)

    _order(db, order_id=1, total=100.0, created=may1)
    _order(db, order_id=2, total=200.0, created=may15)
    _order(db, order_id=3, total=300.0, created=june1)

    result = get_product_statistics(db, start_date=may1, end_date=may15)
    assert result.summary.total_orders == 2
    assert result.summary.total_revenue == 300.0


def test_date_range_end_only(db):
    _order(db, order_id=1, total=100.0, created=datetime(2026, 4, 1))
    _order(db, order_id=2, total=200.0, created=datetime(2026, 6, 1))

    result = get_product_statistics(db, end_date=datetime(2026, 5, 1))
    assert result.summary.total_orders == 1
    assert result.summary.total_revenue == 100.0


# ── 11. Revenue by period ─────────────────────────────────────────────────────

def test_revenue_by_period_monthly(db):
    _order(db, order_id=1, total=100.0, created=datetime(2026, 4, 15))
    _order(db, order_id=2, total=200.0, created=datetime(2026, 5, 10))
    _order(db, order_id=3, total=50.0,  created=datetime(2026, 5, 20))

    result = get_product_statistics(db, period="monthly")
    period_map = {r.period: r for r in result.revenue_by_period}
    assert period_map["2026-04"].revenue == 100.0
    assert period_map["2026-04"].orders == 1
    assert period_map["2026-05"].revenue == 250.0
    assert period_map["2026-05"].orders == 2


def test_revenue_by_period_yearly(db):
    _order(db, order_id=1, total=100.0, created=datetime(2025, 3, 1))
    _order(db, order_id=2, total=200.0, created=datetime(2026, 6, 1))

    result = get_product_statistics(db, period="yearly")
    periods = {r.period: r.revenue for r in result.revenue_by_period}
    assert periods["2025"] == 100.0
    assert periods["2026"] == 200.0


# ── 12. Recent orders ────────────────────────────────────────────────────────

def test_recent_orders_returns_up_to_10(db):
    for i in range(1, 13):
        _order(db, order_id=i, total=10.0, created=datetime(2026, 1, i))

    result = get_product_statistics(db)
    assert len(result.recent_orders) == 10


def test_recent_orders_sorted_by_date_desc(db):
    _order(db, order_id=1, total=10.0, created=datetime(2026, 5, 1))
    _order(db, order_id=2, total=10.0, created=datetime(2026, 6, 1))

    result = get_product_statistics(db)
    assert result.recent_orders[0].order_id == 2  # more recent first


def test_recent_orders_include_buyer_name(db):
    _order(db, order_id=1, user_id=BUYER_A, total=10.0)

    result = get_product_statistics(db)
    assert result.recent_orders[0].buyer_name == "Alice Buyer"


# ── 13. Revenue by period includes units sold ────────────────────────────────

def test_revenue_by_period_includes_units_sold(db):
    created = datetime(2026, 5, 1)
    _order(db, order_id=1, total=100.0, created=created)
    _item(db, order_id=1, name="Pepper Oil", qty=3, unit_price=20.0, line_total=60.0)
    _item(db, order_id=1, name="Hot Sauce",  qty=2, unit_price=20.0, line_total=40.0)

    result = get_product_statistics(db, period="monthly")
    may = next(r for r in result.revenue_by_period if r.period == "2026-05")
    assert may.units_sold == 5
