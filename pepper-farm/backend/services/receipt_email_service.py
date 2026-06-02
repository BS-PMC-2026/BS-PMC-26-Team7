"""
US41 — Transactional receipt/invoice email.

IMPORTANT: This is a TRANSACTIONAL email, not marketing.
- Sent to every buyer regardless of EmailConsent / newsletter subscription.
- Does NOT include an unsubscribe footer.
- EmailLogs.EmailType = 'order_receipt' (not 'newsletter' or 'promotion').
"""
import traceback
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from models.email_log import EmailLog
from models.order import Order, OrderItem
from models.payment import PaymentRecord
from models.user import User
from services.email_service import is_smtp_configured, send_email


def _build_receipt_html(
    order: Order,
    items: list,
    payment: PaymentRecord,
    customer_name: str,
    customer_email: str,
) -> str:
    rows_html = ""
    for i in items:
        emp_disc = f" (emp. {i.EmployeeDiscountAppliedPercent:.0f}%)" if i.EmployeeDiscountAppliedPercent else ""
        prod_disc = f" ({i.ProductDiscountAppliedPercent:.0f}% OFF)" if i.ProductDiscountAppliedPercent else ""
        rows_html += f"""
        <tr>
          <td style="padding:6px 0;border-bottom:1px solid #f0f0f0">{i.ProductNameSnapshot}</td>
          <td style="padding:6px 0;border-bottom:1px solid #f0f0f0;text-align:center">{i.Quantity}</td>
          <td style="padding:6px 0;border-bottom:1px solid #f0f0f0;text-align:right">
            &#8362;{float(i.UnitPriceOriginal):.2f}{prod_disc}{emp_disc}
          </td>
          <td style="padding:6px 0;border-bottom:1px solid #f0f0f0;text-align:right;color:#2d6a4f;font-weight:bold">
            &#8362;{float(i.LineTotal):.2f}
          </td>
        </tr>"""

    pay_method = "Mock Credit Card" if payment.PaymentMethod == "mock_credit_card" else "Mock PayPal"
    card_info  = f" ({payment.CardBrand} ****{payment.CardLast4})" if payment.CardLast4 else ""
    coupon_row = ""
    if float(order.CouponDiscountTotal) > 0:
        coupon_row = f"""
        <tr><td colspan="3" style="padding:4px 0;text-align:right;color:#555">
          Coupon ({order.CouponCode}):
        </td><td style="padding:4px 0;text-align:right;color:#e63946">
          -&#8362;{float(order.CouponDiscountTotal):.2f}
        </td></tr>"""

    emp_row = ""
    if float(order.EmployeeDiscountTotal) > 0:
        emp_row = f"""
        <tr><td colspan="3" style="padding:4px 0;text-align:right;color:#555">
          Employee discount:
        </td><td style="padding:4px 0;text-align:right;color:#e63946">
          -&#8362;{float(order.EmployeeDiscountTotal):.2f}
        </td></tr>"""

    prod_disc_row = ""
    if float(order.ProductDiscountTotal) > 0:
        prod_disc_row = f"""
        <tr><td colspan="3" style="padding:4px 0;text-align:right;color:#555">
          Product discounts:
        </td><td style="padding:4px 0;text-align:right;color:#e63946">
          -&#8362;{float(order.ProductDiscountTotal):.2f}
        </td></tr>"""

    return f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Order Confirmation</title></head>
<body style="font-family:Arial,sans-serif;color:#222;background:#f5f5f5;margin:0;padding:0">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:24px 0">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0"
       style="max-width:600px;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">
  <tr><td style="background:#2d6a4f;padding:24px 32px">
    <h1 style="margin:0;color:#fff;font-size:22px">&#127757; PepperFarm</h1>
    <p style="margin:8px 0 0;color:#c8e6c9;font-size:14px">Order Confirmation</p>
  </td></tr>
  <tr><td style="padding:28px 32px">
    <p>Hi <strong>{customer_name}</strong>,</p>
    <p>Thank you for your order! Here is your receipt.</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0">
      <tr>
        <td style="color:#555;font-size:13px">Order number:</td>
        <td style="font-weight:bold;text-align:right">{order.OrderNumber}</td>
      </tr>
      <tr>
        <td style="color:#555;font-size:13px">Order date:</td>
        <td style="text-align:right">{order.CreatedAtUtc.strftime('%Y-%m-%d %H:%M') if order.CreatedAtUtc else '—'} UTC</td>
      </tr>
      <tr>
        <td style="color:#555;font-size:13px">Payment:</td>
        <td style="text-align:right">{pay_method}{card_info}</td>
      </tr>
      <tr>
        <td style="color:#555;font-size:13px">Transaction ID:</td>
        <td style="text-align:right;font-family:monospace;font-size:12px">{payment.MockTransactionId or '—'}</td>
      </tr>
    </table>

    <h3 style="color:#2d6a4f;border-bottom:2px solid #f0f0f0;padding-bottom:8px">Items Ordered</h3>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr style="font-size:12px;color:#888;text-transform:uppercase">
        <th style="text-align:left;padding-bottom:8px">Product</th>
        <th style="text-align:center;padding-bottom:8px">Qty</th>
        <th style="text-align:right;padding-bottom:8px">Unit Price</th>
        <th style="text-align:right;padding-bottom:8px">Total</th>
      </tr>
      {rows_html}
      <tr><td colspan="4" style="height:8px"></td></tr>
      <tr><td colspan="3" style="padding:4px 0;text-align:right;color:#555">Subtotal:</td>
          <td style="padding:4px 0;text-align:right">&#8362;{float(order.Subtotal):.2f}</td></tr>
      {prod_disc_row}
      {emp_row}
      {coupon_row}
      <tr><td colspan="3" style="padding:8px 0;text-align:right;font-weight:bold;font-size:16px">Total:</td>
          <td style="padding:8px 0;text-align:right;font-weight:bold;font-size:16px;color:#2d6a4f">
            &#8362;{float(order.TotalAmount):.2f}</td></tr>
    </table>

    <p style="color:#888;font-size:12px;margin-top:20px">
      ⚠ This is a <strong>mock payment</strong> for demonstration purposes only.
      No real card or PayPal charge was processed.
    </p>
  </td></tr>
  <tr><td style="background:#f0faf4;padding:16px 32px;border-top:1px solid #e0e0e0;text-align:center">
    <p style="margin:0;font-size:12px;color:#888">
      Questions? Contact us at support@hadinerim.example.com
    </p>
    <p style="margin:4px 0 0;font-size:11px;color:#aaa">
      This is a transactional email sent to confirm your order.
    </p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>"""


def _build_receipt_text(order: Order, items: list, payment: PaymentRecord, customer_name: str) -> str:
    pay_method = "Mock Credit Card" if payment.PaymentMethod == "mock_credit_card" else "Mock PayPal"
    lines = [
        f"PepperFarm — Order Confirmation",
        f"=" * 40,
        f"Hi {customer_name},",
        f"",
        f"Order #: {order.OrderNumber}",
        f"Date:    {order.CreatedAtUtc.strftime('%Y-%m-%d %H:%M')} UTC" if order.CreatedAtUtc else "",
        f"Payment: {pay_method}",
        f"Tx ID:   {payment.MockTransactionId or '—'}",
        f"",
        f"Items:",
    ]
    for i in items:
        lines.append(f"  {i.ProductNameSnapshot} x{i.Quantity} = {float(i.LineTotal):.2f} ILS")
    lines += [
        f"",
        f"Subtotal: {float(order.Subtotal):.2f} ILS",
    ]
    if float(order.ProductDiscountTotal) > 0:
        lines.append(f"Product discounts: -{float(order.ProductDiscountTotal):.2f} ILS")
    if float(order.EmployeeDiscountTotal) > 0:
        lines.append(f"Employee discount: -{float(order.EmployeeDiscountTotal):.2f} ILS")
    if float(order.CouponDiscountTotal) > 0:
        lines.append(f"Coupon ({order.CouponCode}): -{float(order.CouponDiscountTotal):.2f} ILS")
    lines += [
        f"TOTAL: {float(order.TotalAmount):.2f} ILS",
        f"",
        f"NOTE: This is a mock payment for demonstration only.",
        f"Questions? support@hadinerim.example.com",
    ]
    return "\n".join(lines)


def send_order_receipt(db: Session, order_id: int, payment_record_id: int) -> None:
    """
    Send order confirmation/receipt email.
    TRANSACTIONAL — always sent regardless of EmailConsent.
    Does NOT include marketing unsubscribe link.
    """
    payment = db.query(PaymentRecord).filter(
        PaymentRecord.PaymentRecordId == payment_record_id
    ).first()
    if not payment:
        return

    order = db.query(Order).filter(Order.OrderId == order_id).first()
    if not order:
        return

    user = db.query(User).filter(User.UserId == order.UserId).first()
    if not user:
        return

    items = db.query(OrderItem).filter(OrderItem.OrderId == order_id).all()

    subject   = f"Order Confirmation #{order.OrderNumber} — PepperFarm"
    html_body = _build_receipt_html(order, items, payment, user.FullName, user.Email)
    text_body = _build_receipt_text(order, items, payment, user.FullName)

    email_status = "failed"
    try:
        if is_smtp_configured():
            send_email(user.Email, subject, html_body, text_body)
            email_status = "sent"
        else:
            email_status = "not_sent"   # SMTP not configured — log but don't fail order
    except Exception:
        traceback.print_exc()
        email_status = "failed"
    finally:
        # Update PaymentRecords.InvoiceEmailStatus
        try:
            payment.InvoiceEmailStatus = email_status
            db.commit()
        except Exception:
            db.rollback()

    # Log in EmailLogs (type = order_receipt, not newsletter/promotion)
    try:
        db.add(EmailLog(
            RecipientEmail=user.Email,
            RecipientName=user.FullName,
            RecipientType="customer",
            Subject=subject,
            MessagePreview=f"Order #{order.OrderNumber}",
            EmailType="order_receipt",   # ← transactional, not marketing
            Status=email_status,
            ErrorMessage=None,
            RelatedProductId=None,
            CreatedBy=None,
        ))
        db.commit()
    except Exception:
        db.rollback()
