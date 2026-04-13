from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError, OperationalError
from database import get_db
from schemas.pepper import PepperCreate, PepperResponse
from services.pepper_service import create_pepper
from pathlib import Path
from uuid import uuid4
import traceback
from services.pepper_service import create_pepper, get_all_peppers

router = APIRouter(prefix="/api/peppers", tags=["Peppers"])


@router.post("", response_model=PepperResponse, status_code=201)
def create_pepper_endpoint(pepper: PepperCreate, db: Session = Depends(get_db)):
    try:
        created = create_pepper(db, pepper)
        return created

    except IntegrityError as e:
        db.rollback()
        error_text = str(e.orig).lower()

        if "duplicate key" in error_text or "unique key" in error_text:
            raise HTTPException(
                status_code=409,
                detail=f"Pepper with name '{pepper.PepperName}' already exists.",
            )

        raise HTTPException(
            status_code=400,
            detail="Database integrity error while creating pepper.",
        )

    except OperationalError:
        db.rollback()
        raise HTTPException(
            status_code=503,
            detail="Database connection timeout. Please try again.",
        )

    except HTTPException:
        raise

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Unexpected server error.")


@router.post("/upload-image")
async def upload_pepper_image(file: UploadFile = File(...)):
    allowed_types = {"image/jpeg", "image/png", "image/webp", "image/jpg"}

    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail="Only JPG, PNG, and WEBP images are allowed.",
        )

    uploads_dir = Path(__file__).resolve().parent.parent / "uploads" / "pepper_images"
    uploads_dir.mkdir(parents=True, exist_ok=True)

    extension = Path(file.filename).suffix.lower()
    unique_filename = f"{uuid4().hex}{extension}"
    file_path = uploads_dir / unique_filename

    with open(file_path, "wb") as buffer:
        content = await file.read()
        buffer.write(content)

    return {
        "message": "Image uploaded successfully.",
        "imageUrl": f"/uploads/pepper_images/{unique_filename}",
    }

@router.get("", response_model=list[PepperResponse])
def list_peppers_endpoint(db: Session = Depends(get_db)):
    return get_all_peppers(db)