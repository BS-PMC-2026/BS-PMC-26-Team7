from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ConsentStatusResponse(BaseModel):
    userId: int
    emailConsent: bool
    emailMarketingConsentUpdatedAtUtc: Optional[datetime] = None
    emailUnsubscribedAtUtc: Optional[datetime] = None


class ConsentUpdateRequest(BaseModel):
    emailConsent: bool


class UnsubscribeResponse(BaseModel):
    success: bool
    message: str
