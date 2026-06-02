"""
Chatbot router.

Exposes a single PUBLIC endpoint for the visitor AI chatbot:
    POST /api/chatbot

No authentication is required — visitors are not logged in. A read-only DB
session is injected via Depends(get_db) and passed to the service so the
service can fetch grounding facts. The endpoint is read-only and the service
never raises, so this endpoint always returns 200 with a ChatResponse (a safe
fallback reply when OpenAI is unavailable or when a factual question has no
matching DB data).
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from schemas.chatbot import ChatRequest, ChatResponse
from services.chatbot_service import answer_question

router = APIRouter(prefix="/api/chatbot", tags=["chatbot"])


@router.post("", response_model=ChatResponse)
def chat(request: ChatRequest, db: Session = Depends(get_db)) -> ChatResponse:
    """Answer a visitor's question via the chatbot service."""
    return answer_question(db, request.message)
