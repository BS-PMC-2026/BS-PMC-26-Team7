from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.sql import func
from database import Base


class NewsletterTemplate(Base):
    __tablename__ = "NewsletterTemplates"

    NewsletterTemplateId = Column(Integer, primary_key=True, autoincrement=True)
    Title        = Column(String(200), nullable=False)          # internal label shown in the manager UI
    Subject      = Column(String(500), nullable=False)          # email subject line
    Preheader    = Column(String(300), nullable=True)           # preview text shown by email clients
    HeroImageUrl = Column(String(500), nullable=True)           # absolute URL for hero image
    ContentJson  = Column(Text, nullable=False)                 # JSON array of content blocks
    BodyText     = Column(Text, nullable=True)                  # plain-text fallback (auto-generated or manual)
    CtaText      = Column(String(200), nullable=True)           # call-to-action button label
    CtaUrl       = Column(String(500), nullable=True)           # call-to-action button URL
    FooterText   = Column(String(500), nullable=True)
    Status       = Column(String(20), nullable=False, default="draft")  # draft / ready / archived
    CreatedAtUtc = Column(DateTime, nullable=False, server_default=func.sysutcdatetime())
    UpdatedAtUtc = Column(DateTime, nullable=False, server_default=func.sysutcdatetime())
    CreatedBy    = Column(Integer, nullable=True)
    UpdatedBy    = Column(Integer, nullable=True)
