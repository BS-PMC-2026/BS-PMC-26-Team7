import json
from typing import Any, List, Literal, Optional, Union
from datetime import datetime

from pydantic import BaseModel, Field, field_validator, model_validator

# ── Content block types ────────────────────────────────────────────────────────

ALLOWED_BLOCK_TYPES = {"heading", "paragraph", "image", "button", "divider"}

# Schemes that are safe for use in newsletter image <img src> and <a href> tags.
_SAFE_URL_PREFIXES = ("http://", "https://", "/uploads/")
# Explicitly blocked schemes that could cause XSS or security issues.
_BLOCKED_SCHEMES = ("javascript:", "data:", "file:", "vbscript:")


def _is_safe_image_url(v: str) -> bool:
    """Return True for http(s) absolute URLs and internal /uploads/ paths."""
    low = v.lower()
    return any(low.startswith(p) for p in _SAFE_URL_PREFIXES) and not any(
        low.startswith(b) for b in _BLOCKED_SCHEMES
    )


def _is_safe_link_url(v: str) -> bool:
    """Buttons require an absolute http(s) URL only."""
    low = v.lower()
    return (low.startswith("http://") or low.startswith("https://")) and not any(
        low.startswith(b) for b in _BLOCKED_SCHEMES
    )


class HeadingBlock(BaseModel):
    type: Literal["heading"]
    text: str = Field(..., min_length=1, max_length=500)


class ParagraphBlock(BaseModel):
    type: Literal["paragraph"]
    text: str = Field(..., min_length=1, max_length=5000)


class ImageBlock(BaseModel):
    type: Literal["image"]
    url: str = Field(..., min_length=1, max_length=500)
    alt: str = Field(default="", max_length=300)

    @field_validator("url")
    @classmethod
    def validate_url(cls, v: str) -> str:
        if not _is_safe_image_url(v):
            raise ValueError(
                "Image URL must start with http://, https://, or /uploads/. "
                "javascript:, data:, and file: schemes are not allowed."
            )
        return v


class ButtonBlock(BaseModel):
    type: Literal["button"]
    text: str = Field(..., min_length=1, max_length=200)
    url: str = Field(..., min_length=1, max_length=500)

    @field_validator("url")
    @classmethod
    def validate_url(cls, v: str) -> str:
        if not _is_safe_link_url(v):
            raise ValueError("Button URL must start with http:// or https://")
        return v


class DividerBlock(BaseModel):
    type: Literal["divider"]


ContentBlock = Union[HeadingBlock, ParagraphBlock, ImageBlock, ButtonBlock, DividerBlock]

# ── Request / Response ─────────────────────────────────────────────────────────

class TemplateCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    subject: str = Field(..., min_length=1, max_length=500)
    preheader: Optional[str] = Field(None, max_length=300)
    heroImageUrl: Optional[str] = Field(None, max_length=500)
    blocks: List[ContentBlock] = Field(default_factory=list)
    bodyText: Optional[str] = None
    ctaText: Optional[str] = Field(None, max_length=200)
    ctaUrl: Optional[str] = Field(None, max_length=500)
    footerText: Optional[str] = Field(None, max_length=500)
    status: str = Field(default="draft")

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        if v not in ("draft", "ready", "archived"):
            raise ValueError("status must be draft, ready, or archived")
        return v

    @field_validator("heroImageUrl")
    @classmethod
    def validate_hero(cls, v: Optional[str]) -> Optional[str]:
        if v and not _is_safe_image_url(v):
            raise ValueError(
                "heroImageUrl must start with http://, https://, or /uploads/. "
                "javascript:, data:, and file: schemes are not allowed."
            )
        return v

    @field_validator("ctaUrl")
    @classmethod
    def validate_cta_url(cls, v: Optional[str]) -> Optional[str]:
        if v and not (v.startswith("http://") or v.startswith("https://")):
            raise ValueError("ctaUrl must start with http:// or https://")
        return v

    def blocks_as_json(self) -> str:
        return json.dumps([b.model_dump() for b in self.blocks])


class TemplateResponse(BaseModel):
    NewsletterTemplateId: int
    title: str
    subject: str
    preheader: Optional[str] = None
    heroImageUrl: Optional[str] = None
    blocks: List[Any] = []
    bodyText: Optional[str] = None
    ctaText: Optional[str] = None
    ctaUrl: Optional[str] = None
    footerText: Optional[str] = None
    status: str
    createdAtUtc: datetime
    updatedAtUtc: datetime
    createdBy: Optional[int] = None
    updatedBy: Optional[int] = None

    class Config:
        from_attributes = True


class SendTemplateRequest(BaseModel):
    recipientGroups: List[str] = Field(..., min_length=1)


class SendTemplateResponse(BaseModel):
    totalRecipients: int
    sentCount: int
    failedCount: int
    skippedCount: int
    message: str
    queued: bool = False   # True when SMTP delivery is happening in background
