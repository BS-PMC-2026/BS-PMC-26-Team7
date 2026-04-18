from sqlalchemy.orm import Session
from typing import List
from models.inventory import Inventory
from models.product import Product
from schemas.inventory import InventoryUpdate


def _to_response_dict(inv: Inventory, product_name: str | None) -> dict:
    return {
        "InventoryId": inv.InventoryId,
        "ProductId": inv.ProductId,
        "ProductName": product_name,
        "WarehouseQuantity": inv.WarehouseQuantity,
        "AllocatedQuantity": inv.AllocatedQuantity,
        "LastUpdatedAt": inv.LastUpdatedAt,
    }


def get_inventory_list(db: Session) -> List[dict]:
    rows = (
        db.query(Inventory, Product.ProductName)
        .join(Product, Product.ProductId == Inventory.ProductId)
        .order_by(Product.ProductName)
        .all()
    )
    return [_to_response_dict(inv, name) for inv, name in rows]


def get_inventory_by_product_id(db: Session, product_id: int) -> dict:
    row = (
        db.query(Inventory, Product.ProductName)
        .join(Product, Product.ProductId == Inventory.ProductId)
        .filter(Inventory.ProductId == product_id)
        .first()
    )
    if not row:
        raise ValueError("Inventory record not found for this product.")
    inv, name = row
    return _to_response_dict(inv, name)


def update_inventory(
    db: Session, product_id: int, payload: InventoryUpdate
) -> dict:
    inv = (
        db.query(Inventory)
        .filter(Inventory.ProductId == product_id)
        .first()
    )
    if not inv:
        raise ValueError("Inventory record not found for this product.")

    # Defence-in-depth: schema already enforces this, but guard again
    if payload.AllocatedQuantity > payload.WarehouseQuantity:
        raise ValueError("AllocatedQuantity cannot exceed WarehouseQuantity.")

    inv.WarehouseQuantity = payload.WarehouseQuantity
    inv.AllocatedQuantity = payload.AllocatedQuantity

    db.commit()
    db.refresh(inv)

    product_name = (
        db.query(Product.ProductName)
        .filter(Product.ProductId == inv.ProductId)
        .scalar()
    )
    return _to_response_dict(inv, product_name)