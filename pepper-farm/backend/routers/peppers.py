from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError, OperationalError
from database import get_db
from schemas.pepper import PepperCreate, PepperResponse, PepperUpdate
from pathlib import Path
from uuid import uuid4
import traceback
from services.pepper_service import create_pepper, get_all_peppers, get_pepper_by_id, update_pepper , delete_pepper

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


@router.get("/{pepper_id}", response_model=PepperResponse)
def get_pepper_endpoint(pepper_id: int, db: Session = Depends(get_db)):
    pepper = get_pepper_by_id(db, pepper_id)
    if not pepper:
        raise HTTPException(status_code=404, detail=f"Pepper with id {pepper_id} not found.")
    return pepper


@router.put("/{pepper_id}", response_model=PepperResponse)
def update_pepper_endpoint(pepper_id: int, pepper: PepperUpdate, db: Session = Depends(get_db)):
    try:
        updated = update_pepper(db, pepper_id, pepper)
        if updated is None:
            raise HTTPException(status_code=404, detail=f"Pepper with id {pepper_id} not found.")
        return updated

    except IntegrityError as e:
        db.rollback()
        error_text = str(e.orig).lower()
        if "duplicate key" in error_text or "unique key" in error_text:
            raise HTTPException(
                status_code=409,
                detail=f"A pepper with that name already exists.",
            )
        raise HTTPException(status_code=400, detail="Database integrity error while updating pepper.")

    except OperationalError:
        db.rollback()
        raise HTTPException(status_code=503, detail="Database connection timeout. Please try again.")

    except HTTPException:
        raise

    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Unexpected server error.")
    
    
@router.delete("/{pepper_id}")
def delete_pepper_endpoint(pepper_id: int, db: Session = Depends(get_db)):
    try:
        deleted = delete_pepper(db, pepper_id)

        if deleted is None:
            raise HTTPException(
                status_code=404,
                detail=f"Pepper with id {pepper_id} not found."
            )

        return {"message": "Pepper deleted successfully."}

    except OperationalError:
        db.rollback()
        raise HTTPException(
            status_code=503,
            detail="Database connection timeout. Please try again."
        )

    except HTTPException:
        raise

    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Unexpected server error.")