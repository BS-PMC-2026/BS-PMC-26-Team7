"""US36 — Weather Integration for Smarter Farming.

Live weather service. On each call it fetches current weather and a short
forecast for the farm directly from the Open-Meteo API (no API key required),
optionally blends in the latest farm sensor readings as a SECONDARY signal,
and derives deterministic rule-based recommendations.

There is intentionally NO database storage of weather, NO SQLAlchemy weather
model, NO migration and NO caching — the weather data is always live.

OpenAI is NEVER called automatically. `generate_ai_explanation()` is an
optional helper (wired to a router in a later step) that asks OpenAI only for
a human-readable explanation of the ALREADY-DECIDED rule-based recommendation,
and falls back gracefully when the key is missing or the call fails.
"""

import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Optional

import httpx
from dotenv import load_dotenv
from sqlalchemy import func
from sqlalchemy.orm import Session

from models.sensor import Sensor, SensorReading
from schemas.weather import (
    WeatherAiResponse,
    WeatherCurrent,
    WeatherForecastDay,
    WeatherLocation,
    WeatherRange,
    WeatherRecommendation,
    WeatherResponse,
    WeatherSensorSnapshot,
)


BACKEND_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BACKEND_DIR / ".env")


# --- Configuration ---------------------------------------------------------

OPEN_METEO_BASE_URL = os.getenv(
    "OPEN_METEO_BASE_URL",
    "https://api.open-meteo.com/v1/forecast",
).rstrip("/")

# Safe default coordinates — Pri Gan (Perigan), Israel.
# Overridable via FARM_LATITUDE / FARM_LONGITUDE in backend/.env.
DEFAULT_LATITUDE = 31.283
DEFAULT_LONGITUDE = 34.433

FORECAST_DAYS = 4
REQUEST_TIMEOUT = 30

# Sensor readings older than this are treated as stale and ignored entirely
# (excluded from the snapshot and from the rule-based recommendations).
SENSOR_STALE_HOURS = 24

# Default recommendation window when the manager does not pick one.
DEFAULT_RANGE: WeatherRange = "next_2_days"


# --- Recommendation thresholds (easy to tune) ------------------------------

SPRAY_WIND_MAX_KPH = 20.0       # above this, spraying is not advised
SPRAY_WIND_CAUTION_KPH = 12.0   # 12–20 km/h → spray with caution
SPRAY_RAIN_PROB_PCT = 50        # rain probability at/above this blocks spraying

IRRIGATION_RAIN_PROB_PCT = 60   # rain probability that makes irrigation wasteful
IRRIGATION_HEAT_C = 32.0        # hot day → irrigate in cooler hours (caution)

FIELDWORK_RAIN_PROB_PCT = 70    # heavy rain probability blocks field work
FIELDWORK_HEAT_C = 35.0         # extreme heat → caution for field work

# Secondary sensor signals (refine rules at the edges only).
SENSOR_HIGH_HUMIDITY_PCT = 85.0   # very humid air → spraying caution
SENSOR_EXTREME_TEMP_C = 35.0      # sensor-measured extreme heat reinforces heat


# WMO weather codes → stable condition codes (translated on the frontend).
_WEATHER_CODE_CONDITIONS: dict[int, str] = {
    0: "clear",
    1: "mainly_clear",
    2: "partly_cloudy",
    3: "overcast",
    45: "fog",
    48: "fog",
    51: "drizzle",
    53: "drizzle",
    55: "drizzle",
    56: "freezing_drizzle",
    57: "freezing_drizzle",
    61: "rain",
    63: "rain",
    65: "rain",
    66: "freezing_rain",
    67: "freezing_rain",
    71: "snow",
    73: "snow",
    75: "snow",
    77: "snow_grains",
    80: "rain_showers",
    81: "rain_showers",
    82: "rain_showers",
    85: "snow_showers",
    86: "snow_showers",
    95: "thunderstorm",
    96: "thunderstorm_hail",
    99: "thunderstorm_hail",
}

# OpenAI (optional explanation only — never decides the recommendation).
OPENAI_MODEL_DEFAULT = "gpt-4o-mini"


class WeatherApiError(Exception):
    """Raised when the Open-Meteo request fails or returns unusable data."""
    pass


# --- Helpers ---------------------------------------------------------------

def _get_coordinates() -> tuple[float, float]:
    """Read farm coordinates from env, falling back to Pri Gan defaults."""
    try:
        latitude = float(os.getenv("FARM_LATITUDE", DEFAULT_LATITUDE))
        longitude = float(os.getenv("FARM_LONGITUDE", DEFAULT_LONGITUDE))
    except (TypeError, ValueError):
        latitude, longitude = DEFAULT_LATITUDE, DEFAULT_LONGITUDE
    return latitude, longitude


def _condition_from_code(code: Optional[int]) -> str:
    """Map a WMO weather code to a stable, translatable condition string."""
    if code is None:
        return "unknown"
    return _WEATHER_CODE_CONDITIONS.get(int(code), "unknown")


def _to_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _to_int(value: Any, default: int = 0) -> int:
    try:
        return int(round(float(value)))
    except (TypeError, ValueError):
        return default


def _to_optional_int(value: Any) -> Optional[int]:
    if value is None:
        return None
    try:
        return int(round(float(value)))
    except (TypeError, ValueError):
        return None


def _window_size(selected_range: WeatherRange) -> int:
    """Number of forecast days covered by the selected range."""
    return 1 if selected_range == "today" else 2


# --- Open-Meteo call -------------------------------------------------------

def _fetch_open_meteo(latitude: float, longitude: float) -> dict[str, Any]:
    """Call the Open-Meteo forecast API and return the raw JSON payload."""
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "current": ",".join(
            [
                "temperature_2m",
                "relative_humidity_2m",
                "wind_speed_10m",
                "precipitation",
                "weather_code",
            ]
        ),
        "daily": ",".join(
            [
                "weather_code",
                "temperature_2m_max",
                "temperature_2m_min",
                "precipitation_probability_max",
                "wind_speed_10m_max",
            ]
        ),
        "wind_speed_unit": "kmh",
        "forecast_days": FORECAST_DAYS,
        "timezone": "auto",
    }

    try:
        with httpx.Client(timeout=REQUEST_TIMEOUT) as client:
            response = client.get(OPEN_METEO_BASE_URL, params=params)
    except httpx.HTTPError as exc:
        raise WeatherApiError(f"Failed to reach Open-Meteo: {exc}") from exc

    if response.status_code != 200:
        raise WeatherApiError(
            f"Open-Meteo HTTP {response.status_code}: {response.text}"
        )

    try:
        body = response.json()
    except ValueError:
        raise WeatherApiError(
            f"Open-Meteo returned non-JSON response: {response.text}"
        )

    if not isinstance(body, dict) or "current" not in body or "daily" not in body:
        raise WeatherApiError(f"Unexpected Open-Meteo response shape: {body}")

    return body


# --- Normalization ---------------------------------------------------------

def _parse_location(body: dict[str, Any], fallback: tuple[float, float]) -> WeatherLocation:
    return WeatherLocation(
        latitude=_to_float(body.get("latitude"), fallback[0]),
        longitude=_to_float(body.get("longitude"), fallback[1]),
        timezone=str(body.get("timezone") or "UTC"),
    )


def _parse_current(body: dict[str, Any]) -> WeatherCurrent:
    current = body.get("current") or {}
    code = _to_optional_int(current.get("weather_code"))
    return WeatherCurrent(
        temperatureC=_to_float(current.get("temperature_2m")),
        humidityPct=_to_int(current.get("relative_humidity_2m")),
        windSpeedKph=_to_float(current.get("wind_speed_10m")),
        precipitationMm=_to_float(current.get("precipitation")),
        weatherCode=code if code is not None else 0,
        condition=_condition_from_code(code),
        observedAtLocal=str(current.get("time") or ""),
    )


def _parse_forecast(body: dict[str, Any]) -> list[WeatherForecastDay]:
    daily = body.get("daily") or {}
    dates = daily.get("time") or []
    codes = daily.get("weather_code") or []
    temp_max = daily.get("temperature_2m_max") or []
    temp_min = daily.get("temperature_2m_min") or []
    precip_prob = daily.get("precipitation_probability_max") or []
    wind_max = daily.get("wind_speed_10m_max") or []

    def _at(seq: list, index: int) -> Any:
        return seq[index] if index < len(seq) else None

    days: list[WeatherForecastDay] = []
    for i in range(len(dates)):
        code = _to_optional_int(_at(codes, i))
        days.append(
            WeatherForecastDay(
                date=str(dates[i]),
                tempMaxC=_to_float(_at(temp_max, i)),
                tempMinC=_to_float(_at(temp_min, i)),
                precipitationProbabilityPct=_to_optional_int(_at(precip_prob, i)),
                windSpeedMaxKph=_to_float(_at(wind_max, i)),
                weatherCode=code if code is not None else 0,
                condition=_condition_from_code(code),
            )
        )
    return days


# --- Sensor snapshot (secondary signal) ------------------------------------

def _is_fresh(sample_time: Optional[datetime], cutoff: datetime) -> bool:
    """A reading is fresh when its timestamp is at or after the stale cutoff."""
    if sample_time is None:
        return False
    naive = sample_time.replace(tzinfo=None) if sample_time.tzinfo else sample_time
    return naive >= cutoff


def get_sensor_snapshot(db: Session) -> Optional[WeatherSensorSnapshot]:
    """Best-effort farm-wide snapshot from the latest reading of each active
    sensor. Readings older than SENSOR_STALE_HOURS are excluded; if every
    sensor's latest reading is stale (or there are none), returns None so
    weather and recommendations work normally without stale data."""
    try:
        latest_per_sensor = (
            db.query(
                SensorReading.SensorId,
                func.max(SensorReading.SampleTimeUtc).label("max_time"),
            )
            .group_by(SensorReading.SensorId)
            .subquery()
        )
        readings = (
            db.query(SensorReading)
            .join(
                latest_per_sensor,
                (SensorReading.SensorId == latest_per_sensor.c.SensorId)
                & (SensorReading.SampleTimeUtc == latest_per_sensor.c.max_time),
            )
            .join(Sensor, Sensor.SensorId == SensorReading.SensorId)
            .filter(Sensor.IsActive == True)  # noqa: E712
            .all()
        )
    except Exception:
        return None

    if not readings:
        return None

    # Drop stale readings so they never reach the snapshot or the rules.
    cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(
        hours=SENSOR_STALE_HOURS
    )
    fresh = [r for r in readings if _is_fresh(r.SampleTimeUtc, cutoff)]
    if not fresh:
        return None

    temps = [r.Temperature for r in fresh if r.Temperature is not None]
    hums = [r.Humidity for r in fresh if r.Humidity is not None]
    pars = [r.PAR for r in fresh if r.PAR is not None]
    times = [r.SampleTimeUtc for r in fresh if r.SampleTimeUtc is not None]
    latest = max(times) if times else None

    def _avg(values: list[float]) -> Optional[float]:
        return round(sum(values) / len(values), 1) if values else None

    return WeatherSensorSnapshot(
        avgTemperatureC=_avg(temps),
        avgHumidityPct=_avg(hums),
        avgPar=_avg(pars),
        sensorCount=len(fresh),
        latestReadingUtc=latest.isoformat() if latest else None,
    )


# --- Recommendations -------------------------------------------------------

def _rain_prob(day: Optional[WeatherForecastDay]) -> int:
    """Return a day's rain probability, treating missing data as 0."""
    if day is None or day.precipitationProbabilityPct is None:
        return 0
    return day.precipitationProbabilityPct


def _build_recommendations(
    current: WeatherCurrent,
    forecast: list[WeatherForecastDay],
    sensors: Optional[WeatherSensorSnapshot],
    selected_range: WeatherRange,
) -> list[WeatherRecommendation]:
    """Derive deterministic spraying/irrigation/field-work recommendations.

    Weather is the primary driver; sensor readings are a secondary signal that
    only nudges the result at the edges.
    """
    window = forecast[: _window_size(selected_range)]
    window_rain = max((_rain_prob(d) for d in window), default=0)
    window_max_temp = max(
        (d.tempMaxC for d in window), default=current.temperatureC
    )

    # Secondary sensor signals.
    sensor_humidity = sensors.avgHumidityPct if sensors else None
    sensor_temp = sensors.avgTemperatureC if sensors else None
    high_sensor_humidity = (
        sensor_humidity is not None and sensor_humidity >= SENSOR_HIGH_HUMIDITY_PCT
    )
    extreme_sensor_temp = (
        sensor_temp is not None and sensor_temp >= SENSOR_EXTREME_TEMP_C
    )

    # Spraying
    if current.windSpeedKph > SPRAY_WIND_MAX_KPH:
        spraying = ("not_advised", "high_wind")
    elif window_rain >= SPRAY_RAIN_PROB_PCT or current.precipitationMm > 0:
        spraying = ("not_advised", "rain_expected")
    elif current.windSpeedKph >= SPRAY_WIND_CAUTION_KPH:
        spraying = ("caution", "moderate_wind")
    elif high_sensor_humidity:
        spraying = ("caution", "high_humidity")
    else:
        spraying = ("advised", "good_conditions")

    # Irrigation
    if window_rain >= IRRIGATION_RAIN_PROB_PCT:
        irrigation = ("not_advised", "rain_expected")
    elif window_max_temp >= IRRIGATION_HEAT_C or extreme_sensor_temp:
        irrigation = ("caution", "high_heat")
    else:
        irrigation = ("advised", "no_rain_expected")

    # Field work
    if current.precipitationMm > 0 or window_rain >= FIELDWORK_RAIN_PROB_PCT:
        field_work = ("not_advised", "rain_expected")
    elif window_max_temp >= FIELDWORK_HEAT_C or extreme_sensor_temp:
        field_work = ("caution", "extreme_heat")
    else:
        field_work = ("advised", "clear_conditions")

    return [
        WeatherRecommendation(activity="spraying", status=spraying[0], reason=spraying[1]),
        WeatherRecommendation(activity="irrigation", status=irrigation[0], reason=irrigation[1]),
        WeatherRecommendation(activity="field_work", status=field_work[0], reason=field_work[1]),
    ]


# --- Public entry point (dashboard data, NO OpenAI) ------------------------

def get_weather(
    db: Session,
    selected_range: WeatherRange = DEFAULT_RANGE,
) -> WeatherResponse:
    """Fetch live farm weather, blend in sensor data, attach rule-based recs.

    This NEVER calls OpenAI — it is safe for automatic dashboard load.
    """
    latitude, longitude = _get_coordinates()
    body = _fetch_open_meteo(latitude, longitude)

    location = _parse_location(body, (latitude, longitude))
    current = _parse_current(body)
    forecast = _parse_forecast(body)
    sensors = get_sensor_snapshot(db)
    recommendations = _build_recommendations(
        current, forecast, sensors, selected_range
    )

    return WeatherResponse(
        location=location,
        current=current,
        forecast=forecast,
        sensors=sensors,
        recommendations=recommendations,
        selectedRange=selected_range,
    )


# --- Optional AI explanation (NOT wired to a router in this step) -----------

def _get_api_key() -> Optional[str]:
    """Return the OpenAI API key from the environment, or None if unset."""
    return os.getenv("OPENAI_API_KEY") or None


def _get_model() -> str:
    return os.getenv("OPENAI_MODEL", OPENAI_MODEL_DEFAULT)


def _summarize_facts(weather: WeatherResponse) -> str:
    """Build a compact, bounded facts summary to ground the AI explanation."""
    cur = weather.current
    loc = weather.location
    lines = [
        f"Location: {loc.latitude}, {loc.longitude} ({loc.timezone})",
        f"Selected range: {weather.selectedRange}",
        (
            f"Current: {cur.temperatureC}C, humidity {cur.humidityPct}%, "
            f"wind {cur.windSpeedKph} km/h, precipitation {cur.precipitationMm} mm, "
            f"condition {cur.condition}"
        ),
    ]
    if weather.forecast:
        fc = "; ".join(
            f"{d.date}: {d.tempMinC}-{d.tempMaxC}C, rain "
            f"{d.precipitationProbabilityPct if d.precipitationProbabilityPct is not None else 0}%, "
            f"{d.condition}"
            for d in weather.forecast[:2]
        )
        lines.append(f"Forecast (next days): {fc}")
    if weather.sensors:
        s = weather.sensors
        lines.append(
            f"Farm sensors ({s.sensorCount}): avg temp {s.avgTemperatureC}C, "
            f"avg humidity {s.avgHumidityPct}%, avg PAR {s.avgPar}"
        )
    else:
        lines.append("Farm sensors: none available")
    rec = "; ".join(
        f"{r.activity}={r.status} ({r.reason})" for r in weather.recommendations
    )
    lines.append(f"Rule-based recommendation (final, do not change): {rec}")
    return "\n".join(lines)


def generate_ai_explanation(weather: WeatherResponse) -> WeatherAiResponse:
    """Ask OpenAI for a short explanation of the rule-based recommendation.

    The rule-based recommendation is the source of truth and is always returned.
    OpenAI only adds a human-readable explanation. If OPENAI_API_KEY is missing
    or the call fails, this returns source="fallback" with an empty explanation
    and the rule-based recommendations intact. Never raises; never exposes the
    key.
    """
    base = WeatherAiResponse(
        recommendations=weather.recommendations,
        explanation="",
        source="fallback",
    )

    api_key = _get_api_key()
    if not api_key:
        return base

    system_prompt = (
        "You are an assistant for a pepper farm. You are given weather facts, "
        "farm sensor facts, and an ALREADY-DECIDED rule-based recommendation "
        "for spraying, irrigation and field work. Do NOT change or override the "
        "recommendation. Briefly explain it (2-4 short sentences) in plain text "
        "with no Markdown formatting. Reply in English."
    )

    try:
        from openai import OpenAI

        client = OpenAI(api_key=api_key)
        completion = client.chat.completions.create(
            model=_get_model(),
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": _summarize_facts(weather)},
            ],
            max_tokens=300,
        )
        explanation = (completion.choices[0].message.content or "").strip()
    except Exception:
        # Covers missing package, rate limits, network/service errors. We do not
        # log details to avoid leaking request content or the API key.
        return base

    if not explanation:
        return base

    return WeatherAiResponse(
        recommendations=weather.recommendations,
        explanation=explanation,
        source="ai",
    )
