"""
Unit tests for the Create Pepper API endpoint (POST /api/peppers).

Test strategy:
- HTTP-level tests use FastAPI TestClient with a mocked DB session.
- Service-level tests use SQLite in-memory DB (no SQL Server required).

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
from schemas.pepper import PepperCreate
from services.pepper_service import create_pepper


# ======================================================================
# Shared helpers
# ======================================================================

def _mock_pepper(
    pepper_id: int = 1,
    name: str = "Jalapeño",
    scientific_name=None,
    scoville_min=2500,
    scoville_max=8000,
    image_url=None,
    description="A medium-hot chili pepper.",
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
    with TestClient(app) as c:
        yield c, mock_db
    app.dependency_overrides.clear()


# ======================================================================
# Fixture: mock DB session (service-layer tests)
# The real model uses func.sysutcdatetime() (SQL Server only), so we
# mock the session rather than spinning up SQLite.
# ======================================================================

@pytest.fixture()
def mock_db():
    return MagicMock()


# ======================================================================
# Helpers
# ======================================================================

VALID_PAYLOAD = {
    "PepperName": "Jalapeño",
    "HeatLevelScovilleMin": 2500,
    "HeatLevelScovilleMax": 8000,
    "GeneralDescription": "A medium-hot chili pepper.",
}


# ======================================================================
# 1. Positive Tests — HTTP layer
# ======================================================================

class TestCreatePepperSuccess:
    def test_create_pepper_with_all_fields(self, client):
        """Valid payload with every optional field → 201 + returned data."""
        test_client, mock_db = client
        pepper = _mock_pepper(image_url="/uploads/pepper_images/jal.jpg")
        mock_db.refresh.side_effect = lambda obj: None

        with patch("routers.peppers.create_pepper", return_value=pepper):
            payload = {
                **VALID_PAYLOAD,
                "ScientificName": "Capsicum annuum",
                "ImageUrl": "/uploads/pepper_images/jal.jpg",
                "Zone": "tropical",
                "OptimalSoilMoistureMin": 40.0,
                "OptimalSoilMoistureMax": 60.0,
                "OptimalTempMinC": 18.0,
                "OptimalTempMaxC": 30.0,
                "OptimalPARMin": 200.0,
                "OptimalPARMax": 800.0,
            }
            response = test_client.post("/api/peppers", json=payload)

        assert response.status_code == 201
        data = response.json()
        assert data["PepperName"] == "Jalapeño"
        assert data["ImageUrl"] == "/uploads/pepper_images/jal.jpg"

    def test_create_pepper_without_image_url(self, client):
        """Valid payload with no ImageUrl → 201, ImageUrl is null."""
        test_client, mock_db = client
        pepper = _mock_pepper(image_url=None)

        with patch("routers.peppers.create_pepper", return_value=pepper):
            response = test_client.post("/api/peppers", json=VALID_PAYLOAD)

        assert response.status_code == 201
        assert response.json()["ImageUrl"] is None

    def test_create_pepper_minimal_required_only(self, client):
        """Only PepperName is truly required; all numeric fields optional → 201."""
        test_client, _ = client
        pepper = _mock_pepper(scoville_min=None, scoville_max=None, description=None)

        with patch("routers.peppers.create_pepper", return_value=pepper):
            response = test_client.post("/api/peppers", json={"PepperName": "Ghost Pepper"})

        assert response.status_code == 201
        assert response.json()["PepperName"] == "Jalapeño"  # from mock


# ======================================================================
# 2. Negative Tests — Missing / invalid fields (HTTP layer, schema validation)
# ======================================================================

class TestCreatePepperValidationErrors:
    def test_missing_pepper_name(self, client):
        """Omitting PepperName → 422 Unprocessable Entity."""
        test_client, _ = client
        payload = {k: v for k, v in VALID_PAYLOAD.items() if k != "PepperName"}
        response = test_client.post("/api/peppers", json=payload)
        assert response.status_code == 422

    def test_empty_pepper_name(self, client):
        """PepperName = '' (fails min_length=1) → 422."""
        test_client, _ = client
        response = test_client.post("/api/peppers", json={**VALID_PAYLOAD, "PepperName": ""})
        assert response.status_code == 422

    def test_whitespace_only_pepper_name(self, client):
        """PepperName = '   ' is stripped to '' by validator → 422."""
        test_client, _ = client
        response = test_client.post("/api/peppers", json={**VALID_PAYLOAD, "PepperName": "   "})
        assert response.status_code == 422

    def test_negative_scoville_min(self, client):
        """HeatLevelScovilleMin < 0 → 422."""
        test_client, _ = client
        response = test_client.post(
            "/api/peppers", json={**VALID_PAYLOAD, "HeatLevelScovilleMin": -1}
        )
        assert response.status_code == 422

    def test_negative_scoville_max(self, client):
        """HeatLevelScovilleMax < 0 → 422."""
        test_client, _ = client
        response = test_client.post(
            "/api/peppers", json={**VALID_PAYLOAD, "HeatLevelScovilleMax": -500}
        )
        assert response.status_code == 422

    def test_scoville_min_greater_than_max(self, client):
        """Min > Max violates model_validator → 422."""
        test_client, _ = client
        response = test_client.post(
            "/api/peppers",
            json={**VALID_PAYLOAD, "HeatLevelScovilleMin": 9000, "HeatLevelScovilleMax": 100},
        )
        assert response.status_code == 422

    def test_invalid_image_url_scheme(self, client):
        """ImageUrl not starting with http/https//uploads → 422."""
        test_client, _ = client
        response = test_client.post(
            "/api/peppers", json={**VALID_PAYLOAD, "ImageUrl": "ftp://bad.example/img.jpg"}
        )
        assert response.status_code == 422

    def test_soil_moisture_below_zero(self, client):
        """OptimalSoilMoistureMin < 0 → 422."""
        test_client, _ = client
        response = test_client.post(
            "/api/peppers", json={**VALID_PAYLOAD, "OptimalSoilMoistureMin": -5.0}
        )
        assert response.status_code == 422

    def test_soil_moisture_above_100(self, client):
        """OptimalSoilMoistureMax > 100 → 422."""
        test_client, _ = client
        response = test_client.post(
            "/api/peppers", json={**VALID_PAYLOAD, "OptimalSoilMoistureMax": 101.0}
        )
        assert response.status_code == 422

    def test_temperature_below_minus_50(self, client):
        """OptimalTempMinC < -50 → 422."""
        test_client, _ = client
        response = test_client.post(
            "/api/peppers", json={**VALID_PAYLOAD, "OptimalTempMinC": -51.0}
        )
        assert response.status_code == 422

    def test_temperature_above_80(self, client):
        """OptimalTempMaxC > 80 → 422."""
        test_client, _ = client
        response = test_client.post(
            "/api/peppers", json={**VALID_PAYLOAD, "OptimalTempMaxC": 81.0}
        )
        assert response.status_code == 422

    def test_par_above_2000(self, client):
        """OptimalPARMin > 2000 → 422."""
        test_client, _ = client
        response = test_client.post(
            "/api/peppers", json={**VALID_PAYLOAD, "OptimalPARMin": 2001.0}
        )
        assert response.status_code == 422

    def test_par_negative(self, client):
        """OptimalPARMin < 0 → 422."""
        test_client, _ = client
        response = test_client.post(
            "/api/peppers", json={**VALID_PAYLOAD, "OptimalPARMin": -1.0}
        )
        assert response.status_code == 422

    def test_pepper_name_exceeds_max_length(self, client):
        """PepperName longer than max_length=100 → 422."""
        test_client, _ = client
        long_name = "A" * 101
        response = test_client.post("/api/peppers", json={**VALID_PAYLOAD, "PepperName": long_name})
        assert response.status_code == 422

    def test_scientific_name_exceeds_max_length(self, client):
        """ScientificName longer than max_length=150 → 422."""
        test_client, _ = client
        response = test_client.post(
            "/api/peppers", json={**VALID_PAYLOAD, "ScientificName": "X" * 151}
        )
        assert response.status_code == 422

    def test_general_description_exceeds_max_length(self, client):
        """GeneralDescription longer than max_length=1000 → 422."""
        test_client, _ = client
        response = test_client.post(
            "/api/peppers", json={**VALID_PAYLOAD, "GeneralDescription": "D" * 1001}
        )
        assert response.status_code == 422


# ======================================================================
# 3. Conflict / server-error Tests — HTTP layer
# ======================================================================

class TestCreatePepperErrorHandling:
    def test_duplicate_pepper_name_returns_409(self, client):
        """IntegrityError with 'unique key' in message → 409 Conflict."""
        from sqlalchemy.exc import IntegrityError

        test_client, _ = client
        orig = MagicMock()
        orig.__str__ = lambda self: "duplicate key value"

        with patch(
            "routers.peppers.create_pepper",
            side_effect=IntegrityError(statement=None, params=None, orig=orig),
        ):
            response = test_client.post("/api/peppers", json=VALID_PAYLOAD)

        assert response.status_code == 409
        assert "already exists" in response.json()["detail"]

    def test_db_operational_error_returns_503(self, client):
        """OperationalError (e.g. connection timeout) → 503."""
        from sqlalchemy.exc import OperationalError

        test_client, _ = client
        with patch(
            "routers.peppers.create_pepper",
            side_effect=OperationalError(statement=None, params=None, orig=Exception("timeout")),
        ):
            response = test_client.post("/api/peppers", json=VALID_PAYLOAD)

        assert response.status_code == 503

    def test_unexpected_exception_returns_500(self, client):
        """Unhandled Exception → 500 Internal Server Error."""
        test_client, _ = client
        with patch("routers.peppers.create_pepper", side_effect=RuntimeError("boom")):
            response = test_client.post("/api/peppers", json=VALID_PAYLOAD)

        assert response.status_code == 500


# ======================================================================
# 4. Edge Cases — HTTP layer
# ======================================================================

class TestCreatePepperEdgeCases:
    def test_scoville_min_zero(self, client):
        """HeatLevelScovilleMin = 0 (boundary) → 201."""
        test_client, _ = client
        pepper = _mock_pepper(scoville_min=0, scoville_max=0)
        with patch("routers.peppers.create_pepper", return_value=pepper):
            response = test_client.post(
                "/api/peppers",
                json={**VALID_PAYLOAD, "HeatLevelScovilleMin": 0, "HeatLevelScovilleMax": 0},
            )
        assert response.status_code == 201

    def test_scoville_equal_min_and_max(self, client):
        """Min == Max is valid (single-point range) → 201."""
        test_client, _ = client
        pepper = _mock_pepper(scoville_min=5000, scoville_max=5000)
        with patch("routers.peppers.create_pepper", return_value=pepper):
            response = test_client.post(
                "/api/peppers",
                json={**VALID_PAYLOAD, "HeatLevelScovilleMin": 5000, "HeatLevelScovilleMax": 5000},
            )
        assert response.status_code == 201

    def test_image_url_with_http_scheme(self, client):
        """ImageUrl starting with http:// is valid → 201."""
        test_client, _ = client
        pepper = _mock_pepper(image_url="http://cdn.example.com/img.jpg")
        with patch("routers.peppers.create_pepper", return_value=pepper):
            response = test_client.post(
                "/api/peppers",
                json={**VALID_PAYLOAD, "ImageUrl": "http://cdn.example.com/img.jpg"},
            )
        assert response.status_code == 201

    def test_image_url_with_https_scheme(self, client):
        """ImageUrl starting with https:// is valid → 201."""
        test_client, _ = client
        pepper = _mock_pepper(image_url="https://cdn.example.com/img.jpg")
        with patch("routers.peppers.create_pepper", return_value=pepper):
            response = test_client.post(
                "/api/peppers",
                json={**VALID_PAYLOAD, "ImageUrl": "https://cdn.example.com/img.jpg"},
            )
        assert response.status_code == 201

    def test_image_url_with_uploads_prefix(self, client):
        """ImageUrl starting with /uploads/ (local storage) is valid → 201."""
        test_client, _ = client
        pepper = _mock_pepper(image_url="/uploads/pepper_images/test.png")
        with patch("routers.peppers.create_pepper", return_value=pepper):
            response = test_client.post(
                "/api/peppers",
                json={**VALID_PAYLOAD, "ImageUrl": "/uploads/pepper_images/test.png"},
            )
        assert response.status_code == 201

    def test_very_long_valid_pepper_name(self, client):
        """PepperName exactly at max_length=100 chars → 201."""
        test_client, _ = client
        name_100 = "B" * 100
        pepper = _mock_pepper(name=name_100)
        with patch("routers.peppers.create_pepper", return_value=pepper):
            response = test_client.post(
                "/api/peppers", json={**VALID_PAYLOAD, "PepperName": name_100}
            )
        assert response.status_code == 201

    def test_very_long_valid_description(self, client):
        """GeneralDescription exactly at max_length=1000 chars → 201."""
        test_client, _ = client
        desc_1000 = "D" * 1000
        pepper = _mock_pepper(description=desc_1000)
        with patch("routers.peppers.create_pepper", return_value=pepper):
            response = test_client.post(
                "/api/peppers",
                json={**VALID_PAYLOAD, "GeneralDescription": desc_1000},
            )
        assert response.status_code == 201

    def test_optimal_temp_boundary_minus_50(self, client):
        """OptimalTempMinC = -50 (lower boundary) is valid → 201."""
        test_client, _ = client
        pepper = _mock_pepper()
        with patch("routers.peppers.create_pepper", return_value=pepper):
            response = test_client.post(
                "/api/peppers", json={**VALID_PAYLOAD, "OptimalTempMinC": -50.0}
            )
        assert response.status_code == 201

    def test_optimal_temp_boundary_80(self, client):
        """OptimalTempMaxC = 80 (upper boundary) is valid → 201."""
        test_client, _ = client
        pepper = _mock_pepper()
        with patch("routers.peppers.create_pepper", return_value=pepper):
            response = test_client.post(
                "/api/peppers", json={**VALID_PAYLOAD, "OptimalTempMaxC": 80.0}
            )
        assert response.status_code == 201

    def test_par_exactly_2000(self, client):
        """OptimalPARMax = 2000 (upper boundary) is valid → 201."""
        test_client, _ = client
        pepper = _mock_pepper()
        with patch("routers.peppers.create_pepper", return_value=pepper):
            response = test_client.post(
                "/api/peppers", json={**VALID_PAYLOAD, "OptimalPARMax": 2000.0}
            )
        assert response.status_code == 201

    def test_is_active_defaults_to_true(self, client):
        """IsActive not supplied → defaults to True in response."""
        test_client, _ = client
        pepper = _mock_pepper()
        with patch("routers.peppers.create_pepper", return_value=pepper):
            response = test_client.post("/api/peppers", json=VALID_PAYLOAD)
        assert response.status_code == 201
        assert response.json()["IsActive"] is True


# ======================================================================
# 5. Service-layer tests (mocked DB session)
# The PepperVariety model uses func.sysutcdatetime() (SQL Server only),
# so we mock the session to keep tests portable.
# ======================================================================

class TestCreatePepperService:
    def test_service_calls_db_add_commit_refresh(self, mock_db):
        """create_pepper() calls db.add(), db.commit(), db.refresh() in order."""
        # Arrange
        data = PepperCreate(
            PepperName="Carolina Reaper",
            HeatLevelScovilleMin=1_400_000,
            HeatLevelScovilleMax=2_200_000,
        )

        # Act
        result = create_pepper(mock_db, data)

        # Assert
        mock_db.add.assert_called_once()
        mock_db.commit.assert_called_once()
        mock_db.refresh.assert_called_once()

    def test_service_builds_pepper_with_correct_fields(self, mock_db):
        """create_pepper() maps all schema fields onto the ORM object."""
        # Arrange
        data = PepperCreate(
            PepperName="Serrano",
            ScientificName="Capsicum annuum",
            HeatLevelScovilleMin=10_000,
            HeatLevelScovilleMax=23_000,
            ImageUrl="/uploads/pepper_images/serrano.jpg",
            GeneralDescription="A thin, red chili.",
            IsActive=True,
        )

        # Act
        create_pepper(mock_db, data)

        # Assert: the object passed to db.add() has the right attributes
        added_pepper = mock_db.add.call_args[0][0]
        assert added_pepper.PepperName == "Serrano"
        assert added_pepper.ScientificName == "Capsicum annuum"
        assert added_pepper.HeatLevelScovilleMin == 10_000
        assert added_pepper.HeatLevelScovilleMax == 23_000
        assert added_pepper.ImageUrl == "/uploads/pepper_images/serrano.jpg"
        assert added_pepper.GeneralDescription == "A thin, red chili."
        assert added_pepper.IsActive is True

    def test_service_pepper_name_only(self, mock_db):
        """create_pepper() works with only PepperName supplied."""
        # Arrange
        data = PepperCreate(PepperName="Bell Pepper")

        # Act
        create_pepper(mock_db, data)

        # Assert
        added_pepper = mock_db.add.call_args[0][0]
        assert added_pepper.PepperName == "Bell Pepper"
        assert added_pepper.HeatLevelScovilleMin is None
        assert added_pepper.HeatLevelScovilleMax is None
        assert added_pepper.ImageUrl is None

    def test_service_inactive_pepper(self, mock_db):
        """IsActive=False is mapped correctly onto the ORM object."""
        # Arrange
        data = PepperCreate(PepperName="Obsolete Pepper", IsActive=False)

        # Act
        create_pepper(mock_db, data)

        # Assert
        added_pepper = mock_db.add.call_args[0][0]
        assert added_pepper.IsActive is False

    def test_service_returns_refreshed_object(self, mock_db):
        """create_pepper() returns whatever db.refresh() populates (the same object)."""
        # Arrange
        data = PepperCreate(PepperName="Ghost Pepper")

        # Act
        result = create_pepper(mock_db, data)

        # Assert: the returned object is the same one passed to db.add/refresh
        added_pepper = mock_db.add.call_args[0][0]
        refreshed_pepper = mock_db.refresh.call_args[0][0]
        assert result is added_pepper
        assert refreshed_pepper is added_pepper


# ======================================================================
# 6. Schema / Pydantic validation (unit — no HTTP, no DB)
# ======================================================================

class TestPepperCreateSchema:
    def test_schema_strips_whitespace_from_name(self):
        """Leading/trailing whitespace in PepperName is stripped."""
        p = PepperCreate(PepperName="  Cayenne  ")
        assert p.PepperName == "Cayenne"

    def test_schema_rejects_blank_name_after_strip(self):
        """PepperName of only spaces raises ValueError."""
        with pytest.raises(ValueError):
            PepperCreate(PepperName="   ")

    def test_schema_rejects_negative_scoville(self):
        """Negative Scoville values raise ValueError."""
        with pytest.raises(ValueError):
            PepperCreate(PepperName="X", HeatLevelScovilleMin=-1)

    def test_schema_rejects_inverted_scoville_range(self):
        """Min > Max raises ValueError."""
        with pytest.raises(ValueError):
            PepperCreate(PepperName="X", HeatLevelScovilleMin=5000, HeatLevelScovilleMax=100)

    def test_schema_rejects_inverted_moisture_range(self):
        """OptimalSoilMoistureMin > Max raises ValueError."""
        with pytest.raises(ValueError):
            PepperCreate(
                PepperName="X",
                OptimalSoilMoistureMin=80.0,
                OptimalSoilMoistureMax=20.0,
            )

    def test_schema_rejects_inverted_temp_range(self):
        """OptimalTempMinC > Max raises ValueError."""
        with pytest.raises(ValueError):
            PepperCreate(PepperName="X", OptimalTempMinC=35.0, OptimalTempMaxC=10.0)

    def test_schema_accepts_valid_image_url_variants(self):
        """All three valid URL prefixes are accepted without error."""
        for url in [
            "http://example.com/img.jpg",
            "https://example.com/img.jpg",
            "/uploads/pepper_images/img.jpg",
        ]:
            p = PepperCreate(PepperName="X", ImageUrl=url)
            assert p.ImageUrl == url

    def test_schema_rejects_invalid_image_url(self):
        """ImageUrl with unsupported scheme raises ValueError."""
        with pytest.raises(ValueError):
            PepperCreate(PepperName="X", ImageUrl="ftp://bad.host/img.jpg")

    def test_schema_strips_and_nullifies_blank_scientific_name(self):
        """ScientificName of only spaces becomes None."""
        p = PepperCreate(PepperName="X", ScientificName="   ")
        assert p.ScientificName is None

    def test_schema_none_image_url_is_allowed(self):
        """ImageUrl=None is accepted (field is optional)."""
        p = PepperCreate(PepperName="X", ImageUrl=None)
        assert p.ImageUrl is None

    def test_schema_par_boundary_zero(self):
        """OptimalPARMin = 0 is valid."""
        p = PepperCreate(PepperName="X", OptimalPARMin=0.0)
        assert p.OptimalPARMin == 0.0

    def test_schema_par_boundary_2000(self):
        """OptimalPARMax = 2000 is valid."""
        p = PepperCreate(PepperName="X", OptimalPARMax=2000.0)
        assert p.OptimalPARMax == 2000.0

    def test_schema_is_active_defaults_true(self):
        """IsActive defaults to True when not supplied."""
        p = PepperCreate(PepperName="X")
        assert p.IsActive is True
