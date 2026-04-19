from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from models.inventory import Inventory
from models.product import Product
from models.plant import Plant
from models.pepper_variety import PepperVariety
from schemas.inventory import InventoryCreate, InventoryUpdate


def _row_to_response(inv: Inventory, product_name: str | None) -> dict:
    display = product_name or inv.ItemName
    return {
        "InventoryId": inv.InventoryId,
        "ProductId": inv.ProductId,
        "ProductName": product_name,
        "ItemName": inv.ItemName,
        "DisplayName": display,
        "Location": inv.Location,
        "WarehouseQuantity": inv.WarehouseQuantity,
        "AllocatedQuantity": inv.AllocatedQuantity,
        "LastUpdatedAt": inv.LastUpdatedAt,
    }


def get_inventory_list(db: Session) -> List[dict]:
    rows = (
        db.query(Inventory, Product.ProductName)
        .outerjoin(Product, Product.ProductId == Inventory.ProductId)
        .order_by(func.coalesce(Product.ProductName, Inventory.ItemName))
        .all()
    )
    return [_row_to_response(inv, name) for inv, name in rows]


def get_inventory_by_id(db: Session, inventory_id: int) -> dict:
    row = (
        db.query(Inventory, Product.ProductName)
        .outerjoin(Product, Product.ProductId == Inventory.ProductId)
        .filter(Inventory.InventoryId == inventory_id)
        .first()
    )
    if not row:
        raise ValueError("Inventory record not found.")
    inv, name = row
    return _row_to_response(inv, name)


def create_warehouse_item(db: Session, payload: InventoryCreate) -> dict:
    """Create a warehouse-only inventory row (no linked product)."""
    inv = Inventory(
        ProductId=None,
        ItemName=payload.ItemName,
        Location=payload.Location,
        WarehouseQuantity=payload.WarehouseQuantity,
        AllocatedQuantity=0,
    )
    db.add(inv)
    db.commit()
    db.refresh(inv)
    return _row_to_response(inv, None)


def update_inventory(db: Session, inventory_id: int, payload: InventoryUpdate) -> dict:
    inv = db.query(Inventory).filter(Inventory.InventoryId == inventory_id).first()
    if not inv:
        raise ValueError("Inventory record not found.")

    # Warehouse-only rows can never have AllocatedQuantity > 0
    if inv.ProductId is None and payload.AllocatedQuantity > 0:
        raise ValueError("AllocatedQuantity must be 0 for warehouse-only items.")

    if payload.AllocatedQuantity > payload.WarehouseQuantity:
        raise ValueError("AllocatedQuantity cannot exceed WarehouseQuantity.")

    inv.WarehouseQuantity = payload.WarehouseQuantity
    inv.AllocatedQuantity = payload.AllocatedQuantity
    inv.Location = payload.Location
    db.commit()
    db.refresh(inv)

    product_name = (
        db.query(Product.ProductName)
        .filter(Product.ProductId == inv.ProductId)
        .scalar()
        if inv.ProductId else None
    )
    return _row_to_response(inv, product_name)


def get_inventory_by_variety(db: Session) -> list[dict]:
    """Group plants by their pepper variety, with total warehouse stock for
    products of that variety and the list of plants (with their unique ids)."""
    varieties = (
        db.query(PepperVariety)
        .filter(PepperVariety.IsActive == True)
        .order_by(PepperVariety.PepperName)
        .all()
    )

    results: list[dict] = []
    for v in varieties:
        plants = (
            db.query(Plant)
            .filter(Plant.PepperId == v.PepperId, Plant.IsActive == True)
            .order_by(Plant.PlantCode)
            .all()
        )

        # Total warehouse quantity across all Products of this variety
        total_qty = (
            db.query(func.coalesce(func.sum(Inventory.WarehouseQuantity), 0))
            .join(Product, Product.ProductId == Inventory.ProductId)
            .filter(Product.PepperId == v.PepperId)
            .scalar()
        ) or 0

        results.append({
            "PepperId": v.PepperId,
            "PepperName": v.PepperName,
            "PlantCount": len(plants),
            "TotalWarehouseQuantity": int(total_qty),
            "Plants": [
                {
                    "PlantId": p.PlantId,
                    "PlantCode": p.PlantCode,
                    "Status": p.Status,
                    "ZoneId": p.ZoneId,
                }
                for p in plants
            ],
        })
    return results

LOW_STOCK_THRESHOLD = 10

def get_inventory_report(
    db: Session,
    category: str | None = None,
    low_stock_only: bool = False,
    sort_by: str = "name",
) -> list[dict]:
    """BSPMT7-111 BSPMT7-112: Inventory report with filtering/sorting"""
    rows = (
        db.query(Inventory, Product.ProductName, Product.Category)
        .outerjoin(Product, Product.ProductId == Inventory.ProductId)
        .all()
    )

    report = []
    for inv, product_name, product_category in rows:
        available = inv.WarehouseQuantity - inv.AllocatedQuantity
        is_low_stock = available < LOW_STOCK_THRESHOLD
        display_name = product_name or inv.ItemName or "Unknown"
        row_category = product_category or "Uncategorized"

        report.append({
            "InventoryId":        inv.InventoryId,
            "DisplayName":        display_name,
            "Category":           row_category,
            "Location":           inv.Location,
            "WarehouseQuantity":  inv.WarehouseQuantity,
            "AllocatedQuantity":  inv.AllocatedQuantity,
            "AvailableQuantity":  available,
            "LowStock":           is_low_stock,
            "LastUpdatedAt":      inv.LastUpdatedAt,
        })

    if category and category.strip():
        report = [r for r in report if r["Category"].lower() == category.lower()]

    if low_stock_only:
        report = [r for r in report if r["LowStock"]]

    if sort_by == "quantity":
        report.sort(key=lambda r: r["AvailableQuantity"])
    elif sort_by == "category":
        report.sort(key=lambda r: (r["Category"], r["DisplayName"]))
    else:
        report.sort(key=lambda r: r["DisplayName"].lower())

    return report