"""US36 — Weather Integration for Smarter Farming.

Pydantic schemas for the live farm weather feature.

Weather is fetched live from the Open-Meteo API on each request and is never
stored in the database (no Create/Update schemas). The dashboard endpoint
returns rule-based recommendations only and never calls OpenAI. An optional,
explicitly-triggered endpoint enriches those rule-based recommendations with a
short human-readable AI explanation.
"""

from pydantic import BaseModel
from typing import List, Literal, Optional


# Recommendation window the manager can choose. "next_7_days" may be added later.
WeatherRange = Literal["today", "next_2_days"]


class WeatherLocation(BaseModel):
    """The geographic point the weather was fetched for."""
    latitude: float
    longitude: float
    timezone: str

    class Config:
        from_attributes = True


class WeatherCurrent(BaseModel):
    """Current live weather observed at the farm."""
    temperatureC: float
    humidityPct: int
    windSpeedKph: float
    precipitationMm: float
    weatherCode: int
    condition: str
    observedAtLocal: str

    class Config:
        from_attributes = True


class WeatherForecastDay(BaseModel):
    """A single day in the short-term forecast."""
    date: str
    tempMaxC: float
    tempMinC: float
    precipitationProbabilityPct: Optional[int] = None
    windSpeedMaxKph: float
    weatherCode: int
    condition: str

    class Config:
        from_attributes = True


class WeatherSensorSnapshot(BaseModel):
    """Farm-wide snapshot derived from the latest readings of active sensors.

    Optional: when no sensor readings are available the whole snapshot is
    omitted (sensors=None on the response). Averages are nullable because a
    given metric may be missing across all sensors.
    """
    avgTemperatureC: Optional[float] = None
    avgHumidityPct: Optional[float] = None
    avgPar: Optional[float] = None
    sensorCount: int = 0
    latestReadingUtc: Optional[str] = None

    class Config:
        from_attributes = True


class WeatherRecommendation(BaseModel):
    """A deterministic, rule-based farming recommendation.

    `status` reflects how advisable the activity is given current/forecast
    conditions (and sensor signals); `reason` is a stable code the frontend
    translates (en/he). These rules are the source of truth — OpenAI never
    overrides them.
    """
    activity: Literal["spraying", "irrigation", "field_work"]
    status: Literal["advised", "caution", "not_advised"]
    reason: str

    class Config:
        from_attributes = True


class WeatherResponse(BaseModel):
    """Payload returned by GET /api/manager/weather (rule-based, no OpenAI)."""
    location: WeatherLocation
    current: WeatherCurrent
    forecast: List[WeatherForecastDay]
    sensors: Optional[WeatherSensorSnapshot] = None
    recommendations: List[WeatherRecommendation]
    selectedRange: WeatherRange

    class Config:
        from_attributes = True


class WeatherAiRequest(BaseModel):
    """Body for POST /api/manager/weather/ai-recommendation.

    Only the recommendation window is accepted; the backend recomputes the
    weather facts, sensor facts and rule-based recommendation server-side and
    asks OpenAI for an explanation of that result.
    """
    range: WeatherRange = "next_2_days"


class WeatherAiResponse(BaseModel):
    """Optional AI explanation of the rule-based recommendation.

    `recommendations` echoes the rule-based result (the source of truth).
    `source` is "ai" when OpenAI produced the explanation, or "fallback" when
    the key is missing / OpenAI failed (in which case `explanation` may be
    empty and only the rule-based recommendations are meaningful).
    """
    recommendations: List[WeatherRecommendation]
    explanation: str = ""
    source: Literal["ai", "fallback"]

    class Config:
        from_attributes = True
