"""
Chatbot service.

Bridges a visitor's free-text question to OpenAI and returns a ChatResponse.

Grounding & labeling: before calling OpenAI the service decides what kind of
question this is and chooses the answer `source` accordingly. OpenAI never
touches the database — only this backend does.

Decision logic (see answer_question):
- exact DB match (a known pepper/product name is in the question)  -> "db"
- general factual catalog question with DB facts                   -> "db"
- specific factual question with NO exact match                    -> "fallback"
- general recommendation with NO exact match                       -> "ai"
- otherwise, facts present -> "db"; else                           -> "ai"

DB FACTS are injected into the prompt ONLY when the answer is DB-grounded
(source == "db"). A general recommendation gets no catalog facts, so OpenAI
answers directly from general culinary knowledge.

Safety:
- The OpenAI API key is read from the environment and is NEVER printed,
  logged, or exposed.
- This service is READ-ONLY: it only reads pepper/product data.
- It never raises: any problem (missing key, rate/token limit, network or
  service error) results in a safe fallback reply.
"""

import os

from dotenv import load_dotenv
from sqlalchemy.orm import Session

from schemas.chatbot import ChatResponse
from services.pepper_service import get_all_peppers
from services.product_service import get_products

load_dotenv()

# Model is configurable via the OPENAI_MODEL env var. If it is missing we use a
# cheap, fast default so the chatbot still works out of the box.
DEFAULT_MODEL = "gpt-4o-mini"

# A single safe reply, used whenever we cannot produce a real answer.
FALLBACK_MESSAGE = (
    "Sorry, I don't have that information right now. Please try again later "
    "or check the website."
)

# Cap how many items of each type we send to OpenAI, to bound the prompt size.
MAX_FACTS_PER_TYPE = 25

# Keyword sets (lowercase) for simple intent detection. Hebrew + English.
_PEPPER_KEYWORDS = (
    "pepper", "peppers", "spicy", "hot", "scoville", "heat", "variety",
    "varieties", "פלפל", "פלפלים", "חריף", "חריפות", "זן", "זנים", "סקוביל",
)
_PRODUCT_KEYWORDS = (
    "product", "products", "price", "prices", "cost", "buy", "sale", "catalog",
    "מוצר", "מוצרים", "מחיר", "מחירים", "עלות", "לקנות", "קטלוג",
)

# Words that signal an INTERNAL FACTUAL question — answers must come from the DB.
_FACTUAL_KEYWORDS = (
    "price", "prices", "cost", "stock", "inventory", "scoville", "heat",
    "available", "availability", "in stock",
    "מחיר", "מחירים", "עלות", "מלאי", "במלאי", "זמין", "זמינות", "סקוביל",
    "רמת חריפות",
)

# Words that signal a GENERAL RECOMMENDATION question (recipes, uses, pairings).
_RECOMMENDATION_KEYWORDS = (
    "cook", "cooking", "recipe", "recipes", "pair", "pairing", "dish", "dishes",
    "make", "prepare", "serve", "use", "uses", "using", "idea", "ideas",
    "מתכון", "מתכונים", "לבשל", "להכין", "שילוב", "שילובים", "להשתמש",
)

# Collective (plural) terms that signal a GENERAL CATALOG question, as opposed
# to a question about one named item. Deliberately plural-only: "peppers"/
# "products" mean the whole catalog, while "pepper"/"product" can be specific.
_GENERAL_CATALOG_KEYWORDS = (
    "peppers", "products", "varieties", "catalog", "items",
    "פלפלים", "מוצרים", "זנים",
)


def _get_api_key() -> str | None:
    """Return the OpenAI API key from the environment, or None if it is unset."""
    return os.getenv("OPENAI_API_KEY") or None


def _get_model() -> str:
    """Return the configured model name, or a safe default if unset."""
    return os.getenv("OPENAI_MODEL") or DEFAULT_MODEL


def _matches(message_lower: str, keywords: tuple[str, ...]) -> bool:
    """True if any keyword appears in the (already lowercased) message."""
    return any(word in message_lower for word in keywords)


def _looks_like_factual_question(message_lower: str) -> bool:
    """True if the message looks like an internal factual question.

    These (price/stock/Scoville/etc.) must be answered from DB data only.
    """
    return _matches(message_lower, _FACTUAL_KEYWORDS)


def _gather_context(db: Session, message: str) -> tuple[str, bool, bool]:
    """Collect minimal, read-only DB facts relevant to the question.

    Returns (facts_text, found_facts, exact_match):
      - facts_text   : compact catalog text for the prompt (only relevant fields)
      - found_facts  : whether any catalog rows were gathered
      - exact_match  : whether a known pepper/product NAME appears in the message
    Lists are capped at MAX_FACTS_PER_TYPE to keep the prompt small.
    """
    message_lower = message.lower()
    sections: list[str] = []
    exact_match = False

    if _matches(message_lower, _PEPPER_KEYWORDS):
        all_peppers = get_all_peppers(db)
        if all_peppers:
            if any(p.PepperName and p.PepperName.lower() in message_lower for p in all_peppers):
                exact_match = True
            lines = ["Pepper varieties:"]
            for p in all_peppers[:MAX_FACTS_PER_TYPE]:
                scoville = ""
                if p.HeatLevelScovilleMin is not None and p.HeatLevelScovilleMax is not None:
                    scoville = f" Scoville {p.HeatLevelScovilleMin:,}-{p.HeatLevelScovilleMax:,} SHU."
                description = f" {p.GeneralDescription}" if p.GeneralDescription else ""
                lines.append(f"- {p.PepperName}:{scoville}{description}".rstrip())
            sections.append("\n".join(lines))

    if _matches(message_lower, _PRODUCT_KEYWORDS):
        all_products = get_products(db)
        if all_products:
            if any(prod.get("ProductName") and prod["ProductName"].lower() in message_lower
                   for prod in all_products):
                exact_match = True
            lines = ["Products:"]
            for prod in all_products[:MAX_FACTS_PER_TYPE]:
                category = f" ({prod['Category']})" if prod.get("Category") else ""
                lines.append(f"- {prod['ProductName']}{category}: {prod['Price']:.2f}")
            sections.append("\n".join(lines))

    facts_text = "\n\n".join(sections)
    return facts_text, bool(facts_text), exact_match


def _build_system_prompt(facts_text: str, include_facts: bool) -> str:
    """Build the system prompt.

    When include_facts is True the answer is DB-grounded and the FACTS section
    is embedded. When False the visitor asked for a general recommendation, so
    we instruct a direct answer from general knowledge with no catalog facts.
    """
    common = (
        "You are a friendly assistant for a pepper farm website. "
        "Answer concisely in plain text. Do not use any Markdown formatting "
        "(no **bold**, headings, bullet symbols, or backticks). "
        "Reply in the same language the visitor used."
    )
    if include_facts:
        return (
            f"{common} "
            "Use ONLY the information in the FACTS section for internal facts "
            "(prices, Scoville/heat levels, variety or product details). "
            "If a requested internal fact is not in FACTS, say you don't have "
            "that information — do not guess or invent it."
            f"\n\nFACTS:\n{facts_text}"
        )
    return (
        f"{common} "
        "Give a direct, helpful general culinary suggestion from your own "
        "knowledge (recipes, flavor pairings, uses). Do not claim to lack "
        "specific data, and do not mention any database or internal records."
    )


def answer_question(db: Session, message: str) -> ChatResponse:
    """Answer a visitor's question with correct source labeling.

    Returns a safe fallback reply (source="fallback") if the API key is missing,
    if the OpenAI call fails, or if a specific factual question cannot be
    grounded in DB data. This function never raises.
    """
    message_lower = message.lower()
    facts_text, found_facts, exact_match = _gather_context(db, message)

    is_factual = _looks_like_factual_question(message_lower)
    is_recommendation = _matches(message_lower, _RECOMMENDATION_KEYWORDS)
    is_general_catalog = _matches(message_lower, _GENERAL_CATALOG_KEYWORDS)

    # Decide the answer source (and short-circuit un-groundable factual ones).
    if exact_match:
        source = "db"
    elif is_factual:
        if found_facts and is_general_catalog:
            source = "db"
        else:
            # Specific factual question with no exact match, or no facts at all:
            # do not let OpenAI guess internal facts.
            return ChatResponse(answer=FALLBACK_MESSAGE, source="fallback")
    elif is_recommendation:
        source = "ai"
    elif found_facts:
        source = "db"
    else:
        source = "ai"

    # Inject DB FACTS only when the answer is DB-grounded. A general
    # recommendation must NOT receive the unrelated full catalog.
    include_facts = source == "db"

    api_key = _get_api_key()
    if not api_key:
        # No key configured — do not crash, return a safe fallback.
        return ChatResponse(answer=FALLBACK_MESSAGE, source="fallback")

    try:
        # Imported here (not at module top) so the rest of the app can import
        # this module even before the `openai` package is installed.
        from openai import OpenAI

        client = OpenAI(api_key=api_key)
        completion = client.chat.completions.create(
            model=_get_model(),
            messages=[
                {"role": "system", "content": _build_system_prompt(facts_text, include_facts)},
                {"role": "user", "content": message},
            ],
            max_tokens=400,
        )

        answer = (completion.choices[0].message.content or "").strip()
        if not answer:
            return ChatResponse(answer=FALLBACK_MESSAGE, source="fallback")

        return ChatResponse(answer=answer, source=source)

    except Exception:
        # Covers rate limits, token/context-length errors, network issues and
        # service outages. We deliberately do not log the exception detail to
        # avoid accidentally leaking the request content or the API key.
        return ChatResponse(answer=FALLBACK_MESSAGE, source="fallback")
