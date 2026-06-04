"""
US41 Pricing Service
====================
Single authoritative source for price calculation.
Order: base price → product discount (US38) → employee discount → coupon.

NEVER trust frontend prices.  Always recompute here.
"""
from datetime import datetime, timezone
from typing import Optional, List, Dict
from sqlalchemy.orm import Session
from sqlalchemy import text

from models.product import Product
from models.inventory import Inventory
from models.coupon import Coupon, CouponRedemption
from models.employee_discount import EmployeeDiscountSetting, EmployeeDiscountProductOverride


# ── Luhn validation ───────────────────────────────────────────────────────────

def luhn_check(card_number: str) -> bool:
    """Return True if the card number passes the Luhn algorithm.
    Strips spaces and dashes before checking so callers can pass
    formatted strings like '4111 1111 1111 1111'.
    """
    cleaned = card_number.replace(" ", "").replace("-", "")
    if not cleaned.isdigit():
        return False
    digits = [int(d) for d in cleaned]
    checksum = 0
    odd = True
    for d in reversed(digits):
        if odd:
            checksum += d
        else:
            doubled = d * 2
            checksum += doubled if doubled < 10 else doubled - 9
        odd = not odd
    return checksum % 10 == 0


def detect_card_brand(card_number: str) -> str:
    """Detect common card brands from the card number prefix."""
    if card_number.startswith("4"):
        return "Visa"
    if card_number[:2] in ("51", "52", "53", "54", "55") or (
        2221 <= int(card_number[:4]) <= 2720
    ):
        return "Mastercard"
    if card_number[:4] in ("3714", "3787") or card_number[:2] in ("34", "37"):
        return "Amex"
    if card_number[:4] == "6011" or card_number[:2] == "65":
        return "Discover"
    return "Unknown"


# ── Product discount (US38) ───────────────────────────────────────────────────

def get_product_discount_pct(product: Product) -> float:
    """Return the currently valid US38 product discount percentage, or 0."""
    if not product.DiscountActive:
        return 0.0
    pct = float(product.DiscountPercentage or 0)
    if pct <= 0:
        return 0.0
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    if product.DiscountStartDate and product.DiscountStartDate > now:
        return 0.0
    if product.DiscountEndDate and product.DiscountEndDate < now:
        return 0.0
    return pct


# ── Employee discount ─────────────────────────────────────────────────────────

def get_employee_discount_pct(db: Session, product_id: int) -> float:
    """Return the employee discount % for a product.  0 if excluded."""
    setting = db.query(EmployeeDiscountSetting).filter(
        EmployeeDiscountSetting.Active == True  # noqa: E712
    ).first()
    if not setting:
        return 40.0  # hard default

    global_pct = float(setting.GlobalDiscountPercent)

    override = db.query(EmployeeDiscountProductOverride).filter(
        EmployeeDiscountProductOverride.ProductId == product_id
    ).first()

    if not override or override.Mode == "use_global":
        return global_pct
    if override.Mode == "excluded":
        return 0.0
    if override.Mode == "custom_percent" and override.CustomDiscountPercent is not None:
        return float(override.CustomDiscountPercent)
    return global_pct


# ── Coupon ────────────────────────────────────────────────────────────────────

def validate_coupon(
    db: Session,
    code: str,
    user_id: int,
    subtotal_after_item_discounts: float,
) -> tuple[Optional[Coupon], Optional[str]]:
    """Return (coupon, error_message).  Error is None when coupon is valid."""
    coupon = db.query(Coupon).filter(
        Coupon.Code == code.upper().strip(),
        Coupon.Active == True,  # noqa: E712
    ).first()
    if not coupon:
        return None, "Coupon not found or inactive."

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    if coupon.StartsAtUtc and coupon.StartsAtUtc > now:
        return None, "Coupon is not yet active."
    if coupon.EndsAtUtc and coupon.EndsAtUtc < now:
        return None, "Coupon has expired."

    if coupon.MaxTotalUses is not None and coupon.CurrentUseCount >= coupon.MaxTotalUses:
        return None, "Coupon usage limit reached."

    if coupon.MaxUsesPerUser is not None:
        user_uses = db.query(CouponRedemption).filter(
            CouponRedemption.CouponId == coupon.CouponId,
            CouponRedemption.UserId   == user_id,
        ).count()
        if user_uses >= coupon.MaxUsesPerUser:
            return None, "You have already used this coupon the maximum number of times."

    min_amount = float(coupon.MinimumOrderAmount or 0)
    if subtotal_after_item_discounts < min_amount:
        return None, f"Minimum order amount of {min_amount:.2f} required for this coupon."

    return coupon, None


def compute_coupon_discount(coupon: Coupon, subtotal: float) -> float:
    """Return the coupon discount amount (never negative, never > subtotal)."""
    if coupon.DiscountType == "percentage":
        discount = round(subtotal * float(coupon.DiscountValue) / 100, 2)
    else:
        discount = float(coupon.DiscountValue)
    return max(0.0, min(discount, subtotal))


# ── Core price calculation ────────────────────────────────────────────────────

class PriceLineItem:
    def __init__(
        self,
        product_id: int,
        product_name: str,
        unit_price_original: float,
        unit_price_after_product_discount: float,
        unit_price_after_employee_discount: float,
        quantity: int,
        product_discount_pct: Optional[float],
        employee_discount_pct: Optional[float],
        available_stock: int,
        is_available: bool,
        stock_warning: Optional[str],
    ):
        self.productId                      = product_id
        self.productName                    = product_name
        self.unitPriceOriginal              = unit_price_original
        self.unitPriceAfterProductDiscount  = unit_price_after_product_discount
        self.unitPriceAfterEmployeeDiscount = unit_price_after_employee_discount
        self.quantity                       = quantity
        self.lineSubtotal                   = round(unit_price_original * quantity, 2)
        self.lineDiscountTotal              = round(
            (unit_price_original - unit_price_after_employee_discount) * quantity, 2
        )
        self.lineTotal                      = round(unit_price_after_employee_discount * quantity, 2)
        self.productDiscountPct             = product_discount_pct
        self.employeeDiscountPct            = employee_discount_pct
        self.availableStock                 = available_stock
        self.isAvailable                    = is_available
        self.stockWarning                   = stock_warning
        # pre-set — coupon applied later at the basket level
        self.unitPriceForUser               = unit_price_after_employee_discount


class PriceBreakdown:
    def __init__(
        self,
        lines: List[PriceLineItem],
        coupon: Optional[Coupon],
        coupon_discount: float,
    ):
        self.lines                  = lines
        self.originalSubtotal       = round(sum(l.lineSubtotal for l in lines), 2)
        self.productDiscountTotal   = round(
            sum(
                (l.unitPriceOriginal - l.unitPriceAfterProductDiscount) * l.quantity
                for l in lines
            ),
            2,
        )
        self.employeeDiscountTotal  = round(
            sum(
                (l.unitPriceAfterProductDiscount - l.unitPriceAfterEmployeeDiscount) * l.quantity
                for l in lines
            ),
            2,
        )
        self.couponDiscountTotal    = round(coupon_discount, 2)
        subtotal_before_coupon      = round(sum(l.lineTotal for l in lines), 2)
        self.finalTotal             = max(0.0, round(subtotal_before_coupon - coupon_discount, 2))
        self.coupon                 = coupon
        self.hasBlockingIssues      = any(not l.isAvailable for l in lines)


def calculate_prices(
    db: Session,
    items: List[Dict],            # [{productId, quantity}]
    user_role: str,
    coupon_code: Optional[str],
    user_id: int,
) -> PriceBreakdown:
    """
    Compute the full price breakdown for a list of {productId, quantity} items.
    This is the single authoritative source for all pricing.
    """
    lines: List[PriceLineItem] = []

    for item in items:
        product_id = item["productId"]
        quantity   = item["quantity"]

        product = db.query(Product).filter(
            Product.ProductId == product_id
        ).first()

        if not product:
            # Product doesn't exist — blocking
            lines.append(PriceLineItem(
                product_id=product_id,
                product_name=f"Product #{product_id}",
                unit_price_original=0.0,
                unit_price_after_product_discount=0.0,
                unit_price_after_employee_discount=0.0,
                quantity=quantity,
                product_discount_pct=None,
                employee_discount_pct=None,
                available_stock=0,
                is_available=False,
                stock_warning="Product not found.",
            ))
            continue

        base_price = float(product.Price)

        # Step 1: US38 product discount
        prod_disc_pct = get_product_discount_pct(product)
        price_after_product = round(base_price * (1 - prod_disc_pct / 100), 2)

        # Step 2: Employee discount (Worker only)
        emp_disc_pct: Optional[float] = None
        price_after_employee = price_after_product
        if user_role == "Worker":
            emp_disc_pct = get_employee_discount_pct(db, product_id)
            if emp_disc_pct > 0:
                price_after_employee = round(price_after_product * (1 - emp_disc_pct / 100), 2)

        # Stock check
        inv = db.query(Inventory).filter(Inventory.ProductId == product_id).first()
        available_stock = int(inv.AllocatedQuantity) if inv else 0

        is_available = product.IsActive
        stock_warning: Optional[str] = None

        if not product.IsActive:
            is_available = False
            stock_warning = "This product is no longer available."
        elif available_stock <= 0:
            is_available = False
            stock_warning = "Out of stock."
        elif quantity > available_stock:
            is_available = False
            stock_warning = f"Only {available_stock} available. Please reduce quantity."

        lines.append(PriceLineItem(
            product_id=product_id,
            product_name=product.ProductName,
            unit_price_original=base_price,
            unit_price_after_product_discount=price_after_product,
            unit_price_after_employee_discount=price_after_employee,
            quantity=quantity,
            product_discount_pct=prod_disc_pct if prod_disc_pct > 0 else None,
            employee_discount_pct=emp_disc_pct if emp_disc_pct and emp_disc_pct > 0 else None,
            available_stock=available_stock,
            is_available=is_available,
            stock_warning=stock_warning,
        ))

    # Step 3: Coupon (applied to subtotal after all item discounts)
    coupon_discount = 0.0
    validated_coupon: Optional[Coupon] = None
    if coupon_code:
        subtotal_after_items = round(sum(l.lineTotal for l in lines), 2)
        validated_coupon, _ = validate_coupon(db, coupon_code, user_id, subtotal_after_items)
        if validated_coupon:
            coupon_discount = compute_coupon_discount(validated_coupon, subtotal_after_items)

    return PriceBreakdown(lines, validated_coupon, coupon_discount)
