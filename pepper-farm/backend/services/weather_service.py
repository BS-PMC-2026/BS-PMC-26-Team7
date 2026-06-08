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

import logging
import os
import time
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

logger = logging.getLogger(__name__)


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

# Open-Meteo can be briefly slow or unreachable. We make a small, bounded number
# of attempts with a short backoff between them. Each attempt uses a per-request
# timeout, and the worst-case total wall time is kept safely under the frontend's
# 20s weather timeout (services/weather.ts): 2 attempts * 8s + 1 * 0.5s backoff
# ≈ 16.5s. If every attempt fails the caller still gets a WeatherApiError (→ 503),
# preserving the existing "showing last available weather data" behavior.
REQUEST_TIMEOUT = 8             # per-attempt timeout (seconds)
OPEN_METEO_MAX_ATTEMPTS = 2     # total attempts (1 original + 1 retry)
OPEN_METEO_RETRY_BACKOFF = 0.5  # seconds slept between attempts

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
    if selected_range == "today":
        return 1
    if selected_range == "next_2_days":
        return 2
    return 7  # next_7_days (weekly)


def _forecast_days_for(selected_range: WeatherRange) -> int:
    """How many forecast days to request from Open-Meteo for this range."""
    return 7 if selected_range == "next_7_days" else FORECAST_DAYS


# --- Open-Meteo call -------------------------------------------------------

def _fetch_open_meteo(
    latitude: float,
    longitude: float,
    forecast_days: int = FORECAST_DAYS,
) -> dict[str, Any]:
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
        "forecast_days": forecast_days,
        "timezone": "auto",
    }

    # Retry only transient failures (network/timeout errors and 5xx upstream
    # errors). Deterministic failures (4xx, non-JSON, unexpected shape) are not
    # retried because a retry cannot fix them. Every failed attempt is logged
    # with its exception type/message; the URL and params carry no secrets, and
    # the API key is never part of this request.
    last_error: WeatherApiError | None = None
    for attempt in range(1, OPEN_METEO_MAX_ATTEMPTS + 1):
        try:
            with httpx.Client(timeout=REQUEST_TIMEOUT) as client:
                response = client.get(OPEN_METEO_BASE_URL, params=params)
        except httpx.HTTPError as exc:
            last_error = WeatherApiError(f"Failed to reach Open-Meteo: {exc}")
            logger.warning(
                "Open-Meteo request failed (attempt %d/%d) — %s: %s",
                attempt, OPEN_METEO_MAX_ATTEMPTS, type(exc).__name__, exc,
            )
        else:
            if response.status_code == 200:
                try:
                    body = response.json()
                except ValueError:
                    raise WeatherApiError(
                        f"Open-Meteo returned non-JSON response: {response.text}"
                    )
                if (
                    not isinstance(body, dict)
                    or "current" not in body
                    or "daily" not in body
                ):
                    raise WeatherApiError(
                        f"Unexpected Open-Meteo response shape: {body}"
                    )
                return body

            # Non-200: retry only on server-side (5xx) errors; 4xx is permanent.
            message = f"Open-Meteo HTTP {response.status_code}: {response.text}"
            if response.status_code < 500:
                raise WeatherApiError(message)
            last_error = WeatherApiError(message)
            logger.warning(
                "Open-Meteo upstream error (attempt %d/%d) — HTTP %d",
                attempt, OPEN_METEO_MAX_ATTEMPTS, response.status_code,
            )

        # Short backoff before the next attempt, if any remain.
        if attempt < OPEN_METEO_MAX_ATTEMPTS:
            time.sleep(OPEN_METEO_RETRY_BACKOFF)

    # All attempts exhausted — log once at error level and surface the last
    # failure as the existing WeatherApiError (the router maps this to a 503).
    logger.error(
        "Open-Meteo unavailable after %d attempt(s): %s",
        OPEN_METEO_MAX_ATTEMPTS, last_error,
    )
    raise last_error or WeatherApiError("Open-Meteo request failed")


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


def _sensor_display_name(sensor: Sensor) -> str:
    """Human-readable name for a sensor: DeviceName → UnitName → 'Sensor #<id>'."""
    name = (sensor.DeviceName or sensor.UnitName or "").strip()
    return name or f"Sensor #{sensor.SensorId}"


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
        # Fetch each active sensor's latest reading together with its Sensor row
        # so we can surface the human-readable sensor name in the snapshot.
        rows = (
            db.query(SensorReading, Sensor)
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

    if not rows:
        return None

    # Drop stale readings so they never reach the snapshot or the rules. The
    # accompanying Sensor row rides along, so a stale sensor's name is dropped
    # here too and never reaches sensorNames.
    cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(
        hours=SENSOR_STALE_HOURS
    )
    fresh = [(r, s) for (r, s) in rows if _is_fresh(r.SampleTimeUtc, cutoff)]
    if not fresh:
        return None

    temps = [r.Temperature for (r, _) in fresh if r.Temperature is not None]
    hums = [r.Humidity for (r, _) in fresh if r.Humidity is not None]
    pars = [r.PAR for (r, _) in fresh if r.PAR is not None]
    times = [r.SampleTimeUtc for (r, _) in fresh if r.SampleTimeUtc is not None]
    latest = max(times) if times else None
    names = [_sensor_display_name(s) for (_, s) in fresh]

    def _avg(values: list[float]) -> Optional[float]:
        return round(sum(values) / len(values), 1) if values else None

    return WeatherSensorSnapshot(
        avgTemperatureC=_avg(temps),
        avgHumidityPct=_avg(hums),
        avgPar=_avg(pars),
        sensorCount=len(fresh),
        sensorNames=names,
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

    Weather is the primary driver. Sensor readings are a secondary signal that
    only nudges the result at the edges, and the caller passes `sensors` only
    for the 'today' range (None for next_2_days / next_7_days). Each result
    carries `factors` listing every contributing code so the UI and the AI
    explanation can show the full cross-check.
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

    # Spraying — weather is primary; high sensor humidity is a secondary signal.
    if current.windSpeedKph > SPRAY_WIND_MAX_KPH:
        spray_status, spray_reason, spray_factors = "not_advised", "high_wind", ["high_wind"]
    elif window_rain >= SPRAY_RAIN_PROB_PCT or current.precipitationMm > 0:
        spray_status, spray_reason, spray_factors = "not_advised", "rain_expected", ["rain_expected"]
    else:
        if current.windSpeedKph >= SPRAY_WIND_CAUTION_KPH:
            spray_status, spray_reason, spray_factors = "caution", "moderate_wind", ["moderate_wind"]
        else:
            spray_status, spray_reason, spray_factors = "advised", "good_conditions", ["good_conditions"]
        # If humidity is high, keep BOTH factors when weather already raised a
        # caution (e.g. moderate wind), so the cross-check is visible.
        if high_sensor_humidity:
            if spray_status == "advised":
                spray_status, spray_reason, spray_factors = "caution", "high_humidity", ["high_humidity"]
            else:
                spray_factors.append("high_humidity")

    # Irrigation
    if window_rain >= IRRIGATION_RAIN_PROB_PCT:
        irr_status, irr_reason, irr_factors = "not_advised", "rain_expected", ["rain_expected"]
    elif window_max_temp >= IRRIGATION_HEAT_C or extreme_sensor_temp:
        irr_status, irr_reason, irr_factors = "caution", "high_heat", ["high_heat"]
    else:
        irr_status, irr_reason, irr_factors = "advised", "no_rain_expected", ["no_rain_expected"]

    # Field work
    if current.precipitationMm > 0 or window_rain >= FIELDWORK_RAIN_PROB_PCT:
        fw_status, fw_reason, fw_factors = "not_advised", "rain_expected", ["rain_expected"]
    elif window_max_temp >= FIELDWORK_HEAT_C or extreme_sensor_temp:
        fw_status, fw_reason, fw_factors = "caution", "extreme_heat", ["extreme_heat"]
    else:
        fw_status, fw_reason, fw_factors = "advised", "clear_conditions", ["clear_conditions"]

    return [
        WeatherRecommendation(activity="spraying", status=spray_status, reason=spray_reason, factors=spray_factors),
        WeatherRecommendation(activity="irrigation", status=irr_status, reason=irr_reason, factors=irr_factors),
        WeatherRecommendation(activity="field_work", status=fw_status, reason=fw_reason, factors=fw_factors),
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
    forecast_days = _forecast_days_for(selected_range)
    body = _fetch_open_meteo(latitude, longitude, forecast_days)

    location = _parse_location(body, (latitude, longitude))
    current = _parse_current(body)
    forecast = _parse_forecast(body)

    # The snapshot is shown for any range when fresh, but sensors only
    # INFLUENCE the 'today' recommendation. Future ranges use weather-only rules.
    sensors = get_sensor_snapshot(db)
    effective_sensors = sensors if selected_range == "today" else None
    recommendations = _build_recommendations(
        current, forecast, effective_sensors, selected_range
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


_RANGE_PHRASES: dict[str, str] = {
    "today": "today",
    "next_2_days": "the next 2 days",
    "next_7_days": "the weekly outlook (next 7 days)",
}


def _summarize_facts(weather: WeatherResponse) -> str:
    """Build a compact, bounded facts summary to ground the AI explanation."""
    cur = weather.current
    loc = weather.location
    range_phrase = _RANGE_PHRASES.get(weather.selectedRange, weather.selectedRange)
    # Use exactly the forecast window the rules used for this range
    # (today -> 1 day, next_2_days -> 2 days, next_7_days -> 7 days).
    window = weather.forecast[: _window_size(weather.selectedRange)]
    lines = [
        f"Selected range: {weather.selectedRange} (refer to it as \"{range_phrase}\")",
        f"Location: {loc.latitude}, {loc.longitude} ({loc.timezone})",
        (
            f"Current weather: temperature {cur.temperatureC}C, humidity "
            f"{cur.humidityPct}%, wind {cur.windSpeedKph} km/h, precipitation "
            f"{cur.precipitationMm} mm, condition {cur.condition}"
        ),
    ]
    if window:
        fc = "; ".join(
            f"{d.date}: {d.tempMinC}-{d.tempMaxC}C, rain "
            f"{d.precipitationProbabilityPct if d.precipitationProbabilityPct is not None else 0}%, "
            f"max wind {d.windSpeedMaxKph} km/h, {d.condition}"
            for d in window
        )
        lines.append(f"Forecast window ({len(window)} day(s) for this range): {fc}")
        # The exact extremes the rules used (cite these for irrigation/field work).
        w_max_temp = max((d.tempMaxC for d in window), default=cur.temperatureC)
        w_max_rain = max(
            (d.precipitationProbabilityPct or 0 for d in window), default=0
        )
        w_max_wind = max((d.windSpeedMaxKph for d in window), default=cur.windSpeedKph)
        lines.append(
            f"Window extremes the rules used: max temperature {w_max_temp}C, "
            f"max rain probability {w_max_rain}%, max wind {w_max_wind} km/h"
        )
    if weather.sensors:
        s = weather.sensors
        lines.append(
            f"Farm sensor snapshot ({s.sensorCount} sensor(s), CURRENT readings): "
            f"avg temp {s.avgTemperatureC}C, avg humidity {s.avgHumidityPct}%, "
            f"avg PAR {s.avgPar}"
        )
    else:
        lines.append("Farm sensor snapshot: none available")
    rec = "; ".join(
        f"{r.activity}={r.status} "
        f"(factors: {', '.join(r.factors) if r.factors else r.reason})"
        for r in weather.recommendations
    )
    lines.append(f"Rule-based recommendation (FINAL — do not change any status): {rec}")
    if weather.selectedRange == "today" and weather.sensors:
        lines.append(
            "Sensor note: for the 'today' range the sensor snapshot reflects "
            "CURRENT farm conditions and may support today's recommendation "
            "(e.g. a high_humidity factor) — mention that it is the current "
            "sensor reading."
        )
    else:
        lines.append(
            "Sensor note: the sensor snapshot is CURRENT information only and is "
            "NOT used as a forecast for this range — do not present it as future "
            "data and do not let it imply anything about future days."
        )
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
        logger.warning(
            "Weather AI explanation skipped: OPENAI_API_KEY is not set; "
            "returning the rule-based recommendation as fallback."
        )
        return base

    system_prompt = (
        "You are a professional agronomy advisor writing a short field briefing "
        "for the manager of a pepper farm. You are given weather facts, the "
        "selected forecast range, optional CURRENT farm sensor facts, and an "
        "ALREADY-DECIDED rule-based recommendation for spraying, irrigation and "
        "field work, each with the exact factors that led to it.\n"
        "\n"
        "Hard rules:\n"
        "- The three statuses (advised / caution / not advised) are FINAL. Never "
        "change, override, soften, or re-decide them; only explain the reasoning "
        "behind each one.\n"
        "- Do NOT merely restate the status or echo the raw factor codes. "
        "Interpret them agronomically and justify them with the concrete numbers "
        "provided.\n"
        "\n"
        "Output format (plain text, no Markdown, no bullet symbols):\n"
        "- Begin with one short lead sentence naming the selected range in words "
        "(today / the next 2 days / the weekly outlook) and the overall picture.\n"
        "- Then exactly three lines, one per activity, each starting with the "
        "label and a colon, in this order:\n"
        "    Spraying: ...\n"
        "    Irrigation: ...\n"
        "    Field work: ...\n"
        "- Treat the three activities with EQUAL depth (roughly one sentence "
        "each). Do not over-focus on spraying.\n"
        "\n"
        "In each activity line, cite the specific weather numbers that drove its "
        "status: wind in km/h, rain probability in %, precipitation in mm, "
        "temperature in C, and humidity in % — use the ones relevant to that "
        "activity. When a recommendation lists more than one factor, mention all "
        "of them (e.g. moderate wind together with high humidity). "
        "If farm sensor facts are present, add at most one short closing "
        "sentence: for the 'today' range note the sensor snapshot reflects "
        "CURRENT farm conditions and may support today's call; for any other "
        "range note it is current information only and is NOT a forecast for "
        "future days. "
        "Be specific and professional — avoid generic filler. Reply in English."
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
            max_tokens=400,
        )
        explanation = (completion.choices[0].message.content or "").strip()
    except Exception as exc:
        # Covers missing package, rate limits, quota, auth and network/service
        # errors. We log the exception TYPE and message (which OpenAI errors
        # expose as a status/quota/auth reason) so the failure is diagnosable —
        # the API key is never part of the exception and is never logged, and we
        # never log the request content.
        logger.warning(
            "Weather AI explanation unavailable (%s): %s; "
            "returning the rule-based recommendation as fallback.",
            type(exc).__name__,
            exc,
        )
        return base

    if not explanation:
        logger.warning(
            "Weather AI explanation came back empty; returning the rule-based "
            "recommendation as fallback."
        )
        return base

    return WeatherAiResponse(
        recommendations=weather.recommendations,
        explanation=explanation,
        source="ai",
    )
