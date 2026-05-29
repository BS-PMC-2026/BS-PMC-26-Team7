from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class NewsletterRequest(BaseModel):
    subject: str = Field(..., min_length=1, max_length=500)
    message: str = Field(..., min_length=1)
    recipientGroups: List[str] = Field(..., min_length=1)   # ["customers", "workers", "all"]
    emailType: str = Field(default="newsletter")            # "newsletter" | "announcement"
    scheduledLabel: Optional[str] = None                   # "weekly" | "monthly" | "general"


class NewsletterResponse(BaseModel):
    totalRecipients: int
    sentCount: int
    failedCount: int
    skippedCount: int
    message: str


class EmailLogResponse(BaseModel):
    EmailLogId: int
    RecipientEmail: str
    RecipientName: Optional[str] = None
    RecipientType: str
    Subject: str
    MessagePreview: Optional[str] = None
    EmailType: str
    Status: str
    ErrorMessage: Optional[str] = None
    RelatedProductId: Optional[int] = None
    RelatedDiscountPercentage: Optional[float] = None
    SentAtUtc: Optional[datetime] = None
    CreatedAtUtc: datetime
    CreatedBy: Optional[int] = None

    class Config:
        from_attributes = True
