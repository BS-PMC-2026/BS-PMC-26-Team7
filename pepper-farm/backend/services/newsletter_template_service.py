"""Business logic for newsletter template CRUD and HTML rendering."""
import json
from datetime import datetime, timezone
from typing import Any, List, Optional

from sqlalchemy.orm import Session

from models.newsletter_template import NewsletterTemplate
from schemas.newsletter_template import TemplateCreate, TemplateResponse


# ── Serialisation helpers ──────────────────────────────────────────────────────

def _to_response(t: NewsletterTemplate) -> TemplateResponse:
    try:
        blocks = json.loads(t.ContentJson) if t.ContentJson else []
    except (ValueError, TypeError):
        blocks = []
    return TemplateResponse(
        NewsletterTemplateId=t.NewsletterTemplateId,
        title=t.Title,
        subject=t.Subject,
        preheader=t.Preheader,
        heroImageUrl=t.HeroImageUrl,
        blocks=blocks,
        bodyText=t.BodyText,
        ctaText=t.CtaText,
        ctaUrl=t.CtaUrl,
        footerText=t.FooterText,
        status=t.Status,
        createdAtUtc=t.CreatedAtUtc,
        updatedAtUtc=t.UpdatedAtUtc,
        createdBy=t.CreatedBy,
        updatedBy=t.UpdatedBy,
    )


# ── CRUD ───────────────────────────────────────────────────────────────────────

def list_templates(db: Session) -> List[TemplateResponse]:
    rows = (
        db.query(NewsletterTemplate)
        .filter(NewsletterTemplate.Status != "archived")
        .order_by(NewsletterTemplate.UpdatedAtUtc.desc())
        .all()
    )
    return [_to_response(r) for r in rows]


def get_template(db: Session, template_id: int) -> NewsletterTemplate:
    t = db.query(NewsletterTemplate).filter(
        NewsletterTemplate.NewsletterTemplateId == template_id
    ).first()
    if not t:
        raise ValueError("Template not found.")
    return t


def create_template(db: Session, data: TemplateCreate, user_id: Optional[int]) -> TemplateResponse:
    t = NewsletterTemplate(
        Title=data.title.strip(),
        Subject=data.subject.strip(),
        Preheader=data.preheader,
        HeroImageUrl=data.heroImageUrl,
        ContentJson=data.blocks_as_json(),
        BodyText=data.bodyText,
        CtaText=data.ctaText,
        CtaUrl=data.ctaUrl,
        FooterText=data.footerText,
        Status=data.status,
        CreatedBy=user_id,
        UpdatedBy=user_id,
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    return _to_response(t)


def update_template(
    db: Session, template_id: int, data: TemplateCreate, user_id: Optional[int]
) -> TemplateResponse:
    t = get_template(db, template_id)
    t.Title        = data.title.strip()
    t.Subject      = data.subject.strip()
    t.Preheader    = data.preheader
    t.HeroImageUrl = data.heroImageUrl
    t.ContentJson  = data.blocks_as_json()
    t.BodyText     = data.bodyText
    t.CtaText      = data.ctaText
    t.CtaUrl       = data.ctaUrl
    t.FooterText   = data.footerText
    t.Status       = data.status
    t.UpdatedAtUtc = datetime.now(timezone.utc).replace(tzinfo=None)
    t.UpdatedBy    = user_id
    db.commit()
    db.refresh(t)
    return _to_response(t)


def archive_template(db: Session, template_id: int, user_id: Optional[int]) -> TemplateResponse:
    t = get_template(db, template_id)
    t.Status       = "archived"
    t.UpdatedAtUtc = datetime.now(timezone.utc).replace(tzinfo=None)
    t.UpdatedBy    = user_id
    db.commit()
    db.refresh(t)
    return _to_response(t)


# ── HTML rendering ─────────────────────────────────────────────────────────────

def _escape(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _render_block(block: dict) -> str:
    btype = block.get("type", "")
    if btype == "heading":
        return f'<h2 style="color:#2d6a4f;font-family:Arial,sans-serif;margin:16px 0 8px">{_escape(block.get("text",""))}</h2>'
    if btype == "paragraph":
        text = _escape(block.get("text", "")).replace("\n", "<br>")
        return f'<p style="font-family:Arial,sans-serif;color:#333;margin:8px 0;line-height:1.6">{text}</p>'
    if btype == "image":
        url = block.get("url", "")
        alt = _escape(block.get("alt", ""))
        return (
            f'<img src="{url}" alt="{alt}" '
            f'style="max-width:100%;height:auto;display:block;margin:12px auto;border-radius:4px">'
        )
    if btype == "button":
        text = _escape(block.get("text", ""))
        url = block.get("url", "")
        return (
            f'<p style="text-align:center;margin:20px 0">'
            f'<a href="{url}" style="background:#2d6a4f;color:#fff;padding:12px 28px;'
            f'text-decoration:none;border-radius:4px;font-family:Arial,sans-serif;'
            f'font-weight:bold;display:inline-block">{text}</a></p>'
        )
    if btype == "divider":
        return '<hr style="border:none;border-top:1px solid #e0e0e0;margin:20px 0">'
    return ""


def render_html(template: NewsletterTemplate, unsubscribe_token: str = "") -> str:
    try:
        blocks: List[dict] = json.loads(template.ContentJson) if template.ContentJson else []
    except (ValueError, TypeError):
        blocks = []

    hero_html = ""
    if template.HeroImageUrl:
        hero_html = (
            f'<img src="{template.HeroImageUrl}" alt="Newsletter header" '
            f'style="width:100%;max-width:600px;height:auto;display:block;'
            f'border-radius:4px 4px 0 0">'
        )

    blocks_html = "\n".join(_render_block(b) for b in blocks)

    cta_html = ""
    if template.CtaText and template.CtaUrl:
        cta_html = (
            f'<p style="text-align:center;margin:28px 0">'
            f'<a href="{template.CtaUrl}" style="background:#2d6a4f;color:#fff;'
            f'padding:14px 32px;text-decoration:none;border-radius:4px;'
            f'font-family:Arial,sans-serif;font-weight:bold;font-size:16px;'
            f'display:inline-block">{_escape(template.CtaText)}</a></p>'
        )

    preheader_html = (
        f'<div style="display:none;max-height:0;overflow:hidden;'
        f'mso-hide:all">{_escape(template.Preheader)}</div>'
        if template.Preheader else ""
    )

    footer_text = _escape(template.FooterText or "You are receiving this email from Pepper Farm.")

    # US40: per-recipient unsubscribe link
    from services.email_unsubscribe import build_unsubscribe_footer_html
    unsubscribe_html = build_unsubscribe_footer_html(unsubscribe_token)

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>{_escape(template.Subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif">
  {preheader_html}
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f5f5;padding:24px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" border="0"
             style="max-width:600px;background:#fff;border-radius:8px;
                    box-shadow:0 2px 8px rgba(0,0,0,.08);overflow:hidden">
        <tr><td>{hero_html}</td></tr>
        <tr><td style="padding:32px 36px">
          {blocks_html}
          {cta_html}
        </td></tr>
        <tr><td style="background:#f0faf4;padding:16px 36px;
                        border-top:1px solid #e0e0e0;text-align:center">
          <p style="margin:0;font-size:12px;color:#888">{footer_text}</p>
          {unsubscribe_html}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


def render_plain_text(template: NewsletterTemplate) -> str:
    if template.BodyText:
        return template.BodyText

    try:
        blocks: List[dict] = json.loads(template.ContentJson) if template.ContentJson else []
    except (ValueError, TypeError):
        blocks = []

    lines: List[str] = [template.Subject, "=" * len(template.Subject), ""]
    for block in blocks:
        btype = block.get("type", "")
        if btype == "heading":
            text = block.get("text", "")
            lines += [text, "-" * len(text), ""]
        elif btype == "paragraph":
            lines += [block.get("text", ""), ""]
        elif btype == "image":
            alt = block.get("alt", "Image")
            url = block.get("url", "")
            lines += [f"[{alt}] {url}", ""]
        elif btype == "button":
            lines += [f'{block.get("text","")}: {block.get("url","")}', ""]
        elif btype == "divider":
            lines += ["---", ""]

    if template.CtaText and template.CtaUrl:
        lines += [f'{template.CtaText}: {template.CtaUrl}', ""]

    footer = template.FooterText or "You are receiving this email from Pepper Farm."
    lines += ["---", footer]
    return "\n".join(lines)
