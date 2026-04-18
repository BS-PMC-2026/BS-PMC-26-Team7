import pytest
from unittest.mock import MagicMock

from services.inventory_service import update_inventory
from schemas.inventory import InventoryUpdate
from models.inventory import Inventory


def test_update_inventory_not_found():
    db = MagicMock()

    query_mock = MagicMock()
    filter_mock = MagicMock()

    db.query.return_value = query_mock
    query_mock.filter.return_value = filter_mock
    filter_mock.first.return_value = None

    payload = InventoryUpdate(
        WarehouseQuantity=10,
        AllocatedQuantity=0,
        Location="Shelf A"
    )

    with pytest.raises(ValueError, match="Inventory record not found."):
        update_inventory(db, 1, payload)


def test_update_inventory_warehouse_only_item_cannot_have_allocated_quantity():
    db = MagicMock()

    inv = Inventory()
    inv.InventoryId = 1
    inv.ProductId = None
    inv.ItemName = "Fertilizer"
    inv.Location = "Shelf A"
    inv.WarehouseQuantity = 20
    inv.AllocatedQuantity = 0
    inv.LastUpdatedAt = "2026-04-18T10:00:00"

    query_mock = MagicMock()
    filter_mock = MagicMock()

    db.query.return_value = query_mock
    query_mock.filter.return_value = filter_mock
    filter_mock.first.return_value = inv

    payload = InventoryUpdate(
        WarehouseQuantity=20,
        AllocatedQuantity=5,
        Location="Shelf B"
    )

    with pytest.raises(ValueError, match="AllocatedQuantity must be 0 for warehouse-only items."):
        update_inventory(db, 1, payload)


def test_update_inventory_allocated_cannot_exceed_warehouse():
    db = MagicMock()

    inv = Inventory()
    inv.InventoryId = 1
    inv.ProductId = 7
    inv.ItemName = None
    inv.Location = "Shelf A"
    inv.WarehouseQuantity = 20
    inv.AllocatedQuantity = 2
    inv.LastUpdatedAt = "2026-04-18T10:00:00"

    query_mock = MagicMock()
    filter_mock = MagicMock()

    db.query.return_value = query_mock
    query_mock.filter.return_value = filter_mock
    filter_mock.first.return_value = inv

    # bypass Pydantic validation so we can test the service logic itself
    payload = InventoryUpdate.model_construct(
        WarehouseQuantity=10,
        AllocatedQuantity=15,
        Location="Shelf C"
    )

    with pytest.raises(ValueError, match="AllocatedQuantity cannot exceed WarehouseQuantity."):
        update_inventory(db, 1, payload)


def test_update_inventory_success_for_warehouse_only_item():
    db = MagicMock()

    inv = Inventory()
    inv.InventoryId = 1
    inv.ProductId = None
    inv.ItemName = "Pots"
    inv.Location = "Old Shelf"
    inv.WarehouseQuantity = 50
    inv.AllocatedQuantity = 0
    inv.LastUpdatedAt = "2026-04-18T10:00:00"

    query_mock = MagicMock()
    filter_mock = MagicMock()

    db.query.return_value = query_mock
    query_mock.filter.return_value = filter_mock
    filter_mock.first.return_value = inv

    payload = InventoryUpdate(
        WarehouseQuantity=30,
        AllocatedQuantity=0,
        Location="New Shelf"
    )

    result = update_inventory(db, 1, payload)

    assert inv.WarehouseQuantity == 30
    assert inv.AllocatedQuantity == 0
    assert inv.Location == "New Shelf"

    db.commit.assert_called_once()
    db.refresh.assert_called_once_with(inv)

    assert result["InventoryId"] == 1
    assert result["ProductId"] is None
    assert result["ItemName"] == "Pots"
    assert result["DisplayName"] == "Pots"
    assert result["WarehouseQuantity"] == 30
    assert result["AllocatedQuantity"] == 0
    assert result["Location"] == "New Shelf"