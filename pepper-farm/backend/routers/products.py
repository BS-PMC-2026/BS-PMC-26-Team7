from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError, OperationalError
from database import get_db
from schemas.product import ProductCreate, ProductResponse
from services.product_service import create_product
import traceback

router = APIRouter(prefix="/api/products", tags=["Products"])


@router.post("", response_model=ProductResponse, status_code=201)
def create_product_endpoint(product: ProductCreate, db: Session = Depends(get_db)):
    try:
        created = create_product(db, product)
        return created

    except ValueError as e:
        db.rollback()

        if str(e) == "Linked pepper variety not found.":
            raise HTTPException(status_code=404, detail=str(e))

        raise HTTPException(status_code=400, detail=str(e))

    except IntegrityError as e:
        db.rollback()
        error_text = str(e.orig).lower()

        if "duplicate key" in error_text or "unique key" in error_text:
            raise HTTPException(
                status_code=409,
                detail=f"Product with name '{product.ProductName}' already exists.",
            )

        if "foreign key" in error_text:
            raise HTTPException(
                status_code=400,
                detail="Invalid PepperId. Linked pepper variety does not exist.",
            )

        raise HTTPException(
            status_code=400,
            detail="Database integrity error while creating product.",
        )

    except OperationalError:
        db.rollback()
        raise HTTPException(
            status_code=503,
            detail="Database connection timeout. Please try again.",
        )

    except HTTPException:
        raise

    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Unexpected server error.")