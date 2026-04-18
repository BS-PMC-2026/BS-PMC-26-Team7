import pytest
from pydantic import ValidationError

from schemas.inventory import InventoryCreate, InventoryUpdate


def test_inventory_create_strips_item_name_and_location():
    payload = InventoryCreate(
        ItemName="  Seeds  ",
        Location="  Shelf A  ",
        WarehouseQuantity=10
    )

    assert payload.ItemName == "Seeds"
    assert payload.Location == "Shelf A"
    assert payload.WarehouseQuantity == 10


def test_inventory_create_empty_item_name_after_strip_raises_error():
    with pytest.raises(ValidationError) as exc_info:
        InventoryCreate(
            ItemName="   ",
            Location="Shelf A",
            WarehouseQuantity=5
        )

    assert "ItemName cannot be empty." in str(exc_info.value)


def test_inventory_update_allocated_cannot_exceed_warehouse():
    with pytest.raises(ValidationError) as exc_info:
        InventoryUpdate(
            WarehouseQuantity=5,
            AllocatedQuantity=8,
            Location="Shelf B"
        )

    assert "AllocatedQuantity cannot exceed WarehouseQuantity." in str(exc_info.value)


def test_inventory_update_blank_location_becomes_none():
    payload = InventoryUpdate(
        WarehouseQuantity=12,
        AllocatedQuantity=3,
        Location="   "
    )

    assert payload.Location is None


def test_inventory_update_valid_data():
    payload = InventoryUpdate(
        WarehouseQuantity=20,
        AllocatedQuantity=5,
        Location="  Rack 2  "
    )

    assert payload.WarehouseQuantity == 20
    assert payload.AllocatedQuantity == 5
    assert payload.Location == "Rack 2"