"""
PayPal Sandbox service — PayPal Orders API v2
=============================================
Uses real PayPal Sandbox credentials from environment variables:
  PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_API_BASE

NEVER call this service with real (non-sandbox) credentials in development/testing.
NEVER expose PAYPAL_CLIENT_SECRET to the frontend.
All HTTP calls to PayPal can be replaced with mocks in tests.
"""
import os
import traceback
from typing import Optional

import requests

_DEFAULT_API_BASE = "https://api-m.sandbox.paypal.com"


def _get_config() -> tuple[str, str, str]:
    client_id     = os.getenv("PAYPAL_CLIENT_ID", "")
    client_secret = os.getenv("PAYPAL_CLIENT_SECRET", "")
    api_base      = os.getenv("PAYPAL_API_BASE", _DEFAULT_API_BASE).rstrip("/")
    return client_id, client_secret, api_base


def is_paypal_configured() -> bool:
    client_id, client_secret, _ = _get_config()
    return bool(client_id and client_secret)


def get_paypal_access_token() -> str:
    """
    Obtain a PayPal OAuth access token using client credentials.
    Raises RuntimeError if config is missing or request fails.
    NEVER cache this token across user requests without proper expiry handling.
    """
    client_id, client_secret, api_base = _get_config()
    if not client_id or not client_secret:
        raise RuntimeError(
            "PayPal is not configured. "
            "Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in the backend .env file."
        )

    resp = requests.post(
        f"{api_base}/v1/oauth2/token",
        data={"grant_type": "client_credentials"},
        auth=(client_id, client_secret),
        headers={"Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json"},
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json()["access_token"]


def create_paypal_order(amount_ils: float, currency: str = "ILS", custom_id: str = "") -> dict:
    """
    Create a PayPal order with CAPTURE intent.
    Returns the raw PayPal API response dict, e.g.
      { "id": "PAYPAL_ORDER_ID", "status": "CREATED", "links": [...] }

    Does NOT create an internal order — that happens only after capture succeeds.
    """
    access_token = get_paypal_access_token()
    _, _, api_base = _get_config()

    body = {
        "intent": "CAPTURE",
        "purchase_units": [
            {
                "amount": {
                    "currency_code": currency,
                    "value": f"{amount_ils:.2f}",
                },
                "custom_id": custom_id,
            }
        ],
    }

    resp = requests.post(
        f"{api_base}/v2/checkout/orders",
        json=body,
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        },
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json()


def capture_paypal_order(paypal_order_id: str) -> dict:
    """
    Capture an approved PayPal order.
    Returns the raw PayPal capture response dict.
    Expected success: response["status"] == "COMPLETED"
    Contains: response["purchase_units"][0]["payments"]["captures"][0]["id"]
    """
    access_token = get_paypal_access_token()
    _, _, api_base = _get_config()

    resp = requests.post(
        f"{api_base}/v2/checkout/orders/{paypal_order_id}/capture",
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        },
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json()


def extract_capture_id(capture_response: dict) -> Optional[str]:
    """Pull the capture ID from a successful PayPal capture response."""
    try:
        return capture_response["purchase_units"][0]["payments"]["captures"][0]["id"]
    except (KeyError, IndexError, TypeError):
        return None
