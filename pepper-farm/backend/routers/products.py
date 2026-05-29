import re
import traceback
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.orm import Session

from database import get_db
from models.email_log import EmailLog
from models.role import Role
from models.user import User
from schemas.product import ProductCreate, ProductResponse
from services.email_service import is_smtp_configured, send_email
from services.product_service import create_product, get_product_by_id, get_products, update_product
from utils.jwt import require_role

router = APIRouter(prefix="/api/products", tags=["Products"])

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _valid_email(email: str | None) -> bool:
    return bool(email and _EMAIL_RE.match(email))


def _build_discount_html(product_name: str, price: float, pct: float, end_date: Optional[datetime]) -> str:
    final_price = round(price * (1 - pct / 100), 2)
    expiry_line = (
        f"Offer expires: <strong>{end_date.strftime('%Y-%m-%d')}</strong>"
        if end_date
        else "Unlimited offer — no expiry date"
    )
    return f"""<!DOCTYPE html>
<html lang="en">
<body style="font-family:Arial,sans-serif;color:#222;max-width:600px;margin:auto;padding:24px">
  <h2 style="color:#2d6a4f">Special Discount — {product_name}</h2>
  <p>We are excited to offer you an exclusive discount on <strong>{product_name}</strong>!</p>
  <table style="border-collapse:collapse;width:100%">
    <tr><td style="padding:6px 0;color:#555">Original price:</td>
        <td style="padding:6px 0;text-decoration:line-through;color:#888">₪{price:.2f}</td></tr>
    <tr><td style="padding:6px 0;color:#555">Discount:</td>
        <td style="padding:6px 0;color:#e63946"><strong>{pct:.0f}% OFF</strong></td></tr>
    <tr><td style="padding:6px 0;color:#555">Your price:</td>
        <td style="padding:6px 0;color:#2d6a4f;font-size:1.2em"><strong>₪{final_price:.2f}</strong></td></tr>
  </table>
  <p style="color:#555;margin-top:12px">{expiry_line}</p>
  <p><a href="#" style="background:#2d6a4f;color:#fff;padding:10px 20px;
     text-decoration:none;border-radius:4px;display:inline-block;margin-top:8px">
     Visit Our Catalog
  </a></p>
  <hr style="border:none;border-top:1px solid #ddd;margin:24px 0">
  <p style="font-size:12px;color:#888">You are receiving this email because you opted in to
  promotional notifications from Pepper Farm.</p>
</body>
</html>"""


def _send_discount_notification(
    db: Session,
    product_name: str,
    price: float,
    pct: float,
    end_date: Optional[datetime],
    product_id: int,
    manager_id: Optional[int],
) -> int:
    """Send discount promo emails to opted-in customers. Returns count of emails sent."""
    if not is_smtp_configured():
        return 0

    try:
        customers = (
            db.query(User)
            .join(Role, User.RoleId == Role.RoleId)
            .filter(
                Role.RoleName == "Visitor",
                text("Users.EmailConsent = 1"),
                User.IsActive == True,  # noqa: E712
            )
            .all()
        )
    except OperationalError:
        db.rollback()
        print(
            "[products] EmailConsent column not found — "
            "run database/migrations/add_email_consent_to_users.sql. "
            "Falling back to all active Visitors."
        )
        customers = (
            db.query(User)
            .join(Role, User.RoleId == Role.RoleId)
            .filter(
                Role.RoleName == "Visitor",
                User.IsActive == True,  # noqa: E712
            )
            .all()
        )

    subject = f"New Discount: {pct:.0f}% OFF {product_name}"
    html_body = _build_discount_html(product_name, price, pct, end_date)
    plain_body = (
        f"New discount on {product_name}!\n"
        f"Original: {price:.2f}  →  Your price: {round(price * (1 - pct / 100), 2):.2f} ({pct:.0f}% OFF)\n"
        + (f"Expires: {end_date.strftime('%Y-%m-%d')}" if end_date else "Unlimited offer")
    )

    sent = 0
    for user in customers:
        if not _valid_email(user.Email):
            log = EmailLog(
                RecipientEmail=user.Email or "",
                RecipientName=user.FullName,
                RecipientType="customer",
                Subject=subject,
                MessagePreview=plain_body[:200],
                EmailType="discount_promotion",
                Status="skipped",
                ErrorMessage="Invalid email address",
                RelatedProductId=product_id,
                RelatedDiscountPercentage=pct,
                CreatedBy=manager_id,
            )
            db.add(log)
            continue

        try:
            send_email(user.Email, subject, html_body, plain_body)
            sent += 1
            log = EmailLog(
                RecipientEmail=user.Email,
                RecipientName=user.FullName,
                RecipientType="customer",
                Subject=subject,
                MessagePreview=plain_body[:200],
                EmailType="discount_promotion",
                Status="sent",
                SentAtUtc=datetime.now(timezone.utc).replace(tzinfo=None),
                RelatedProductId=product_id,
                RelatedDiscountPercentage=pct,
                CreatedBy=manager_id,
            )
            db.add(log)
        except Exception as exc:
            log = EmailLog(
                RecipientEmail=user.Email,
                RecipientName=user.FullName,
                RecipientType="customer",
                Subject=subject,
                MessagePreview=plain_body[:200],
                EmailType="discount_promotion",
                Status="failed",
                ErrorMessage=str(exc)[:500],
                RelatedProductId=product_id,
                RelatedDiscountPercentage=pct,
                CreatedBy=manager_id,
            )
            db.add(log)

    try:
        db.commit()
    except Exception:
        db.rollback()

    return sent


def _is_new_discount(data: ProductCreate) -> bool:
    return bool(data.DiscountActive and data.DiscountPercentage and data.DiscountPercentage > 0)


def _discount_changed(old: dict, new: ProductCreate) -> bool:
    """Return True when the discount has meaningfully changed and warrants a new notification."""
    old_active = bool(old.get("DiscountActive"))
    new_active = bool(new.DiscountActive)

    if not new_active or not (new.DiscountPercentage and new.DiscountPercentage > 0):
        return False

    if not old_active:
        return True

    old_pct = float(old.get("DiscountPercentage") or 0)
    new_pct = float(new.DiscountPercentage or 0)
    if abs(old_pct - new_pct) >= 0.01:
        return True

    def _dt_key(v) -> str:
        return v.isoformat() if isinstance(v, datetime) else (str(v) if v else "")

    if _dt_key(old.get("DiscountEndDate")) != _dt_key(new.DiscountEndDate):
        return True

    return False


@router.post("", response_model=ProductResponse, status_code=201)
def create_product_endpoint(
    product: ProductCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("FarmManager")),
):
    try:
        created = create_product(db, product)
        notification_sent = False

        if _is_new_discount(product):
            try:
                _send_discount_notification(
                    db=db,
                    product_name=created.ProductName,
                    price=float(created.Price),
                    pct=float(created.DiscountPercentage),
                    end_date=created.DiscountEndDate,
                    product_id=created.ProductId,
                    manager_id=current_user["user_id"],
                )
                notification_sent = True
            except Exception:
                traceback.print_exc()

        resp = ProductResponse.model_validate(created)
        return resp.model_copy(update={"emailNotificationSent": notification_sent})

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


@router.get("", response_model=list[ProductResponse])
def get_products_endpoint(db: Session = Depends(get_db)):
    try:
        return get_products(db)
    except OperationalError:
        raise HTTPException(
            status_code=503,
            detail="Database connection timeout. Please try again.",
        )
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Unexpected server error.")


@router.get("/{product_id}", response_model=ProductResponse)
def get_product_endpoint(product_id: int, db: Session = Depends(get_db)):
    try:
        return get_product_by_id(db, product_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except OperationalError:
        raise HTTPException(status_code=503, detail="Database connection timeout. Please try again.")
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Unexpected server error.")


@router.put("/{product_id}", response_model=ProductResponse)
def update_product_endpoint(
    product_id: int,
    product: ProductCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("FarmManager")),
):
    try:
        # Capture previous discount state before update for change detection.
        old = get_product_by_id(db, product_id)

        updated = update_product(db, product_id, product)

        notification_sent = False
        if _discount_changed(old, product):
            try:
                _send_discount_notification(
                    db=db,
                    product_name=updated["ProductName"],
                    price=float(updated["Price"]),
                    pct=float(updated["DiscountPercentage"]),
                    end_date=updated.get("DiscountEndDate"),
                    product_id=product_id,
                    manager_id=current_user["user_id"],
                )
                notification_sent = True
            except Exception:
                traceback.print_exc()

        resp = ProductResponse.model_validate(updated)
        return resp.model_copy(update={"emailNotificationSent": notification_sent})

    except ValueError as e:
        db.rollback()
        if str(e) == "Product not found.":
            raise HTTPException(status_code=404, detail=str(e))
        if str(e) == "Linked pepper variety not found.":
            raise HTTPException(status_code=404, detail=str(e))
        raise HTTPException(status_code=400, detail=str(e))

    except IntegrityError as e:
        db.rollback()
        error_text = str(e.orig).lower()
        if "duplicate key" in error_text or "unique key" in error_text:
            raise HTTPException(status_code=409, detail=f"Product with name '{product.ProductName}' already exists.")
        raise HTTPException(status_code=400, detail="Database integrity error while updating product.")

    except OperationalError:
        db.rollback()
        raise HTTPException(status_code=503, detail="Database connection timeout. Please try again.")

    except HTTPException:
        raise

    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Unexpected server error.")
