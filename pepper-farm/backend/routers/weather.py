"""US36 — Weather Integration for Smarter Farming.

FarmManager-only weather endpoints.

  GET  /api/manager/weather
        Live current weather + 4-day forecast + optional sensor snapshot +
        deterministic rule-based recommendations. NEVER calls OpenAI, so it is
        safe for automatic dashboard load.

  POST /api/manager/weather/ai-recommendation
        Recomputes the same rule-based result and asks OpenAI for a short
        human-readable explanation. Intended for an explicit button click only.
        Falls back to the rule-based result when OpenAI is unavailable.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from database import get_db
from schemas.weather import (
    WeatherAiRequest,
    WeatherAiResponse,
    WeatherRange,
    WeatherResponse,
)
from services.weather_service import (
    WeatherApiError,
    generate_ai_explanation,
    get_weather,
)
from utils.jwt import require_role

router = APIRouter(prefix="/api/manager/weather", tags=["Weather"])


@router.get("", response_model=WeatherResponse)
def get_farm_weather(
    selected_range: WeatherRange = Query("next_2_days", alias="range"),
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("FarmManager")),
):
    """Live farm weather + rule-based recommendations (no OpenAI)."""
    try:
        return get_weather(db, selected_range)
    except WeatherApiError as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Weather service is currently unavailable: {exc}",
        )


@router.post("/ai-recommendation", response_model=WeatherAiResponse)
def get_ai_weather_recommendation(
    request: WeatherAiRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("FarmManager")),
):
    """Explain the rule-based recommendation via OpenAI (explicit trigger).

    The rule-based recommendation is always returned; OpenAI only adds a
    human-readable explanation, and the endpoint degrades gracefully to the
    rule-based result when OpenAI is missing or fails.
    """
    try:
        weather = get_weather(db, request.range)
    except WeatherApiError as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Weather service is currently unavailable: {exc}",
        )
    return generate_ai_explanation(weather)
