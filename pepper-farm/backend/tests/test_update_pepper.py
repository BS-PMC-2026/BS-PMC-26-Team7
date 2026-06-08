"""
Unit tests for the Update Pepper API endpoint (PUT /api/peppers/{pepper_id}).

Test strategy:
- HTTP-level tests use FastAPI TestClient with a mocked DB session.
- Service-level tests use a MagicMock session (no real DB required).

Both layers follow Arrange / Act / Assert.
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from unittest.mock import MagicMock, patch, call
import pytest
from fastapi.testclient import TestClient

from types import SimpleNamespace

from main import app
from database import get_db
from utils.jwt import get_current_user
from schemas.pepper import PepperUpdate
from services.pepper_service import update_pepper


# ======================================================================
# Shared helpers
# ======================================================================

def _mock_pepper(
    pepper_id: int = 1,
    name: str = "Jalapeño",
    scientific_name: str = "Capsicum annuum",
    scoville_min: int = 2500,
    scoville_max: int = 8000,
    image_url: str | None = None,
    description: str = "A medium-hot chili pepper.",
    is_active: bool = True,
) -> SimpleNamespace:
    """
    Return a plain namespace that satisfies PepperResponse (from_attributes=True).
    Avoids SQLAlchemy instrumentation issues with __new__.
    """
    return SimpleNamespace(
        PepperId=pepper_id,
        PepperName=name,
        ScientificName=scientific_name,
        HeatLevelScovilleMin=scoville_min,
        HeatLevelScovilleMax=scoville_max,
        OptimalSoilMoistureMin=None,
        OptimalSoilMoistureMax=None,
        OptimalTempMinC=None,
        OptimalTempMaxC=None,
        OptimalPARMin=None,
        OptimalPARMax=None,
        ImageUrl=image_url,
        Zone=None,
        GeneralDescription=description,
        IsActive=is_active,
    )


# ======================================================================
# Fixture: TestClient with mocked DB
# ======================================================================

@pytest.fixture()
def client():
    """
    Override the get_db dependency so every test receives a MagicMock
    session — no real database required.
    """
    mock_db = MagicMock()

    def override_get_db():
        yield mock_db

    app.dependency_overrides[get_db] = override_get_db
    # BSPMT7-465: pepper writes now require FarmManager — authenticate as one.
    app.dependency_overrides[get_current_user] = lambda: {"user_id": 1, "role": "FarmManager"}
    with TestClient(app) as c:
        yield c, mock_db
    app.dependency_overrides.clear()


# ======================================================================
# Fixture: mock DB session (service-layer tests)
# ======================================================================

@pytest.fixture()
def mock_db():
    return MagicMock()


# ======================================================================
# Helpers
# ======================================================================

VALID_UPDATE_PAYLOAD = {
    "PepperName": "Updated Jalapeño",
    "HeatLevelScovilleMin": 3000,
    "HeatLevelScovilleMax": 9000,
    "GeneralDescription": "An updated description.",
}


# ======================================================================
# 1. Positive Tests — HTTP layer
# ======================================================================

class TestUpdatePepperSuccess:
    def test_update_pepper_with_all_fields(self, client):
        """Valid full payload → 200 + returned updated data."""
        test_client, mock_db = client
        pepper = _mock_pepper(
            name="Updated Jalapeño",
            scoville_min=3000,
            scoville_max=9000,
            image_url="/uploads/pepper_images/jal_new.jpg",
        )

        with patch("routers.peppers.update_pepper", return_value=pepper):
            payload = {
                **VALID_UPDATE_PAYLOAD,
                "ScientificName": "Capsicum annuum v2",
                "ImageUrl": "/uploads/pepper_images/jal_new.jpg",
                "Zone": "temperate",
                "OptimalSoilMoistureMin": 35.0,
                "OptimalSoilMoistureMax": 55.0,
                "OptimalTempMinC": 15.0,
                "OptimalTempMaxC": 28.0,
                "OptimalPARMin": 300.0,
                "OptimalPARMax": 900.0,
            }
            response = test_client.put("/api/peppers/1", json=payload)

        assert response.status_code == 200
        data = response.json()
        assert data["PepperName"] == "Updated Jalapeño"
        assert data["ImageUrl"] == "/uploads/pepper_images/jal_new.jpg"

    def test_update_pepper_partial_fields_only(self, client):
        """Only changed fields supplied → 200, other fields unchanged."""
        test_client, _ = client
        pepper = _mock_pepper(name="Ghost Pepper", scoville_min=1_000_000)

        with patch("routers.peppers.update_pepper", return_value=pepper):
            response = test_client.put("/api/peppers/1", json={"PepperName": "Ghost Pepper"})

        assert response.status_code == 200
        assert response.json()["PepperName"] == "Ghost Pepper"

    def test_update_pepper_deactivates_pepper(self, client):
        """Setting IsActive=False → 200, IsActive is false in response."""
        test_client, _ = client
        pepper = _mock_pepper(is_active=False)

        with patch("routers.peppers.update_pepper", return_value=pepper):
            response = test_client.put("/api/peppers/1", json={"IsActive": False})

        assert response.status_code == 200
        assert response.json()["IsActive"] is False

    def test_update_pepper_clears_image_url(self, client):
        """Setting ImageUrl to None removes image → 200."""
        test_client, _ = client
        pepper = _mock_pepper(image_url=None)

        with patch("routers.peppers.update_pepper", return_value=pepper):
            response = test_client.put("/api/peppers/1", json={"ImageUrl": None})

        assert response.status_code == 200
        assert response.json()["ImageUrl"] is None

    def test_update_pepper_returns_full_pepper_response(self, client):
        """Response includes all PepperResponse fields."""
        test_client, _ = client
        pepper = _mock_pepper()

        with patch("routers.peppers.update_pepper", return_value=pepper):
            response = test_client.put("/api/peppers/1", json=VALID_UPDATE_PAYLOAD)

        assert response.status_code == 200
        data = response.json()
        for key in ["PepperId", "PepperName", "IsActive"]:
            assert key in data


# ======================================================================
# 2. Not Found Tests — HTTP layer
# ======================================================================

class TestUpdatePepperNotFound:
    def test_update_nonexistent_pepper_returns_404(self, client):
        """update_pepper returns None (pepper not found) → 404."""
        test_client, _ = client

        with patch("routers.peppers.update_pepper", return_value=None):
            response = test_client.put("/api/peppers/99999", json=VALID_UPDATE_PAYLOAD)

        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    def test_update_nonexistent_pepper_detail_contains_id(self, client):
        """404 detail message includes the missing pepper id."""
        test_client, _ = client

        with patch("routers.peppers.update_pepper", return_value=None):
            response = test_client.put("/api/peppers/42", json=VALID_UPDATE_PAYLOAD)

        assert response.status_code == 404
        assert "42" in response.json()["detail"]


# ======================================================================
# 3. Validation Error Tests — HTTP layer (schema validation)
# ======================================================================

class TestUpdatePepperValidationErrors:
    def test_empty_pepper_name_returns_422(self, client):
        """PepperName = '' (fails min_length=1) → 422."""
        test_client, _ = client
        response = test_client.put("/api/peppers/1", json={"PepperName": ""})
        assert response.status_code == 422

    def test_whitespace_only_pepper_name_returns_422(self, client):
        """PepperName = '   ' stripped to '' → 422."""
        test_client, _ = client
        response = test_client.put("/api/peppers/1", json={"PepperName": "   "})
        assert response.status_code == 422

    def test_negative_scoville_min_returns_422(self, client):
        """HeatLevelScovilleMin < 0 → 422."""
        test_client, _ = client
        response = test_client.put("/api/peppers/1", json={"HeatLevelScovilleMin": -1})
        assert response.status_code == 422

    def test_negative_scoville_max_returns_422(self, client):
        """HeatLevelScovilleMax < 0 → 422."""
        test_client, _ = client
        response = test_client.put("/api/peppers/1", json={"HeatLevelScovilleMax": -500})
        assert response.status_code == 422

    def test_invalid_image_url_scheme_returns_422(self, client):
        """ImageUrl with unsupported scheme → 422."""
        test_client, _ = client
        response = test_client.put("/api/peppers/1", json={"ImageUrl": "ftp://bad.host/img.jpg"})
        assert response.status_code == 422

    def test_soil_moisture_above_100_returns_422(self, client):
        """OptimalSoilMoistureMax > 100 → 422."""
        test_client, _ = client
        response = test_client.put("/api/peppers/1", json={"OptimalSoilMoistureMax": 101.0})
        assert response.status_code == 422

    def test_temperature_above_80_returns_422(self, client):
        """OptimalTempMaxC > 80 → 422."""
        test_client, _ = client
        response = test_client.put("/api/peppers/1", json={"OptimalTempMaxC": 81.0})
        assert response.status_code == 422

    def test_par_above_2000_returns_422(self, client):
        """OptimalPARMin > 2000 → 422."""
        test_client, _ = client
        response = test_client.put("/api/peppers/1", json={"OptimalPARMin": 2001.0})
        assert response.status_code == 422

    def test_pepper_name_exceeds_max_length_returns_422(self, client):
        """PepperName > 100 chars → 422."""
        test_client, _ = client
        response = test_client.put("/api/peppers/1", json={"PepperName": "A" * 101})
        assert response.status_code == 422

    def test_description_exceeds_max_length_returns_422(self, client):
        """GeneralDescription > 1000 chars → 422."""
        test_client, _ = client
        response = test_client.put("/api/peppers/1", json={"GeneralDescription": "D" * 1001})
        assert response.status_code == 422


# ======================================================================
# 4. Conflict / Server-Error Tests — HTTP layer
# ======================================================================

class TestUpdatePepperErrorHandling:
    def test_duplicate_pepper_name_returns_409(self, client):
        """IntegrityError with 'duplicate key' in message → 409 Conflict."""
        from sqlalchemy.exc import IntegrityError

        test_client, _ = client
        orig = MagicMock()
        orig.__str__ = lambda self: "duplicate key value"

        with patch(
            "routers.peppers.update_pepper",
            side_effect=IntegrityError(statement=None, params=None, orig=orig),
        ):
            response = test_client.put("/api/peppers/1", json=VALID_UPDATE_PAYLOAD)

        assert response.status_code == 409
        assert "already exists" in response.json()["detail"]

    def test_db_operational_error_returns_503(self, client):
        """OperationalError (e.g. connection timeout) → 503."""
        from sqlalchemy.exc import OperationalError

        test_client, _ = client
        with patch(
            "routers.peppers.update_pepper",
            side_effect=OperationalError(statement=None, params=None, orig=Exception("timeout")),
        ):
            response = test_client.put("/api/peppers/1", json=VALID_UPDATE_PAYLOAD)

        assert response.status_code == 503

    def test_unexpected_exception_returns_500(self, client):
        """Unhandled Exception → 500 Internal Server Error."""
        test_client, _ = client
        with patch("routers.peppers.update_pepper", side_effect=RuntimeError("boom")):
            response = test_client.put("/api/peppers/1", json=VALID_UPDATE_PAYLOAD)

        assert response.status_code == 500


# ======================================================================
# 5. Edge Cases — HTTP layer
# ======================================================================

class TestUpdatePepperEdgeCases:
    def test_empty_body_is_valid_noop(self, client):
        """Empty payload (no fields) is valid — no fields to update → 200."""
        test_client, _ = client
        pepper = _mock_pepper()
        with patch("routers.peppers.update_pepper", return_value=pepper):
            response = test_client.put("/api/peppers/1", json={})
        assert response.status_code == 200

    def test_update_with_long_valid_description(self, client):
        """GeneralDescription at max_length=1000 → 200."""
        test_client, _ = client
        pepper = _mock_pepper(description="D" * 1000)
        with patch("routers.peppers.update_pepper", return_value=pepper):
            response = test_client.put(
                "/api/peppers/1", json={"GeneralDescription": "D" * 1000}
            )
        assert response.status_code == 200

    def test_update_with_max_length_name(self, client):
        """PepperName exactly at max_length=100 → 200."""
        test_client, _ = client
        name_100 = "B" * 100
        pepper = _mock_pepper(name=name_100)
        with patch("routers.peppers.update_pepper", return_value=pepper):
            response = test_client.put("/api/peppers/1", json={"PepperName": name_100})
        assert response.status_code == 200

    def test_update_with_https_image_url(self, client):
        """ImageUrl with https:// scheme → 200."""
        test_client, _ = client
        pepper = _mock_pepper(image_url="https://cdn.example.com/img.jpg")
        with patch("routers.peppers.update_pepper", return_value=pepper):
            response = test_client.put(
                "/api/peppers/1", json={"ImageUrl": "https://cdn.example.com/img.jpg"}
            )
        assert response.status_code == 200

    def test_update_with_zero_scoville(self, client):
        """HeatLevelScovilleMin = 0 (sweet pepper boundary) → 200."""
        test_client, _ = client
        pepper = _mock_pepper(scoville_min=0, scoville_max=0)
        with patch("routers.peppers.update_pepper", return_value=pepper):
            response = test_client.put(
                "/api/peppers/1",
                json={"HeatLevelScovilleMin": 0, "HeatLevelScovilleMax": 0},
            )
        assert response.status_code == 200


# ======================================================================
# 6. Service-layer tests (mocked DB session)
# ======================================================================

class TestUpdatePepperService:
    def test_service_returns_none_when_pepper_not_found(self, mock_db):
        """update_pepper() returns None when pepper_id does not exist."""
        mock_db.query.return_value.filter.return_value.first.return_value = None

        result = update_pepper(mock_db, pepper_id=99999, data=PepperUpdate(PepperName="X"))

        assert result is None

    def test_service_applies_field_updates(self, mock_db):
        """update_pepper() calls setattr on the pepper for each provided field."""
        existing = MagicMock()
        existing.PepperId = 1
        mock_db.query.return_value.filter.return_value.first.return_value = existing

        data = PepperUpdate(PepperName="New Name", HeatLevelScovilleMin=5000)
        update_pepper(mock_db, pepper_id=1, data=data)

        assert existing.PepperName == "New Name"
        assert existing.HeatLevelScovilleMin == 5000

    def test_service_does_not_overwrite_unset_fields(self, mock_db):
        """Fields NOT in the payload are not touched."""
        existing = MagicMock()
        existing.PepperId = 1
        existing.GeneralDescription = "Original description"
        mock_db.query.return_value.filter.return_value.first.return_value = existing

        data = PepperUpdate(PepperName="Only Name Changed")
        update_pepper(mock_db, pepper_id=1, data=data)

        # GeneralDescription was not in payload, so it should not be overwritten
        assert existing.GeneralDescription == "Original description"

    def test_service_commits_and_refreshes(self, mock_db):
        """update_pepper() calls db.commit() and db.refresh() after update."""
        existing = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = existing

        update_pepper(mock_db, pepper_id=1, data=PepperUpdate(PepperName="X"))

        mock_db.commit.assert_called_once()
        mock_db.refresh.assert_called_once_with(existing)

    def test_service_creates_audit_log_entry(self, mock_db):
        """update_pepper() adds a PepperEditLog entry for each change."""
        existing = MagicMock()
        existing.PepperId = 1
        mock_db.query.return_value.filter.return_value.first.return_value = existing

        update_pepper(mock_db, pepper_id=1, data=PepperUpdate(PepperName="X", Zone="tropical"))

        # db.add should be called for the audit log entry
        assert mock_db.add.call_count == 1
        log_entry = mock_db.add.call_args[0][0]
        from models.pepper_edit_log import PepperEditLog
        assert isinstance(log_entry, PepperEditLog)
        assert log_entry.PepperId == 1
        assert "PepperName" in log_entry.ChangedFields
        assert "Zone" in log_entry.ChangedFields

    def test_service_skips_audit_log_for_empty_update(self, mock_db):
        """No audit log entry is created when no fields are changed."""
        existing = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = existing

        update_pepper(mock_db, pepper_id=1, data=PepperUpdate())

        # No fields in payload → db.add should NOT be called
        mock_db.add.assert_not_called()

    def test_service_returns_refreshed_pepper(self, mock_db):
        """update_pepper() returns the same object passed to db.refresh()."""
        existing = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = existing

        result = update_pepper(mock_db, pepper_id=1, data=PepperUpdate(PepperName="X"))

        assert result is existing
        mock_db.refresh.assert_called_once_with(existing)

    def test_service_does_not_commit_on_not_found(self, mock_db):
        """update_pepper() does not commit when pepper is not found."""
        mock_db.query.return_value.filter.return_value.first.return_value = None

        update_pepper(mock_db, pepper_id=999, data=PepperUpdate(PepperName="X"))

        mock_db.commit.assert_not_called()


# ======================================================================
# 7. Schema / Pydantic validation (unit — no HTTP, no DB)
# ======================================================================

class TestPepperUpdateSchema:
    def test_schema_empty_payload_is_valid(self):
        """PepperUpdate with no fields is valid (no required fields)."""
        p = PepperUpdate()
        assert p.model_dump(exclude_unset=True) == {}

    def test_schema_strips_whitespace_from_name(self):
        """Leading/trailing whitespace in PepperName is stripped."""
        p = PepperUpdate(PepperName="  Cayenne  ")
        assert p.PepperName == "Cayenne"

    def test_schema_rejects_blank_name_after_strip(self):
        """PepperName of only spaces raises ValueError."""
        with pytest.raises(ValueError):
            PepperUpdate(PepperName="   ")

    def test_schema_rejects_negative_scoville(self):
        """Negative Scoville values raise ValueError."""
        with pytest.raises(ValueError):
            PepperUpdate(HeatLevelScovilleMin=-1)

    def test_schema_rejects_invalid_image_url(self):
        """ImageUrl with unsupported scheme raises ValueError."""
        with pytest.raises(ValueError):
            PepperUpdate(ImageUrl="ftp://bad.host/img.jpg")

    def test_schema_accepts_valid_image_url_variants(self):
        """All three valid URL prefixes are accepted without error."""
        for url in [
            "http://example.com/img.jpg",
            "https://example.com/img.jpg",
            "/uploads/pepper_images/img.jpg",
        ]:
            p = PepperUpdate(ImageUrl=url)
            assert p.ImageUrl == url

    def test_schema_none_pepper_name_allowed(self):
        """PepperName=None is valid (field is optional in update)."""
        p = PepperUpdate(PepperName=None)
        assert p.PepperName is None

    def test_schema_none_image_url_is_allowed(self):
        """ImageUrl=None is accepted (clear image)."""
        p = PepperUpdate(ImageUrl=None)
        assert p.ImageUrl is None

    def test_schema_exclude_unset_only_reports_provided_fields(self):
        """model_dump(exclude_unset=True) only returns fields actually set."""
        p = PepperUpdate(PepperName="X", Zone="tropical")
        dumped = p.model_dump(exclude_unset=True)
        assert set(dumped.keys()) == {"PepperName", "Zone"}

    def test_schema_strips_and_nullifies_blank_scientific_name(self):
        """ScientificName of only spaces becomes None."""
        p = PepperUpdate(ScientificName="   ")
        assert p.ScientificName is None

    def test_schema_temperature_boundary_minus_50_valid(self):
        """OptimalTempMinC = -50 is valid (lower boundary)."""
        p = PepperUpdate(OptimalTempMinC=-50.0)
        assert p.OptimalTempMinC == -50.0

    def test_schema_temperature_above_80_rejected(self):
        """OptimalTempMaxC > 80 raises ValueError."""
        with pytest.raises(ValueError):
            PepperUpdate(OptimalTempMaxC=81.0)
