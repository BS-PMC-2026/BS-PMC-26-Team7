"""
Tests for the visitor AI chatbot endpoint:
  POST /api/chatbot   (public, no auth)

These tests verify the chatbot behaves according to the user story:
  - the endpoint is publicly reachable (visitors are not logged in)
  - general culinary questions are answered by OpenAI            -> source="ai"
  - internal factual questions are grounded in DB data            -> source="db"
  - internal factual questions with NO supporting data fall back
    instead of being guessed by OpenAI                            -> source="fallback"
  - OpenAI failures and a missing API key fail safely             -> source="fallback"
  - request validation works                                      -> 422

The real OpenAI API is NEVER called: `openai.OpenAI` is patched in every test
that could reach it, and a dummy OPENAI_API_KEY is used so the real key (loaded
from .env) is never read.
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from datetime import datetime
from unittest.mock import patch, MagicMock

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base, get_db
from main import app

# Register models so their tables are created by create_all().
import models.role            # noqa: F401
import models.pepper_variety  # noqa: F401
import models.farm_zone       # noqa: F401
import models.user            # noqa: F401
import models.task            # noqa: F401
import models.plant           # noqa: F401
import models.product         # noqa: F401
import models.inventory       # noqa: F401
import models.sensor          # noqa: F401
import models.spray           # noqa: F401

from models.pepper_variety import PepperVariety
from models.product import Product

# ── DB setup (same pattern as test_spray_restrictions_api.py) ──────────────────

engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestSession = sessionmaker(bind=engine)


@event.listens_for(engine, "connect")
def _sqlite_functions(dbapi_conn, _):
    # PepperVariety/Product use server_default=func.sysutcdatetime() on CreatedAt.
    dbapi_conn.create_function("sysutcdatetime", 0,
                               lambda: datetime.utcnow().isoformat(sep=" "))


@pytest.fixture()
def db():
    Base.metadata.create_all(bind=engine)
    session = TestSession()
    yield session
    session.close()
    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def client(db):
    """TestClient with the DB dependency overridden. The chatbot endpoint is
    public, so no auth dependencies need overriding."""
    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def _dummy_openai_key(monkeypatch):
    """Ensure the real OPENAI_API_KEY (from .env) is never used in tests.
    Individual tests may delete it (missing-key case)."""
    monkeypatch.setenv("OPENAI_API_KEY", "test-key-not-real")


# ── OpenAI mock helper ─────────────────────────────────────────────────────────

def _build_openai_mock(answer="MOCK ANSWER", exc=None):
    """Return (FakeOpenAIClass, create_mock).

    Patch `openai.OpenAI` with FakeOpenAIClass so no real client is built and
    no network call is made. `create_mock` stands in for
    client.chat.completions.create — inspect it to assert what was sent, or
    that it was (not) called.
    """
    create_mock = MagicMock()
    if exc is not None:
        create_mock.side_effect = exc
    else:
        message = MagicMock()
        message.content = answer
        choice = MagicMock()
        choice.message = message
        completion = MagicMock()
        completion.choices = [choice]
        create_mock.return_value = completion

    fake_client = MagicMock()
    fake_client.chat.completions.create = create_mock
    fake_openai_cls = MagicMock(return_value=fake_client)
    return fake_openai_cls, create_mock


def _system_prompt_text(create_mock) -> str:
    """Extract the system message content sent to OpenAI."""
    messages = create_mock.call_args.kwargs["messages"]
    return "\n".join(m["content"] for m in messages if m.get("role") == "system")


# ── Seed helpers ───────────────────────────────────────────────────────────────

def seed_pepper(db, name="Lemon Pepper", smin=30000, smax=50000,
                desc="Bright, citrusy heat."):
    pepper = PepperVariety(
        PepperName=name,
        HeatLevelScovilleMin=smin,
        HeatLevelScovilleMax=smax,
        GeneralDescription=desc,
        IsActive=True,
    )
    db.add(pepper)
    db.commit()
    db.refresh(pepper)
    return pepper


def seed_product(db, name="Hot Sauce", category="Sauces", price=12.50):
    product = Product(
        ProductName=name,
        Category=category,
        Price=price,
        IsActive=True,
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


# ── 1. Public access ────────────────────────────────────────────────────────────

def test_public_access_without_jwt_returns_200(client):
    """The endpoint is reachable with no Authorization header (not 401/403)."""
    fake_cls, _ = _build_openai_mock(answer="Hi there!")
    with patch("openai.OpenAI", fake_cls):
        res = client.post("/api/chatbot", json={"message": "Hello"})

    assert res.status_code == 200
    assert res.status_code not in (401, 403)


# ── 2. General culinary question -> source="ai" ─────────────────────────────────

def test_general_question_returns_ai_source(client):
    """A general culinary question is answered by (mocked) OpenAI."""
    fake_cls, create_mock = _build_openai_mock(answer="Try a roasted veggie pasta.")
    with patch("openai.OpenAI", fake_cls):
        res = client.post(
            "/api/chatbot",
            json={"message": "Can you suggest a simple dinner recipe idea?"},
        )

    assert res.status_code == 200
    body = res.json()
    assert body["source"] == "ai"
    assert body["answer"] == "Try a roasted veggie pasta."
    # The mocked OpenAI was used (so the real API was never called).
    assert create_mock.call_count == 1


# ── 3. Pepper factual question -> source="db", grounded in DB facts ─────────────

def test_pepper_factual_question_uses_db_context(client, db):
    """A factual pepper question pulls Scoville data from the DB into the prompt."""
    seed_pepper(db, name="Lemon Pepper", smin=30000, smax=50000)

    fake_cls, create_mock = _build_openai_mock(answer="Lemon Pepper is fairly hot.")
    with patch("openai.OpenAI", fake_cls):
        res = client.post(
            "/api/chatbot",
            json={"message": "What is the Scoville level of your peppers?"},
        )

    assert res.status_code == 200
    body = res.json()
    assert body["source"] == "db"
    assert body["answer"] == "Lemon Pepper is fairly hot."

    # The context sent to OpenAI must contain the real DB facts.
    system_text = _system_prompt_text(create_mock)
    assert "Lemon Pepper" in system_text
    assert "30,000-50,000 SHU" in system_text


# ── 4. Product price question -> source="db", grounded in DB facts ──────────────

def test_product_price_question_uses_db_context(client, db):
    """A factual product/price question pulls product data from the DB."""
    seed_product(db, name="Hot Sauce", category="Sauces", price=12.50)

    fake_cls, create_mock = _build_openai_mock(answer="Our Hot Sauce is 12.50.")
    with patch("openai.OpenAI", fake_cls):
        res = client.post(
            "/api/chatbot",
            json={"message": "How much do your products cost?"},
        )

    assert res.status_code == 200
    body = res.json()
    assert body["source"] == "db"

    system_text = _system_prompt_text(create_mock)
    assert "Hot Sauce" in system_text
    assert "12.50" in system_text


# ── 5. Stock question with no DB support -> source="fallback", OpenAI not called ─

def test_stock_question_without_db_returns_fallback(client):
    """Inventory/stock is not connected; a stock question must not be guessed."""
    fake_cls, create_mock = _build_openai_mock(answer="should not be used")
    with patch("openai.OpenAI", fake_cls):
        res = client.post(
            "/api/chatbot",
            json={"message": "What do you currently have in stock?"},
        )

    assert res.status_code == 200
    assert res.json()["source"] == "fallback"
    # The safety rule short-circuits before OpenAI is ever contacted.
    create_mock.assert_not_called()


# ── 6. OpenAI failure -> source="fallback", HTTP 200 ────────────────────────────

def test_openai_failure_returns_fallback(client):
    """If OpenAI raises, the endpoint fails safely with a fallback (no 500)."""
    fake_cls, create_mock = _build_openai_mock(exc=RuntimeError("openai is down"))
    with patch("openai.OpenAI", fake_cls):
        res = client.post(
            "/api/chatbot",
            json={"message": "Can you suggest a simple dinner recipe idea?"},
        )

    assert res.status_code == 200
    assert res.json()["source"] == "fallback"
    # OpenAI was attempted (and raised) — the error did not reach the client.
    assert create_mock.call_count == 1


# ── 7. Validation -> 422 ────────────────────────────────────────────────────────

def test_empty_message_returns_422(client):
    res = client.post("/api/chatbot", json={"message": ""})
    assert res.status_code == 422


def test_invalid_body_returns_422(client):
    res = client.post("/api/chatbot", json={})
    assert res.status_code == 422


# ── 8. Missing API key -> source="fallback", OpenAI not called ──────────────────

def test_missing_api_key_returns_fallback(client, monkeypatch):
    """With no OPENAI_API_KEY configured, the endpoint returns a fallback and
    never contacts OpenAI."""
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    fake_cls, create_mock = _build_openai_mock(answer="should not be used")
    with patch("openai.OpenAI", fake_cls):
        res = client.post(
            "/api/chatbot",
            json={"message": "Can you suggest a simple dinner recipe idea?"},
        )

    assert res.status_code == 200
    assert res.json()["source"] == "fallback"
    create_mock.assert_not_called()


# ── 9. QA: chatbot performs NO write actions (strictly read-only) ────────────────

def test_chatbot_does_not_perform_write_actions(client, db):
    """QA (Jira): the chatbot must never write to the database.

    A chatbot request must not create, delete, or modify any PepperVariety or
    Product rows. We snapshot the catalog before the request and assert it is
    byte-for-byte identical afterwards (same row counts, same field values).
    """
    pepper = seed_pepper(db, name="Lemon Pepper", smin=30000, smax=50000,
                         desc="Bright, citrusy heat.")
    product = seed_product(db, name="Hot Sauce", category="Sauces", price=12.50)

    # Snapshot row counts and the exact field values of the seeded rows.
    peppers_before = db.query(PepperVariety).count()
    products_before = db.query(Product).count()

    pepper_snapshot = {
        "PepperId": pepper.PepperId,
        "PepperName": pepper.PepperName,
        "HeatLevelScovilleMin": pepper.HeatLevelScovilleMin,
        "HeatLevelScovilleMax": pepper.HeatLevelScovilleMax,
        "GeneralDescription": pepper.GeneralDescription,
        "IsActive": pepper.IsActive,
    }
    product_snapshot = {
        "ProductId": product.ProductId,
        "ProductName": product.ProductName,
        "Category": product.Category,
        "Price": product.Price,
        "IsActive": product.IsActive,
    }

    fake_cls, _ = _build_openai_mock(answer="We grow Lemon Pepper and sell Hot Sauce.")
    with patch("openai.OpenAI", fake_cls):
        res = client.post(
            "/api/chatbot",
            json={"message": "What peppers and products do you have?"},
        )

    # 1. The request succeeds.
    assert res.status_code == 200

    # 2. No rows were created or deleted — counts are unchanged.
    db.expire_all()  # drop the identity-map cache so we re-read from the DB
    assert db.query(PepperVariety).count() == peppers_before
    assert db.query(Product).count() == products_before

    # 3. The existing rows were not modified in any field.
    pepper_after = (
        db.query(PepperVariety)
        .filter(PepperVariety.PepperId == pepper_snapshot["PepperId"])
        .one()
    )
    product_after = (
        db.query(Product)
        .filter(Product.ProductId == product_snapshot["ProductId"])
        .one()
    )

    assert {
        "PepperId": pepper_after.PepperId,
        "PepperName": pepper_after.PepperName,
        "HeatLevelScovilleMin": pepper_after.HeatLevelScovilleMin,
        "HeatLevelScovilleMax": pepper_after.HeatLevelScovilleMax,
        "GeneralDescription": pepper_after.GeneralDescription,
        "IsActive": pepper_after.IsActive,
    } == pepper_snapshot

    assert {
        "ProductId": product_after.ProductId,
        "ProductName": product_after.ProductName,
        "Category": product_after.Category,
        "Price": product_after.Price,
        "IsActive": product_after.IsActive,
    } == product_snapshot
