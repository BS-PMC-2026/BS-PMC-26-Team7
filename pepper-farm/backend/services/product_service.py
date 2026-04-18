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

def get_products(db: Session) -> List[Product]:
    return (
        db.query(Product)
        .filter(Product.IsActive == True)
        .order_by(Product.ProductName)
        .all()
    )

def get_product_by_id(db: Session, product_id: int) -> Product:
    product = db.query(Product).filter(Product.ProductId == product_id).first()
    if not product:
        raise ValueError("Product not found.")
    return product


def update_product(db: Session, product_id: int, product_data: ProductCreate) -> Product:
    product = get_product_by_id(db, product_id)

    if product_data.PepperId is not None:
        pepper = (
            db.query(PepperVariety)
            .filter(PepperVariety.PepperId == product_data.PepperId)
            .first()
        )
        if not pepper:
            raise ValueError("Linked pepper variety not found.")

    product.ProductName = product_data.ProductName
    product.ProductDescription = product_data.ProductDescription
    product.Category = product_data.Category
    product.Price = product_data.Price
    product.ImageUrl = product_data.ImageUrl
    product.PepperId = product_data.PepperId
    product.IsActive = product_data.IsActive

    db.commit()
    db.refresh(product)
    return product