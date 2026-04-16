from sqlalchemy.orm import Session
from models.product import Product
from models.pepper_variety import PepperVariety
from schemas.product import ProductCreate


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
    return product