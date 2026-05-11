import os
from datetime import datetime
from pathlib import Path
from typing import Any, ClassVar

import httpx
from dotenv import load_dotenv


BACKEND_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BACKEND_DIR / ".env")


class AtomationApiError(Exception):
    pass


class AtomationService:
    _cached_token: ClassVar[str | None] = None

    def __init__(self):
        self.base_url = os.getenv(
            "ATOMATION_API_BASE_URL",
            "https://atapi.atomation.net/api/v1/s2s/v1_0",
        ).rstrip("/")

        self.email = os.getenv("ATOMATION_EMAIL")
        self.password = os.getenv("ATOMATION_PASSWORD")
        self.app_version = os.getenv("ATOMATION_APP_VERSION", "3.3.6 + 118")
        self.access_type = os.getenv("ATOMATION_ACCESS_TYPE", "5")

        env_token = os.getenv("ATOMATION_BEARER_TOKEN")

        if AtomationService._cached_token:
            self.token = AtomationService._cached_token
        elif env_token:
            self.token = self._normalize_token(env_token)
            AtomationService._cached_token = self.token
        else:
            self.token = None

        if not self.email or not self.password:
            raise AtomationApiError(
                "ATOMATION_EMAIL and ATOMATION_PASSWORD are missing in backend/.env"
            )

    @staticmethod
    def _normalize_token(token: str) -> str:
        token = token.strip()

        if token.lower().startswith("bearer "):
            token = token[7:].strip()

        return token

    def _auth_headers(self) -> dict[str, str]:
        return {
            "accept": "application/json",
            "app_version": self.app_version,
            "access_type": self.access_type,
            "Content-Type": "application/json",
        }

    def _headers(self) -> dict[str, str]:
        if not self.token:
            self._login()

        return {
            "accept": "application/json",
            "app_version": self.app_version,
            "access_type": self.access_type,
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.token}",
        }

    @staticmethod
    def _format_datetime(value: datetime) -> str:
        return value.strftime("%Y-%m-%dT%H:%M:%S.000Z")

    @staticmethod
    def _extract_token_from_response(body: dict[str, Any]) -> str | None:
        token_keys = {
            "token",
            "access_token",
            "accessToken",
            "jwt",
            "bearer",
        }

        def search(obj: Any) -> str | None:
            if isinstance(obj, dict):
                for key, value in obj.items():
                    if key in token_keys and isinstance(value, str) and value.strip():
                        return value.strip()

                for value in obj.values():
                    found = search(value)
                    if found:
                        return found

            if isinstance(obj, list):
                for item in obj:
                    found = search(item)
                    if found:
                        return found

            return None

        return search(body)

    def _login(self) -> None:
        url = f"{self.base_url}/auth/login"

        payload = {
            "email": self.email,
            "password": self.password,
        }

        with httpx.Client(timeout=45) as client:
            response = client.post(
                url,
                json=payload,
                headers=self._auth_headers(),
            )

        try:
            body = response.json()
        except Exception:
            raise AtomationApiError(
                f"Atomation login returned non-JSON response: {response.text}"
            )

        if response.status_code != 200:
            raise AtomationApiError(
                f"Atomation login failed HTTP {response.status_code}: {body}"
            )

        if body.get("code") not in (None, 200):
            raise AtomationApiError(f"Atomation login API error: {body}")

        token = self._extract_token_from_response(body)

        if not token:
            raise AtomationApiError(
                f"Atomation login succeeded but token was not found in response: {body}"
            )

        self.token = self._normalize_token(token)
        AtomationService._cached_token = self.token

    def _post_with_auto_login(self, url: str, payload: dict[str, Any]) -> dict[str, Any]:
        if not self.token:
            self._login()

        with httpx.Client(timeout=45) as client:
            response = client.post(
                url,
                json=payload,
                headers=self._headers(),
            )

        try:
            body = response.json()
        except Exception:
            raise AtomationApiError(f"Atomation returned non-JSON response: {response.text}")

        is_token_problem = (
            response.status_code == 401
            or body.get("code") == 401
            or "jwt expired" in str(body).lower()
            or "invalid/expired" in str(body).lower()
            or "no token supplied" in str(body).lower()
        )

        if is_token_problem:
            AtomationService._cached_token = None
            self.token = None
            self._login()

            with httpx.Client(timeout=45) as client:
                response = client.post(
                    url,
                    json=payload,
                    headers=self._headers(),
                )

            try:
                body = response.json()
            except Exception:
                raise AtomationApiError(
                    f"Atomation returned non-JSON response after login retry: {response.text}"
                )

        if response.status_code != 200:
            raise AtomationApiError(f"Atomation HTTP {response.status_code}: {body}")

        if body.get("code") != 200:
            raise AtomationApiError(f"Atomation API error: {body}")

        return body

    def get_sensor_readings(
        self,
        mac_addresses: list[str],
        start_date: datetime,
        end_date: datetime,
        page: int = 1,
        page_size: int = 1000,
        created_at: bool = False,
    ) -> dict[str, Any]:
        url = f"{self.base_url}/sensors_readings"

        payload = {
            "filters": {
                "start_date": self._format_datetime(start_date),
                "end_date": self._format_datetime(end_date),
                "mac": mac_addresses,
                "createdAt": created_at,
            },
            "limit": {
                "page": page,
                "page_size": page_size,
            },
        }

        body = self._post_with_auto_login(url, payload)

        return body["data"]