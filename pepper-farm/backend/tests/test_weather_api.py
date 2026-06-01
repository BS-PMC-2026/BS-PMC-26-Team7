"""US36 — Tests for the live weather endpoints.

  GET  /api/manager/weather                  (rule-based, never OpenAI)
  POST /api/manager/weather/ai-recommendation (OpenAI only on explicit trigger)

The real Open-Meteo and OpenAI services are never contacted:
  * httpx.Client is mocked inside services.weather_service.
  * openai.OpenAI is mocked (the SDK is imported lazily inside the service).
Auth is handled by overriding get_current_user; the DB is SQLite in-memory with
dependency_overrides, mirroring test_spray_api.py. The API key is never printed.
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from contextlib import contextmanager
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base, get_db
from main import app
from models.sensor import Sensor, SensorReading
from utils.jwt import get_current_user


# --- DB setup (SQLite in-memory, like test_spray_api.py) -------------------

engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestSession = sessionmaker(bind=engine)


@event.listens_for(engine, "connect")
def _register_sqlite_functions(dbapi_connection, connection_record):
    dbapi_connection.create_function(
        "sysutcdatetime", 0, lambda: datetime.utcnow().isoformat(sep=" ")
    )


@pytest.fixture()
def db():
    Base.metadata.create_all(bind=engine)
    session = TestSession()
    yield session
    session.close()
    Base.metadata.drop_all(bind=engine)


def _db_override(session):
    def _gen():
        try:
            yield session
        finally:
            pass
    return _gen


@pytest.fixture()
def manager_client(db):
    """TestClient authenticated as a FarmManager (no lifespan/scheduler)."""
    app.dependency_overrides[get_db] = _db_override(db)
    app.dependency_overrides[get_current_user] = lambda: {
        "user_id": 1,
        "role": "FarmManager",
    }
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture()
def worker_client(db):
    """TestClient authenticated as a (non-manager) Worker."""
    app.dependency_overrides[get_db] = _db_override(db)
    app.dependency_overrides[get_current_user] = lambda: {
        "user_id": 2,
        "role": "Worker",
    }
    yield TestClient(app)
    app.dependency_overrides.clear()


# --- Fakes & helpers -------------------------------------------------------

def make_meteo_body(current=None, daily=None) -> dict:
    """Build a fake Open-Meteo payload; calm/clear by default."""
    return {
        "latitude": 31.283,
        "longitude": 34.433,
        "timezone": "Asia/Jerusalem",
        "current": current
        or {
            "time": "2026-05-31T14:00",
            "temperature_2m": 24.0,
            "relative_humidity_2m": 50,
            "wind_speed_10m": 8.0,
            "precipitation": 0.0,
            "weather_code": 1,
        },
        "daily": daily
        or {
            "time": ["2026-05-31", "2026-06-01", "2026-06-02", "2026-06-03"],
            "weather_code": [1, 2, 1, 0],
            "temperature_2m_max": [28.0, 27.0, 29.0, 26.0],
            "temperature_2m_min": [17.0, 16.0, 18.0, 15.0],
            "precipitation_probability_max": [10, 5, 0, 15],
            "wind_speed_10m_max": [15.0, 14.0, 12.0, 10.0],
        },
    }


@contextmanager
def mock_open_meteo(*, status_code=200, json_data=None, text=""):
    """Patch httpx.Client inside weather_service with a fake response."""
    response = MagicMock()
    response.status_code = status_code
    response.text = text
    if json_data is not None:
        response.json.return_value = json_data
    else:
        response.json.side_effect = ValueError("no json")

    fake_client = MagicMock()
    fake_client.get.return_value = response
    fake_client.__enter__.return_value = fake_client
    fake_client.__exit__.return_value = False

    with patch("services.weather_service.httpx.Client", return_value=fake_client):
        yield


def mock_openai_success(content="Winds are calm and no rain is expected, so spraying is fine."):
    """Patch openai.OpenAI to return a successful completion."""
    message = MagicMock()
    message.content = content
    choice = MagicMock()
    choice.message = message
    completion = MagicMock()
    completion.choices = [choice]

    client = MagicMock()
    client.chat.completions.create.return_value = completion
    return patch("openai.OpenAI", return_value=client)


def _hours_ago(hours: float) -> datetime:
    """A naive-UTC timestamp `hours` in the past (matches the service clock)."""
    return datetime.utcnow() - timedelta(hours=hours)


def seed_sensors(db):
    """Two active sensors with FRESH latest readings (1–2 hours old)."""
    db.add_all(
        [
            Sensor(SensorId=1, MacAddress="AA", IsActive=True),
            Sensor(SensorId=2, MacAddress="BB", IsActive=True),
        ]
    )
    db.add_all(
        [
            SensorReading(
                SensorId=1, MacAddress="AA", Temperature=25.0, Humidity=60.0,
                PAR=150.0, SampleTimeUtc=_hours_ago(1),
                ReadingType="std", RawJson="{}",
            ),
            SensorReading(
                SensorId=2, MacAddress="BB", Temperature=27.0, Humidity=64.0,
                PAR=180.0, SampleTimeUtc=_hours_ago(2),
                ReadingType="std", RawJson="{}",
            ),
        ]
    )
    db.commit()


# --- GET /api/manager/weather ----------------------------------------------

def test_get_weather_returns_live_response(manager_client):
    """Returns 200 with current weather, 4-day forecast and recommendations."""
    with mock_open_meteo(json_data=make_meteo_body()):
        res = manager_client.get("/api/manager/weather")

    assert res.status_code == 200
    data = res.json()
    assert data["current"]["temperatureC"] == 24.0
    assert data["current"]["condition"] == "mainly_clear"
    assert len(data["forecast"]) == 4
    assert {r["activity"] for r in data["recommendations"]} == {
        "spraying", "irrigation", "field_work",
    }
    assert data["selectedRange"] == "next_2_days"  # default


def test_get_weather_does_not_call_openai(manager_client):
    """The dashboard endpoint must never construct an OpenAI client."""
    openai_mock = MagicMock()
    with mock_open_meteo(json_data=make_meteo_body()):
        with patch("openai.OpenAI", openai_mock):
            res = manager_client.get("/api/manager/weather")

    assert res.status_code == 200
    openai_mock.assert_not_called()


def test_sensor_snapshot_included_when_readings_exist(manager_client, db):
    """sensors is populated from the latest reading of each active sensor."""
    seed_sensors(db)
    with mock_open_meteo(json_data=make_meteo_body()):
        res = manager_client.get("/api/manager/weather")

    assert res.status_code == 200
    sensors = res.json()["sensors"]
    assert sensors is not None
    assert sensors["sensorCount"] == 2
    assert sensors["avgTemperatureC"] == 26.0   # (25 + 27) / 2
    assert sensors["avgHumidityPct"] == 62.0     # (60 + 64) / 2


def test_sensors_null_when_no_readings(manager_client):
    """sensors is null when there are no sensor readings."""
    with mock_open_meteo(json_data=make_meteo_body()):
        res = manager_client.get("/api/manager/weather")

    assert res.status_code == 200
    assert res.json()["sensors"] is None


def test_stale_readings_excluded_from_snapshot(manager_client, db):
    """A sensor whose latest reading is older than 24h is excluded."""
    db.add_all(
        [
            Sensor(SensorId=1, MacAddress="AA", IsActive=True),
            Sensor(SensorId=2, MacAddress="BB", IsActive=True),
        ]
    )
    db.add_all(
        [
            SensorReading(  # fresh
                SensorId=1, MacAddress="AA", Temperature=22.0, Humidity=55.0,
                PAR=120.0, SampleTimeUtc=_hours_ago(2),
                ReadingType="std", RawJson="{}",
            ),
            SensorReading(  # stale (48h) — must be ignored
                SensorId=2, MacAddress="BB", Temperature=99.0, Humidity=99.0,
                PAR=999.0, SampleTimeUtc=_hours_ago(48),
                ReadingType="std", RawJson="{}",
            ),
        ]
    )
    db.commit()

    with mock_open_meteo(json_data=make_meteo_body()):
        res = manager_client.get("/api/manager/weather")

    assert res.status_code == 200
    sensors = res.json()["sensors"]
    assert sensors is not None
    assert sensors["sensorCount"] == 1            # only the fresh sensor
    assert sensors["avgTemperatureC"] == 22.0     # stale 99.0 excluded
    assert sensors["avgHumidityPct"] == 55.0


def test_sensors_null_when_all_stale(manager_client, db):
    """When every sensor's latest reading is stale, sensors is null."""
    db.add(Sensor(SensorId=1, MacAddress="AA", IsActive=True))
    db.add(
        SensorReading(
            SensorId=1, MacAddress="AA", Temperature=20.0, Humidity=50.0,
            PAR=100.0, SampleTimeUtc=_hours_ago(48),
            ReadingType="std", RawJson="{}",
        )
    )
    db.commit()

    with mock_open_meteo(json_data=make_meteo_body()):
        res = manager_client.get("/api/manager/weather")

    assert res.status_code == 200
    assert res.json()["sensors"] is None


def test_stale_sensor_does_not_affect_recommendations(manager_client, db):
    """A stale, very humid sensor must not flip spraying to high_humidity."""
    # If this stale reading were used, spraying would become caution/high_humidity.
    db.add(Sensor(SensorId=1, MacAddress="AA", IsActive=True))
    db.add(
        SensorReading(
            SensorId=1, MacAddress="AA", Temperature=20.0, Humidity=100.0,
            PAR=100.0, SampleTimeUtc=_hours_ago(48),
            ReadingType="std", RawJson="{}",
        )
    )
    db.commit()

    with mock_open_meteo(json_data=make_meteo_body()):  # calm, clear weather
        res = manager_client.get("/api/manager/weather")

    assert res.status_code == 200
    data = res.json()
    assert data["sensors"] is None  # stale → no snapshot
    spraying = {r["activity"]: r for r in data["recommendations"]}["spraying"]
    assert spraying["status"] == "advised"
    assert spraying["reason"] == "good_conditions"


def test_range_affects_recommendations(manager_client):
    """Rain only on day 2 → today advised, next_2_days not advised (irrigation)."""
    body = make_meteo_body(
        daily={
            "time": ["2026-05-31", "2026-06-01", "2026-06-02", "2026-06-03"],
            "weather_code": [1, 61, 1, 0],
            "temperature_2m_max": [28.0, 27.0, 29.0, 26.0],
            "temperature_2m_min": [17.0, 16.0, 18.0, 15.0],
            "precipitation_probability_max": [10, 80, 0, 0],  # rain on day 2 only
            "wind_speed_10m_max": [15.0, 14.0, 12.0, 10.0],
        }
    )

    with mock_open_meteo(json_data=body):
        today = manager_client.get("/api/manager/weather?range=today").json()
    with mock_open_meteo(json_data=body):
        next2 = manager_client.get("/api/manager/weather?range=next_2_days").json()

    today_irrig = {r["activity"]: r for r in today["recommendations"]}["irrigation"]
    next2_irrig = {r["activity"]: r for r in next2["recommendations"]}["irrigation"]

    assert today_irrig["status"] == "advised"
    assert next2_irrig["status"] == "not_advised"
    assert next2_irrig["reason"] == "rain_expected"


# --- POST /api/manager/weather/ai-recommendation ---------------------------

def test_ai_recommendation_returns_ai_source(manager_client, monkeypatch):
    """With a key set and OpenAI mocked, source is 'ai' with an explanation."""
    monkeypatch.setenv("OPENAI_API_KEY", "test-key-not-real")
    with mock_open_meteo(json_data=make_meteo_body()):
        with mock_openai_success() as openai_mock:
            res = manager_client.post(
                "/api/manager/weather/ai-recommendation", json={"range": "today"}
            )

    assert res.status_code == 200
    data = res.json()
    assert data["source"] == "ai"
    assert data["explanation"]  # non-empty
    assert len(data["recommendations"]) == 3
    openai_mock.assert_called_once()  # OpenAI called only on explicit trigger


def test_ai_recommendation_fallback_when_key_missing(manager_client, monkeypatch):
    """No API key → graceful fallback to the rule-based recommendation."""
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    openai_mock = MagicMock()
    with mock_open_meteo(json_data=make_meteo_body()):
        with patch("openai.OpenAI", openai_mock):
            res = manager_client.post(
                "/api/manager/weather/ai-recommendation", json={}
            )

    assert res.status_code == 200
    data = res.json()
    assert data["source"] == "fallback"
    assert data["explanation"] == ""
    assert len(data["recommendations"]) == 3
    openai_mock.assert_not_called()  # no key → never construct a client


def test_ai_recommendation_fallback_when_openai_fails(manager_client, monkeypatch):
    """OpenAI raising → graceful fallback to the rule-based recommendation."""
    monkeypatch.setenv("OPENAI_API_KEY", "test-key-not-real")
    with mock_open_meteo(json_data=make_meteo_body()):
        with patch("openai.OpenAI", side_effect=Exception("boom")):
            res = manager_client.post(
                "/api/manager/weather/ai-recommendation", json={"range": "next_2_days"}
            )

    assert res.status_code == 200
    data = res.json()
    assert data["source"] == "fallback"
    assert len(data["recommendations"]) == 3


# --- Auth ------------------------------------------------------------------

def test_non_manager_blocked_on_get(worker_client):
    """A non-FarmManager user is blocked from the dashboard endpoint."""
    with mock_open_meteo(json_data=make_meteo_body()):
        res = worker_client.get("/api/manager/weather")
    assert res.status_code == 403


def test_non_manager_blocked_on_ai(worker_client):
    """A non-FarmManager user is blocked from the AI endpoint."""
    with mock_open_meteo(json_data=make_meteo_body()):
        res = worker_client.post(
            "/api/manager/weather/ai-recommendation", json={}
        )
    assert res.status_code == 403
