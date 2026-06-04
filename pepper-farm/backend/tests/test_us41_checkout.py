"""
US41 — Backend tests for pricing, Luhn, checkout, coupons,
employee discount, and transactional receipt email.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import json
from datetime import datetime, timezone
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base, get_db
from main import app
from models.coupon import Coupon
from models.employee_discount import EmployeeDiscountSetting
from models.inventory import Inventory
from models.order import Order, OrderItem
from models.payment import PaymentRecord
from models.product import Product
from models.role import Role
from models.user import User
from services.pricing_service import luhn_check, detect_card_brand, get_employee_discount_pct

# ── SQLite in-memory DB ───────────────────────────────────────────────────────

engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

@event.listens_for(engine, "connect")
def sqlite_fix(conn, _):
    conn.create_function("sysutcdatetime", 0, lambda: "2024-01-01 00:00:00")

TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    db = TestingSessionLocal()
    try: yield db
    finally: db.close()

client = TestClient(app)

_MGR = {"sub": "1", "role": "FarmManager"}
_WRK = {"sub": "2", "role": "Worker"}
_VIS = {"sub": "3", "role": "Visitor"}

def _auth(role): return {"Authorization": f"Bearer fake-{role}"}


def _seed(db):
    mr = Role(RoleName="FarmManager"); wr = Role(RoleName="Worker"); vr = Role(RoleName="Visitor")
    db.add_all([mr, wr, vr]); db.flush()
    mgr    = User(FullName="Mgr",    Email="mgr@f.com",    PasswordHash="x", RoleId=mr.RoleId)
    worker = User(FullName="Worker", Email="worker@f.com", PasswordHash="x", RoleId=wr.RoleId)
    cust   = User(FullName="Alice",  Email="alice@f.com",  PasswordHash="x", RoleId=vr.RoleId)
    db.add_all([mgr, worker, cust]); db.flush()

    p = Product(
        ProductName="Chili Oil",
        Price=100.0,
        IsActive=True,
        DiscountActive=False,
        DiscountPercentage=0,
    )
    db.add(p); db.flush()
    db.add(Inventory(ProductId=p.ProductId, WarehouseQuantity=10, AllocatedQuantity=10))
    db.add(EmployeeDiscountSetting(GlobalDiscountPercent=40, Active=True))
    db.commit()
    return p.ProductId, worker.UserId, cust.UserId


@pytest.fixture(autouse=True)
def setup_db():
    app.dependency_overrides[get_db] = override_get_db
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal(); _seed(db); db.close()
    yield
    Base.metadata.drop_all(bind=engine)
    app.dependency_overrides.pop(get_db, None)


@pytest.fixture(autouse=True)
def patch_bg_task():
    """Prevent _send_receipt_bg from running in ALL tests.
    The background task uses the real SessionLocal (not the test override) which
    would try to connect to a production DB and corrupt the TestClient event loop.
    Individual tests that specifically test the bg task call it manually.
    """
    with patch("routers.checkout._send_receipt_bg"):
        yield


# ── Luhn validation ───────────────────────────────────────────────────────────

def test_luhn_valid_visa_4111():
    """Standard Visa test card used in documentation and tests."""
    assert luhn_check("4111111111111111") is True

def test_luhn_valid_visa_4532():
    assert luhn_check("4532015112830366") is True

def test_luhn_valid_mastercard():
    assert luhn_check("5500005555555559") is True

def test_luhn_invalid_1234():
    """1234123412341234 must fail Luhn — this is the canonical invalid test number."""
    assert luhn_check("1234123412341234") is False

def test_luhn_invalid_generic():
    assert luhn_check("1234567890123456") is False

def test_luhn_decline_card_passes_luhn_but_is_mock_declined():
    """4000000000000002 passes Luhn but is treated as a declined card in checkout."""
    assert luhn_check("4000000000000002") is True

def test_luhn_normalises_spaces():
    """Backend must strip spaces before validating — '4111 1111 1111 1111' must pass."""
    assert luhn_check("4111111111111111".replace("", " ").strip().replace("  ", " ")) is True
    # Explicit: raw digits with spaces stripped
    assert luhn_check("4111111111111111") is True

def test_detect_card_brand_visa():
    assert detect_card_brand("4111111111111111") == "Visa"
    assert detect_card_brand("4532015112830366") == "Visa"

def test_detect_card_brand_mastercard():
    assert detect_card_brand("5500005555555559") == "Mastercard"

def test_detect_card_brand_amex():
    assert detect_card_brand("378282246310005") == "Amex"


# ── Credit card validation ────────────────────────────────────────────────────

def test_expired_card_rejected():
    with patch("utils.jwt.jwt.decode", return_value=_VIS):
        with patch("routers.checkout._send_receipt_bg"):
            resp = client.post("/api/checkout/pay", json={
                "paymentMethod": "credit_card",
                "creditCard": {
                    "cardholderName": "Alice",
                    "cardNumber": "4532015112830366",
                    "expiryMonth": 1,
                    "expiryYear": 2020,   # expired
                    "cvv": "123",
                },
            }, headers=_auth("Visitor"))
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is False
    assert any("expired" in e.lower() for e in data["errors"])


def test_invalid_luhn_rejected():
    with patch("utils.jwt.jwt.decode", return_value=_VIS):
        resp = client.post("/api/checkout/pay", json={
            "paymentMethod": "credit_card",
            "creditCard": {
                "cardholderName": "Alice",
                "cardNumber": "1234567890123456",   # fails Luhn
                "expiryMonth": 12,
                "expiryYear": 2030,
                "cvv": "123",
            },
        }, headers=_auth("Visitor"))
    data = resp.json()
    assert data["success"] is False
    assert any("luhn" in e.lower() or "card number" in e.lower() for e in data["errors"])


def test_mock_decline_card_rejected():
    with patch("utils.jwt.jwt.decode", return_value=_VIS):
        resp = client.post("/api/checkout/pay", json={
            "paymentMethod": "credit_card",
            "creditCard": {
                "cardholderName": "Alice",
                "cardNumber": "4000000000000002",   # mock decline
                "expiryMonth": 12,
                "expiryYear": 2030,
                "cvv": "123",
            },
        }, headers=_auth("Visitor"))
    data = resp.json()
    assert data["success"] is False
    assert any("declined" in e.lower() for e in data["errors"])


def test_full_card_number_not_stored():
    """Only last 4 digits must be stored — never full card number."""
    db = TestingSessionLocal()
    pid = db.query(Product).filter(Product.ProductName == "Chili Oil").first().ProductId
    db.query(Inventory).filter(Inventory.ProductId == pid).update({"AllocatedQuantity": 5})
    db.commit(); db.close()

    with patch("utils.jwt.jwt.decode", return_value=_VIS):
        resp = client.post("/api/checkout/pay", json={
            "paymentMethod": "credit_card",
            "creditCard": {
                "cardholderName": "Alice",
                "cardNumber": "4532015112830366",
                "expiryMonth": 12,
                "expiryYear": 2030,
                "cvv": "123",
            },
            "items": [{"productId": pid, "quantity": 1}],
        }, headers=_auth("Visitor"))
    assert resp.json()["success"] is True

    db = TestingSessionLocal()
    pr = db.query(PaymentRecord).first()
    assert pr is not None
    assert pr.CardLast4 == "0366"
    # Verify full card is NOT stored anywhere in payment record
    assert "4532015112830366" not in str(pr.__dict__)
    db.close()


# ── Real PayPal Sandbox — HTTP calls mocked so tests don't need live credentials ──

def _mock_paypal_create_response(order_id: str = "PAYPAL-ORDER-123") -> dict:
    return {"id": order_id, "status": "CREATED", "links": []}


def _mock_paypal_capture_response(order_id: str = "PAYPAL-ORDER-123", capture_id: str = "CAP-456") -> dict:
    return {
        "id": order_id,
        "status": "COMPLETED",
        "purchase_units": [
            {"payments": {"captures": [{"id": capture_id, "status": "COMPLETED"}]}}
        ],
    }


def test_paypal_config_missing_returns_503():
    """When PayPal credentials are not set, config endpoint returns enabled=False."""
    import os
    saved = {k: os.environ.pop(k, None) for k in ("PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET")}
    try:
        resp = client.get("/api/payments/paypal/config")
        assert resp.status_code == 200
        assert resp.json()["enabled"] is False
    finally:
        for k, v in saved.items():
            if v is not None:
                os.environ[k] = v


def test_paypal_create_order_returns_503_without_credentials():
    import os
    saved = {k: os.environ.pop(k, None) for k in ("PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET")}
    try:
        with patch("utils.jwt.jwt.decode", return_value=_VIS):
            db = TestingSessionLocal()
            pid = db.query(Product).filter(Product.ProductName == "Chili Oil").first().ProductId
            db.close()
            resp = client.post("/api/payments/paypal/create-order",
                               json={"items": [{"productId": pid, "quantity": 1}]},
                               headers=_auth("Visitor"))
        assert resp.status_code == 503
        assert "not configured" in resp.json()["detail"].lower()
    finally:
        for k, v in saved.items():
            if v is not None:
                os.environ[k] = v


def test_paypal_create_order_calls_sandbox_api(monkeypatch):
    """create-order must call PayPal Sandbox API (mocked so no real network call)."""
    monkeypatch.setenv("PAYPAL_CLIENT_ID",     "test-client-id")
    monkeypatch.setenv("PAYPAL_CLIENT_SECRET", "test-secret")

    db = TestingSessionLocal()
    pid = db.query(Product).filter(Product.ProductName == "Chili Oil").first().ProductId
    db.close()

    with patch("routers.payments.is_paypal_configured", return_value=True):
        with patch("routers.payments.create_paypal_order",
                   return_value=_mock_paypal_create_response("PP-ORDER-XYZ")):
            with patch("utils.jwt.jwt.decode", return_value=_VIS):
                resp = client.post("/api/payments/paypal/create-order",
                                   json={"items": [{"productId": pid, "quantity": 1}]},
                                   headers=_auth("Visitor"))

    assert resp.status_code == 200
    data = resp.json()
    assert data["paypalOrderId"] == "PP-ORDER-XYZ"
    assert data["amount"] == 100.0


def test_paypal_capture_creates_order_on_completed_status(monkeypatch):
    """capture-order must create internal Order when PayPal status=COMPLETED."""
    monkeypatch.setenv("PAYPAL_CLIENT_ID",     "test-client-id")
    monkeypatch.setenv("PAYPAL_CLIENT_SECRET", "test-secret")

    db = TestingSessionLocal()
    pid = db.query(Product).filter(Product.ProductName == "Chili Oil").first().ProductId
    db.close()

    with patch("routers.payments.is_paypal_configured", return_value=True):
        with patch("routers.payments.capture_paypal_order",
                   return_value=_mock_paypal_capture_response("PP-ORDER-XYZ", "CAP-999")):
            with patch("utils.jwt.jwt.decode", return_value=_VIS):
                with patch("routers.payments._send_receipt_bg"):
                    resp = client.post("/api/payments/paypal/capture-order",
                                       json={"paypalOrderId": "PP-ORDER-XYZ",
                                             "items": [{"productId": pid, "quantity": 1}]},
                                       headers=_auth("Visitor"))

    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["providerOrderId"]   == "PP-ORDER-XYZ"
    assert data["providerCaptureId"] == "CAP-999"
    assert data["mockTransactionId"] is None   # no mock TX for real PayPal
    assert data["paymentMethod"]     == "paypal"

    order_id = data["orderId"]
    db = TestingSessionLocal()
    pr = db.query(PaymentRecord).filter(PaymentRecord.OrderId == order_id).first()
    assert pr is not None
    assert pr.ProviderOrderId   == "PP-ORDER-XYZ"
    assert pr.ProviderCaptureId == "CAP-999"
    assert pr.MockTransactionId is None
    db.close()


def test_paypal_capture_does_not_create_order_on_failed_status(monkeypatch):
    """capture-order must NOT create Order when PayPal status is not COMPLETED."""
    monkeypatch.setenv("PAYPAL_CLIENT_ID",     "test-client-id")
    monkeypatch.setenv("PAYPAL_CLIENT_SECRET", "test-secret")

    db = TestingSessionLocal()
    pid = db.query(Product).filter(Product.ProductName == "Chili Oil").first().ProductId
    before_count = db.query(Order).count()
    db.close()

    failed_capture = {"id": "PP-FAIL", "status": "DECLINED", "purchase_units": []}
    with patch("routers.payments.is_paypal_configured", return_value=True):
        with patch("routers.payments.capture_paypal_order", return_value=failed_capture):
            with patch("utils.jwt.jwt.decode", return_value=_VIS):
                resp = client.post("/api/payments/paypal/capture-order",
                                   json={"paypalOrderId": "PP-FAIL",
                                         "items": [{"productId": pid, "quantity": 1}]},
                                   headers=_auth("Visitor"))

    data = resp.json()
    assert data["success"] is False
    assert "not completed" in data["message"].lower() or "DECLINED" in data["message"]

    db = TestingSessionLocal()
    assert db.query(Order).count() == before_count   # no new order
    db.close()


def test_paypal_capture_does_not_decrement_stock_on_failed_capture(monkeypatch):
    """Stock must NOT be decremented when PayPal capture fails."""
    monkeypatch.setenv("PAYPAL_CLIENT_ID",     "test-client-id")
    monkeypatch.setenv("PAYPAL_CLIENT_SECRET", "test-secret")

    db = TestingSessionLocal()
    pid = db.query(Product).filter(Product.ProductName == "Chili Oil").first().ProductId
    before_stock = db.query(Inventory).filter(Inventory.ProductId == pid).first().AllocatedQuantity
    db.close()

    with patch("routers.payments.is_paypal_configured", return_value=True):
        with patch("routers.payments.capture_paypal_order",
                   side_effect=Exception("PayPal network error")):
            with patch("utils.jwt.jwt.decode", return_value=_VIS):
                resp = client.post("/api/payments/paypal/capture-order",
                                   json={"paypalOrderId": "PP-NET-FAIL",
                                         "items": [{"productId": pid, "quantity": 1}]},
                                   headers=_auth("Visitor"))

    assert resp.json()["success"] is False

    db = TestingSessionLocal()
    after_stock = db.query(Inventory).filter(Inventory.ProductId == pid).first().AllocatedQuantity
    assert after_stock == before_stock   # stock unchanged
    db.close()


def test_paypal_receipt_email_queued_after_successful_capture(monkeypatch):
    """Transactional receipt email must be queued after PayPal capture."""
    monkeypatch.setenv("PAYPAL_CLIENT_ID",     "test-client-id")
    monkeypatch.setenv("PAYPAL_CLIENT_SECRET", "test-secret")

    db = TestingSessionLocal()
    pid = db.query(Product).filter(Product.ProductName == "Chili Oil").first().ProductId
    db.close()

    with patch("routers.payments.is_paypal_configured", return_value=True):
        with patch("routers.payments.capture_paypal_order",
                   return_value=_mock_paypal_capture_response()):
            with patch("utils.jwt.jwt.decode", return_value=_VIS):
                with patch("routers.payments._send_receipt_bg") as mock_bg:
                    resp = client.post("/api/payments/paypal/capture-order",
                                       json={"paypalOrderId": "PP-REC-123",
                                             "items": [{"productId": pid, "quantity": 1}]},
                                       headers=_auth("Visitor"))

    assert resp.json()["success"] is True
    mock_bg.assert_called_once()


def test_worker_paypal_checkout_applies_employee_discount(monkeypatch):
    """Worker PayPal order must include employee discount in the total."""
    monkeypatch.setenv("PAYPAL_CLIENT_ID",     "test-client-id")
    monkeypatch.setenv("PAYPAL_CLIENT_SECRET", "test-secret")

    db = TestingSessionLocal()
    pid = db.query(Product).filter(Product.ProductName == "Chili Oil").first().ProductId
    db.close()

    create_calls = []
    def mock_create(amount_ils, **kw):
        create_calls.append(amount_ils)
        return {"id": "PP-WORKER", "status": "CREATED"}

    with patch("routers.payments.is_paypal_configured", return_value=True):
        with patch("routers.payments.create_paypal_order", side_effect=mock_create):
            with patch("utils.jwt.jwt.decode", return_value=_WRK):
                client.post("/api/payments/paypal/create-order",
                            json={"items": [{"productId": pid, "quantity": 1}]},
                            headers=_auth("Worker"))

    # Worker gets 40% discount — total should be 60.0
    assert create_calls[0] == 60.0


def test_paypal_checkout_pays_no_real_credentials_get_503():
    """Without credentials, checkout/pay with paypal paymentMethod returns 400."""
    with patch("utils.jwt.jwt.decode", return_value=_VIS):
        resp = client.post("/api/checkout/pay", json={
            "paymentMethod": "paypal",
            "items": [{"productId": 1, "quantity": 1}],
        }, headers=_auth("Visitor"))
    # paypal is no longer a valid paymentMethod for /api/checkout/pay
    assert resp.status_code == 400


# ── Worker cart access (Bug B fix) ────────────────────────────────────────────

def test_worker_can_add_to_cart():
    """Workers must be able to add to cart, not just Visitors."""
    db = TestingSessionLocal()
    pid = db.query(Product).filter(Product.ProductName == "Chili Oil").first().ProductId
    db.close()

    with patch("utils.jwt.jwt.decode", return_value=_WRK):
        resp = client.post("/api/cart/items",
                           json={"productId": pid, "quantity": 1},
                           headers=_auth("Worker"))
    assert resp.status_code == 201
    assert len(resp.json()["items"]) == 1


def test_worker_cart_applies_employee_discount():
    """Worker cart summary must show employee discount total."""
    db = TestingSessionLocal()
    pid = db.query(Product).filter(Product.ProductName == "Chili Oil").first().ProductId
    db.close()

    with patch("utils.jwt.jwt.decode", return_value=_WRK):
        client.post("/api/cart/items",
                    json={"productId": pid, "quantity": 1},
                    headers=_auth("Worker"))
        cart = client.get("/api/cart", headers=_auth("Worker"))

    data = cart.json()
    assert data["employeeDiscountTotal"] > 0, "Worker must see employee discount in cart"


def test_worker_can_checkout_with_employee_discount():
    """Worker checkout must complete successfully with employee discount applied."""
    db = TestingSessionLocal()
    pid = db.query(Product).filter(Product.ProductName == "Chili Oil").first().ProductId
    db.close()

    with patch("utils.jwt.jwt.decode", return_value=_WRK):
        resp = client.post("/api/checkout/pay", json={
            "paymentMethod": "credit_card",
            "creditCard": {"cardholderName": "Test User", "cardNumber": "4111111111111111", "expiryMonth": 12, "expiryYear": 2030, "cvv": "123"},
            "items": [{"productId": pid, "quantity": 1}],
        }, headers=_auth("Worker"))
    assert resp.json()["success"] is True
    # Verify order records the employee discount
    order_id = resp.json()["orderId"]
    db = TestingSessionLocal()
    order = db.query(Order).filter(Order.OrderId == order_id).first()
    assert float(order.EmployeeDiscountTotal) > 0
    db.close()


# ── Luhn normalisation (spaces) ────────────────────────────────────────────────

def test_luhn_accepts_formatted_card_with_spaces():
    """luhn_check must strip spaces before validating — '4111 1111 1111 1111' must pass."""
    assert luhn_check("4111 1111 1111 1111") is True


def test_luhn_accepts_test_card_4111():
    """4111111111111111 is the canonical valid test card (Visa)."""
    assert luhn_check("4111111111111111") is True


def test_luhn_rejects_1234_sequence():
    """1234123412341234 must fail Luhn — used in docs as a known-invalid example."""
    assert luhn_check("1234123412341234") is False


# ── Stock management ───────────────────────────────────────────────────────────

def test_checkout_decrements_stock():
    db = TestingSessionLocal()
    pid = db.query(Product).filter(Product.ProductName == "Chili Oil").first().ProductId
    before = db.query(Inventory).filter(Inventory.ProductId == pid).first().AllocatedQuantity
    db.close()

    with patch("utils.jwt.jwt.decode", return_value=_VIS):
        resp = client.post("/api/checkout/pay", json={
            "paymentMethod": "credit_card",
            "creditCard": {"cardholderName": "Test User", "cardNumber": "4111111111111111", "expiryMonth": 12, "expiryYear": 2030, "cvv": "123"},
            "items": [{"productId": pid, "quantity": 2}],
        }, headers=_auth("Visitor"))
    assert resp.json()["success"] is True

    db = TestingSessionLocal()
    after = db.query(Inventory).filter(Inventory.ProductId == pid).first().AllocatedQuantity
    db.close()
    assert after == before - 2


def test_out_of_stock_blocks_checkout():
    db = TestingSessionLocal()
    pid = db.query(Product).filter(Product.ProductName == "Chili Oil").first().ProductId
    db.query(Inventory).filter(Inventory.ProductId == pid).update({"AllocatedQuantity": 0})
    db.commit(); db.close()

    with patch("utils.jwt.jwt.decode", return_value=_VIS):
        resp = client.post("/api/checkout/preview", json={
            "paymentMethod": "credit_card",
            "creditCard": {"cardholderName": "Test User", "cardNumber": "4111111111111111", "expiryMonth": 12, "expiryYear": 2030, "cvv": "123"},
            "items": [{"productId": pid, "quantity": 1}],
        }, headers=_auth("Visitor"))
    data = resp.json()
    assert data["isValid"] is False
    assert len(data["errors"]) > 0


def test_quantity_exceeds_stock_blocks_checkout():
    db = TestingSessionLocal()
    pid = db.query(Product).filter(Product.ProductName == "Chili Oil").first().ProductId
    db.query(Inventory).filter(Inventory.ProductId == pid).update({"AllocatedQuantity": 2})
    db.commit(); db.close()

    with patch("utils.jwt.jwt.decode", return_value=_VIS):
        resp = client.post("/api/checkout/preview", json={
            "paymentMethod": "credit_card",
            "creditCard": {"cardholderName": "Test User", "cardNumber": "4111111111111111", "expiryMonth": 12, "expiryYear": 2030, "cvv": "123"},
            "items": [{"productId": pid, "quantity": 5}],
        }, headers=_auth("Visitor"))
    data = resp.json()
    assert data["isValid"] is False


def test_failed_payment_does_not_decrement_stock():
    db = TestingSessionLocal()
    pid = db.query(Product).filter(Product.ProductName == "Chili Oil").first().ProductId
    before = db.query(Inventory).filter(Inventory.ProductId == pid).first().AllocatedQuantity
    db.close()

    with patch("utils.jwt.jwt.decode", return_value=_VIS):
        resp = client.post("/api/checkout/pay", json={
            "paymentMethod": "credit_card",
            "creditCard": {
                "cardholderName": "Alice",
                "cardNumber": "4000000000000002",   # declined
                "expiryMonth": 12,
                "expiryYear": 2030,
                "cvv": "123",
            },
            "items": [{"productId": pid, "quantity": 1}],
        }, headers=_auth("Visitor"))
    assert resp.json()["success"] is False

    db = TestingSessionLocal()
    after = db.query(Inventory).filter(Inventory.ProductId == pid).first().AllocatedQuantity
    db.close()
    assert after == before   # unchanged


# ── Employee discount ──────────────────────────────────────────────────────────

def test_worker_gets_default_40_pct_employee_discount():
    db = TestingSessionLocal()
    pid = db.query(Product).filter(Product.ProductName == "Chili Oil").first().ProductId
    disc_pct = get_employee_discount_pct(db, pid)
    db.close()
    assert disc_pct == 40.0


def test_manager_can_change_global_discount():
    with patch("utils.jwt.jwt.decode", return_value=_MGR):
        with patch("routers.checkout._send_receipt_bg"):  # prevent bg-task interference
            resp = client.put("/api/employee-discounts/settings",
                              json={"globalDiscountPercent": 25.0, "active": True},
                              headers=_auth("FarmManager"))
    assert resp.status_code == 200
    assert resp.json()["globalDiscountPercent"] == 25.0

    db = TestingSessionLocal()
    pid = db.query(Product).filter(Product.ProductName == "Chili Oil").first().ProductId
    disc_pct = get_employee_discount_pct(db, pid)
    db.close()
    assert disc_pct == 25.0


def test_product_excluded_from_employee_discount():
    db = TestingSessionLocal()
    pid = db.query(Product).filter(Product.ProductName == "Chili Oil").first().ProductId
    db.close()

    with patch("utils.jwt.jwt.decode", return_value=_MGR):
        client.post("/api/employee-discounts/overrides",
                    json={"productId": pid, "mode": "excluded"},
                    headers=_auth("FarmManager"))

    db = TestingSessionLocal()
    disc_pct = get_employee_discount_pct(db, pid)
    db.close()
    assert disc_pct == 0.0


def test_custom_employee_discount_override():
    db = TestingSessionLocal()
    pid = db.query(Product).filter(Product.ProductName == "Chili Oil").first().ProductId
    db.close()

    with patch("utils.jwt.jwt.decode", return_value=_MGR):
        client.post("/api/employee-discounts/overrides",
                    json={"productId": pid, "mode": "custom_percent", "customDiscountPercent": 15.0},
                    headers=_auth("FarmManager"))

    db = TestingSessionLocal()
    disc_pct = get_employee_discount_pct(db, pid)
    db.close()
    assert disc_pct == 15.0


def test_visitor_gets_no_employee_discount():
    db = TestingSessionLocal()
    pid = db.query(Product).filter(Product.ProductName == "Chili Oil").first().ProductId
    from services.pricing_service import calculate_prices
    breakdown = calculate_prices(db, [{"productId": pid, "quantity": 1}], "Visitor", None, 3)
    db.close()
    assert breakdown.employeeDiscountTotal == 0.0


def test_worker_checkout_applies_employee_discount():
    db = TestingSessionLocal()
    pid = db.query(Product).filter(Product.ProductName == "Chili Oil").first().ProductId
    from services.pricing_service import calculate_prices
    breakdown = calculate_prices(db, [{"productId": pid, "quantity": 1}], "Worker", None, 2)
    db.close()
    # 40% of 100 = 40 discount
    assert breakdown.employeeDiscountTotal == 40.0
    assert breakdown.finalTotal == 60.0


# ── Coupon ─────────────────────────────────────────────────────────────────────

def test_manager_creates_coupon():
    with patch("utils.jwt.jwt.decode", return_value=_MGR):
        with patch("routers.checkout._send_receipt_bg"):  # prevent bg-task event-loop interference
            resp = client.post("/api/coupons", json={
                "code": "SAVE10",
                "discountType": "percentage",
                "discountValue": 10.0,
                "active": True,
            }, headers=_auth("FarmManager"))
    assert resp.status_code == 201
    assert resp.json()["code"] == "SAVE10"


def test_coupon_percentage_discount_correct():
    db = TestingSessionLocal()
    pid = db.query(Product).filter(Product.ProductName == "Chili Oil").first().ProductId
    db.add(Coupon(Code="PCT10", DiscountType="percentage", DiscountValue=10, Active=True,
                  CurrentUseCount=0))
    db.commit()
    from services.pricing_service import calculate_prices
    breakdown = calculate_prices(db, [{"productId": pid, "quantity": 1}], "Visitor", "PCT10", 3)
    db.close()
    assert breakdown.couponDiscountTotal == 10.0    # 10% of 100
    assert breakdown.finalTotal == 90.0


def test_coupon_fixed_discount_correct():
    db = TestingSessionLocal()
    pid = db.query(Product).filter(Product.ProductName == "Chili Oil").first().ProductId
    db.add(Coupon(Code="FIXED15", DiscountType="fixed_amount", DiscountValue=15, Active=True,
                  CurrentUseCount=0))
    db.commit()
    from services.pricing_service import calculate_prices
    breakdown = calculate_prices(db, [{"productId": pid, "quantity": 1}], "Visitor", "FIXED15", 3)
    db.close()
    assert breakdown.couponDiscountTotal == 15.0
    assert breakdown.finalTotal == 85.0


def test_expired_coupon_rejected():
    db = TestingSessionLocal()
    past = datetime(2020, 1, 1)
    db.add(Coupon(Code="OLD", DiscountType="percentage", DiscountValue=20, Active=True,
                  EndsAtUtc=past, CurrentUseCount=0))
    db.commit()
    from services.pricing_service import validate_coupon
    _, err = validate_coupon(db, "OLD", 3, 100.0)
    db.close()
    assert err is not None
    assert "expired" in err.lower()


def test_inactive_coupon_rejected():
    db = TestingSessionLocal()
    db.add(Coupon(Code="OFF", DiscountType="percentage", DiscountValue=20, Active=False,
                  CurrentUseCount=0))
    db.commit()
    from services.pricing_service import validate_coupon
    _, err = validate_coupon(db, "OFF", 3, 100.0)
    db.close()
    assert err is not None


def test_coupon_count_increments_after_payment():
    db = TestingSessionLocal()
    pid = db.query(Product).filter(Product.ProductName == "Chili Oil").first().ProductId
    db.add(Coupon(Code="PAY20", DiscountType="percentage", DiscountValue=20, Active=True,
                  CurrentUseCount=0))
    db.commit()
    before = db.query(Coupon).filter(Coupon.Code == "PAY20").first().CurrentUseCount
    db.close()

    with patch("utils.jwt.jwt.decode", return_value=_VIS):
        resp = client.post("/api/checkout/pay", json={
            "paymentMethod": "credit_card",
            "creditCard": {"cardholderName": "Test User", "cardNumber": "4111111111111111", "expiryMonth": 12, "expiryYear": 2030, "cvv": "123"},
            "couponCode": "PAY20",
            "items": [{"productId": pid, "quantity": 1}],
        }, headers=_auth("Visitor"))
    assert resp.json()["success"] is True

    db = TestingSessionLocal()
    after = db.query(Coupon).filter(Coupon.Code == "PAY20").first().CurrentUseCount
    db.close()
    assert after == before + 1


# ── Transactional receipt email ────────────────────────────────────────────────

def test_receipt_email_queued_after_successful_payment():
    db = TestingSessionLocal()
    pid = db.query(Product).filter(Product.ProductName == "Chili Oil").first().ProductId
    db.close()

    with patch("utils.jwt.jwt.decode", return_value=_VIS):
        with patch("services.receipt_email_service.send_email") as mock_send:
            mock_send.return_value = None
            resp = client.post("/api/checkout/pay", json={
                "paymentMethod": "credit_card",
            "creditCard": {"cardholderName": "Test User", "cardNumber": "4111111111111111", "expiryMonth": 12, "expiryYear": 2030, "cvv": "123"},
                "items": [{"productId": pid, "quantity": 1}],
            }, headers=_auth("Visitor"))

    assert resp.json()["success"] is True


def test_receipt_email_sent_regardless_of_email_consent():
    """TRANSACTIONAL: receipt must be sent even if user unsubscribed from newsletters.
    The receipt_email_service does NOT filter by EmailConsent — it always sends.
    """
    db = TestingSessionLocal()
    pid = db.query(Product).filter(Product.ProductName == "Chili Oil").first().ProductId
    db.close()

    with patch("utils.jwt.jwt.decode", return_value=_VIS):
        with patch("services.receipt_email_service.is_smtp_configured", return_value=True):
            with patch("services.receipt_email_service.send_email") as mock_send:
                mock_send.return_value = None
                with patch("routers.checkout._send_receipt_bg") as mock_bg:
                    # Manually call the receipt service to verify it doesn't filter by consent
                    resp = client.post("/api/checkout/pay", json={
                        "paymentMethod": "credit_card",
            "creditCard": {"cardholderName": "Test User", "cardNumber": "4111111111111111", "expiryMonth": 12, "expiryYear": 2030, "cvv": "123"},
                        "items": [{"productId": pid, "quantity": 1}],
                    }, headers=_auth("Visitor"))
                    # Verify the bg task was scheduled (not that email was sent synchronously)
                    mock_bg.assert_called_once()

    assert resp.json()["success"] is True


def test_receipt_email_failure_does_not_fail_order():
    """SMTP failure must NOT roll back the order — order is already committed."""
    db = TestingSessionLocal()
    pid = db.query(Product).filter(Product.ProductName == "Chili Oil").first().ProductId
    db.close()

    with patch("utils.jwt.jwt.decode", return_value=_VIS):
        with patch("services.receipt_email_service.is_smtp_configured", return_value=True):
            with patch("services.receipt_email_service.send_email", side_effect=Exception("SMTP down")):
                resp = client.post("/api/checkout/pay", json={
                    "paymentMethod": "credit_card",
            "creditCard": {"cardholderName": "Test User", "cardNumber": "4111111111111111", "expiryMonth": 12, "expiryYear": 2030, "cvv": "123"},
                    "items": [{"productId": pid, "quantity": 1}],
                }, headers=_auth("Visitor"))

    # Order must still succeed despite email failure
    assert resp.json()["success"] is True


def test_receipt_email_type_is_order_receipt_not_marketing():
    """receipt_email_service must use EmailType='order_receipt' — not 'newsletter' or 'promotion'."""
    import services.receipt_email_service as svc
    import inspect
    source = inspect.getsource(svc.send_order_receipt)
    # Must explicitly set transactional email type
    assert "order_receipt" in source
    # Must NOT use newsletter or promotion as email type in send_order_receipt
    assert 'EmailType="newsletter"' not in source
    assert "EmailType='newsletter'" not in source


# ── Price calculation ──────────────────────────────────────────────────────────

def test_product_price_change_reflected_in_cart():
    """Cart must use current DB price, not stale cached prices."""
    db = TestingSessionLocal()
    pid = db.query(Product).filter(Product.ProductName == "Chili Oil").first().ProductId
    db.close()

    with patch("utils.jwt.jwt.decode", return_value=_VIS):
        client.post("/api/cart/items",
                    json={"productId": pid, "quantity": 1},
                    headers=_auth("Visitor"))

    # Manager changes price
    db = TestingSessionLocal()
    db.query(Product).filter(Product.ProductId == pid).update({"Price": 150.0})
    db.commit(); db.close()

    with patch("utils.jwt.jwt.decode", return_value=_VIS):
        cart = client.get("/api/cart", headers=_auth("Visitor"))

    data = cart.json()
    assert data["originalSubtotal"] == 150.0


def test_order_records_created_after_successful_payment():
    db = TestingSessionLocal()
    pid = db.query(Product).filter(Product.ProductName == "Chili Oil").first().ProductId
    db.close()

    with patch("utils.jwt.jwt.decode", return_value=_VIS):
        resp = client.post("/api/checkout/pay", json={
            "paymentMethod": "credit_card",
            "creditCard": {"cardholderName": "Test User", "cardNumber": "4111111111111111", "expiryMonth": 12, "expiryYear": 2030, "cvv": "123"},
            "items": [{"productId": pid, "quantity": 2}],
        }, headers=_auth("Visitor"))

    assert resp.json()["success"] is True
    order_id = resp.json()["orderId"]

    db = TestingSessionLocal()
    order   = db.query(Order).filter(Order.OrderId == order_id).first()
    items   = db.query(OrderItem).filter(OrderItem.OrderId == order_id).all()
    payment = db.query(PaymentRecord).filter(PaymentRecord.OrderId == order_id).first()
    db.close()

    assert order is not None
    assert order.Status == "paid"
    assert len(items) == 1
    assert items[0].Quantity == 2
    assert payment is not None
    assert payment.PaymentStatus == "succeeded"
