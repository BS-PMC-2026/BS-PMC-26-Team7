from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Dict, List
from models.inventory import Inventory
from models.product import Product
from models.plant import Plant
from models.pepper_variety import PepperVariety
from models.farm_zone import FarmZone
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


def get_inventory_by_variety(db: Session) -> List[dict]:
    """Group plants by their pepper variety, with total warehouse stock for
    products of that variety and the list of plants (with their unique ids)."""
    # 1. All active varieties — single query
    varieties = (
        db.query(PepperVariety)
        .filter(PepperVariety.IsActive == True)
        .order_by(PepperVariety.PepperName)
        .all()
    )
    if not varieties:
        return []

    pepper_ids = [v.PepperId for v in varieties]

    # 2. All active plants for those varieties — single query
    all_plants = (
        db.query(Plant)
        .filter(Plant.PepperId.in_(pepper_ids), Plant.IsActive == True)
        .order_by(Plant.PlantCode)
        .all()
    )
    plants_by_pepper: Dict[int, list] = {}
    for p in all_plants:
        plants_by_pepper.setdefault(p.PepperId, []).append(p)

    # 3. Warehouse totals per variety — single GROUP BY query
    qty_rows = (
        db.query(Product.PepperId, func.coalesce(func.sum(Inventory.WarehouseQuantity), 0))
        .join(Inventory, Inventory.ProductId == Product.ProductId)
        .filter(Product.PepperId.in_(pepper_ids))
        .group_by(Product.PepperId)
        .all()
    )
    qty_by_pepper = {row[0]: int(row[1]) for row in qty_rows}

    # 4. Zone names for all referenced zones — single query
    zone_ids = list({p.ZoneId for p in all_plants if p.ZoneId is not None})
    zone_name_by_id: Dict[int, str] = {}
    if zone_ids:
        zone_rows = db.query(FarmZone).filter(FarmZone.ZoneId.in_(zone_ids)).all()
        zone_name_by_id = {z.ZoneId: z.ZoneName for z in zone_rows}

    results = []
    for v in varieties:
        plants = plants_by_pepper.get(v.PepperId, [])
        # Status breakdown: count plants per status
        status_breakdown: Dict[str, int] = {}
        for p in plants:
            key = p.Status or "Unknown"
            status_breakdown[key] = status_breakdown.get(key, 0) + 1

        results.append({
            "PepperId": v.PepperId,
            "PepperName": v.PepperName,
            "PlantCount": len(plants),
            "TotalWarehouseQuantity": qty_by_pepper.get(v.PepperId, 0),
            "StatusBreakdown": status_breakdown,
            "Plants": [
                {
                    "PlantId": p.PlantId,
                    "PlantCode": p.PlantCode,
                    "Status": p.Status,
                    "ZoneId": p.ZoneId,
                    "ZoneName": zone_name_by_id.get(p.ZoneId) if p.ZoneId else None,
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
) -> List[dict]:
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