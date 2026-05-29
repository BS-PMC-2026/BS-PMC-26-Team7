from sqlalchemy import func
from sqlalchemy.orm import Session
from models.product import Product
from models.pepper_variety import PepperVariety
from schemas.product import ProductCreate
from typing import List
from models.inventory import Inventory

def create_product(db: Session, product_data: ProductCreate) -> Product:
    if product_data.PepperId is not None:
        pepper = (
            db.query(PepperVariety)
            .filter(PepperVariety.PepperId == product_data.PepperId)
            .first()
        )

        if not pepper:
            raise ValueError("Linked pepper variety not found.")

    product = Product(
        ProductName=product_data.ProductName,
        ProductDescription=product_data.ProductDescription,
        Category=product_data.Category,
        Price=product_data.Price,
        ImageUrl=product_data.ImageUrl,
        PepperId=product_data.PepperId,
        IsActive=product_data.IsActive,
        DiscountPercentage=product_data.DiscountPercentage,
        DiscountActive=product_data.DiscountActive,
        DiscountStartDate=product_data.DiscountStartDate,
        DiscountEndDate=product_data.DiscountEndDate,
    )

    db.add(product)
    db.commit()
    db.refresh(product)
    inventory = Inventory(
        ProductId=product.ProductId,
        WarehouseQuantity=0,
        AllocatedQuantity=0,
    )
    db.add(inventory)
    db.commit()
    db.refresh(product)
    return product


def _product_with_stock(db: Session):
    return (
        db.query(
            Product,
            func.coalesce(Inventory.AllocatedQuantity, 0).label("AllocatedQuantity"),
        )
        .outerjoin(Inventory, Inventory.ProductId == Product.ProductId)
    )


def _serialize(row) -> dict:
    product, allocated = row
    return {
        "ProductId": product.ProductId,
        "ProductName": product.ProductName,
        "ProductDescription": product.ProductDescription,
        "Category": product.Category,
        "Price": float(product.Price),
        "ImageUrl": product.ImageUrl,
        "PepperId": product.PepperId,
        "IsActive": product.IsActive,
        "AllocatedQuantity": int(allocated),
        "DiscountPercentage": float(product.DiscountPercentage or 0),
        "DiscountActive": bool(product.DiscountActive),
        "DiscountStartDate": product.DiscountStartDate,
        "DiscountEndDate": product.DiscountEndDate,
    }


def get_products(db: Session) -> List[dict]:
    rows = (
        _product_with_stock(db)
        .filter(Product.IsActive == True)
        .order_by(Product.ProductName)
        .all()
    )
    return [_serialize(r) for r in rows]


def get_product_by_id(db: Session, product_id: int) -> dict:
    row = (
        _product_with_stock(db)
        .filter(Product.ProductId == product_id)
        .first()
    )
    if not row:
        raise ValueError("Product not found.")
    return _serialize(row)


def update_product(db: Session, product_id: int, product_data: ProductCreate) -> dict:
    product = (
        db.query(Product)
        .filter(Product.ProductId == product_id)
        .first()
    )
    if not product:
        raise ValueError("Product not found.")

    if product_data.PepperId is not None:
        pepper = (
            db.query(PepperVariety)
            .filter(PepperVariety.PepperId == product_data.PepperId)
            .first()
        )
        if not pepper:
            raise ValueError("Linked pepper variety not found.")

    product.ProductName        = product_data.ProductName
    product.ProductDescription = product_data.ProductDescription
    product.Category           = product_data.Category
    product.Price              = product_data.Price
    product.ImageUrl           = product_data.ImageUrl
    product.PepperId           = product_data.PepperId
    product.IsActive           = product_data.IsActive
    product.DiscountPercentage = product_data.DiscountPercentage
    product.DiscountActive     = product_data.DiscountActive
    product.DiscountStartDate  = product_data.DiscountStartDate
    product.DiscountEndDate    = product_data.DiscountEndDate

    db.commit()
    db.refresh(product)

    return get_product_by_id(db, product.ProductId)
