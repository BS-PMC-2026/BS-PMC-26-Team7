import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from unittest.mock import MagicMock
from fastapi.testclient import TestClient
from main import app
from database import get_db
from utils.jwt import get_current_user
from services.inventory_service import get_inventory_report, LOW_STOCK_THRESHOLD

client = TestClient(app)


def make_manager():
    return {"user_id": 1, "role": "FarmManager"}


def make_mock_row(inv_id, warehouse, allocated, item_name="Item", category="General"):
    inv = MagicMock()
    inv.InventoryId = inv_id
    inv.ItemName = item_name
    inv.ProductId = None
    inv.Location = "Shelf A"
    inv.WarehouseQuantity = warehouse
    inv.AllocatedQuantity = allocated
    inv.LastUpdatedAt = "2026-04-19"
    return (inv, None, category)


def make_db(rows):
    db = MagicMock()
    db.query.return_value.outerjoin.return_value.all.return_value = rows
    return db


# BSPMT7-201: Unit tests


def test_report_computes_available_quantity():
    db = make_db([make_mock_row(1, 50, 10)])
    result = get_inventory_report(db)
    assert result[0]["AvailableQuantity"] == 40


def test_report_flags_low_stock():
    db = make_db([
        make_mock_row(1, 100, 0,  "Plenty"),
        make_mock_row(2, 15,  10, "Low"),
    ])
    result = get_inventory_report(db)
    plenty = next(r for r in result if r["DisplayName"] == "Plenty")
    low    = next(r for r in result if r["DisplayName"] == "Low")
    assert plenty["LowStock"] is False
    assert low["LowStock"] is True


def test_report_filters_low_stock_only():
    db = make_db([
        make_mock_row(1, 100, 0, "Plenty"),
        make_mock_row(2, 5,   0, "Low"),
    ])
    result = get_inventory_report(db, low_stock_only=True)
    assert len(result) == 1
    assert result[0]["DisplayName"] == "Low"


def test_report_filters_by_category():
    db = make_db([
        make_mock_row(1, 100, 0, "Tomato",   category="Vegetables"),
        make_mock_row(2, 100, 0, "Spice Mix", category="Seasonings"),
    ])
    result = get_inventory_report(db, category="Vegetables")
    assert len(result) == 1
    assert result[0]["DisplayName"] == "Tomato"


def test_report_sorts_by_quantity():
    db = make_db([
        make_mock_row(1, 100, 0, "High"),
        make_mock_row(2, 10,  0, "Low"),
        make_mock_row(3, 50,  0, "Mid"),
    ])
    result = get_inventory_report(db, sort_by="quantity")
    names = [r["DisplayName"] for r in result]
    assert names == ["Low", "Mid", "High"]


def test_report_threshold_boundary():
    db = make_db([make_mock_row(1, LOW_STOCK_THRESHOLD, 0, "Exact")])
    result = get_inventory_report(db)
    assert result[0]["LowStock"] is False


# BSPMT7-201: API tests


def test_report_api_returns_200():
    mock_db = make_db([])
    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_current_user] = lambda: make_manager()
    res = client.get("/api/inventory/report")
    app.dependency_overrides.clear()
    assert res.status_code == 200


def test_report_api_unauthorized_returns_403():
    app.dependency_overrides[get_current_user] = lambda: {"user_id": 3, "role": "Worker"}
    res = client.get("/api/inventory/report")
    app.dependency_overrides.clear()
    assert res.status_code == 403


def test_report_api_no_token_returns_401():
    res = client.get("/api/inventory/report")
    assert res.status_code == 401