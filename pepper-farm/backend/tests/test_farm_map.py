"""
Unit tests for the Farm Map feature — GET /api/zones/{zone_code}.

Test strategy:
- HTTP-level tests use FastAPI TestClient with a mocked DB session.
- No real database required — all DB calls are mocked via MagicMock.

Covers:
1. Positive: zone found with pepper assigned
2. Positive: zone found without pepper (PepperId is None)
3. Negative: zone code not found → 404
4. Positive: zone with all optional fields populated
5. Positive: zone with Description field returned
6. Edge: zone code is case-sensitive
7. Edge: AreaSquareMeters is None → returned as None (not error)
8. Edge: pepper exists but has no ScientificName / Scoville values
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from unittest.mock import MagicMock, patch
from types import SimpleNamespace
import pytest
from fastapi.testclient import TestClient

from main import app
from database import get_db


# ======================================================================
# Helpers
# ======================================================================

def _mock_zone(
    zone_id: int = 1,
    zone_code: str = "GH-01",
    zone_name: str = "חממת גידול 1",
    pepper_id: int | None = 10,
    area=400.0,
    description: str | None = "Main growing greenhouse.",
    soil_type: str | None = "Loam",
    irrigation: str | None = "Drip",
    notes: str | None = None,
    zone_type: str | None = "GROWING_GREENHOUSE",
) -> SimpleNamespace:
    return SimpleNamespace(
        ZoneId=zone_id,
        ZoneCode=zone_code,
        ZoneName=zone_name,
        ZoneType=zone_type,
        PepperId=pepper_id,
        AreaSquareMeters=area,
        Description=description,
        SoilType=soil_type,
        IrrigationMethod=irrigation,
        Notes=notes,
        IsActive=True,
    )


def _mock_pepper(
    pepper_id: int = 10,
    name: str = "Jalapeño",
    scientific_name: str | None = "Capsicum annuum",
    scoville_min: int | None = 2500,
    scoville_max: int | None = 8000,
    description: str | None = "A medium-hot chili.",
    image_url: str | None = "/uploads/pepper_images/jal.jpg",
) -> SimpleNamespace:
    return SimpleNamespace(
        PepperId=pepper_id,
        PepperName=name,
        ScientificName=scientific_name,
        HeatLevelScovilleMin=scoville_min,
        HeatLevelScovilleMax=scoville_max,
        GeneralDescription=description,
        ImageUrl=image_url,
    )


# ======================================================================
# Fixture: TestClient with mocked DB
# ======================================================================

@pytest.fixture()
def client():
    mock_db = MagicMock()

    def override_get_db():
        yield mock_db

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c, mock_db
    app.dependency_overrides.clear()


# ======================================================================
# 1. Positive Tests
# ======================================================================

class TestGetZoneSuccess:
    def test_zone_with_pepper_returns_200_and_full_data(self, client):
        """Zone found with a pepper assigned → 200 with all fields."""
        test_client, mock_db = client
        zone = _mock_zone()
        pepper = _mock_pepper()

        query_mock = MagicMock()
        mock_db.query.return_value = query_mock
        query_mock.filter.return_value.first.side_effect = [zone, pepper]

        response = test_client.get("/api/zones/GH-01")

        assert response.status_code == 200
        data = response.json()
        assert data["ZoneCode"] == "GH-01"
        assert data["ZoneName"] == "חממת גידול 1"
        assert data["pepper"] is not None
        assert data["pepper"]["PepperName"] == "Jalapeño"
        assert data["pepper"]["HeatLevelScovilleMin"] == 2500
        assert data["pepper"]["HeatLevelScovilleMax"] == 8000

    def test_zone_without_pepper_returns_200_pepper_null(self, client):
        """Zone found but PepperId is None → pepper field is null."""
        test_client, mock_db = client
        zone = _mock_zone(pepper_id=None)

        query_mock = MagicMock()
        mock_db.query.return_value = query_mock
        query_mock.filter.return_value.first.return_value = zone

        response = test_client.get("/api/zones/GH-01")

        assert response.status_code == 200
        assert response.json()["pepper"] is None

    def test_zone_description_returned(self, client):
        """Description field is included in the response."""
        test_client, mock_db = client
        zone = _mock_zone(description="Main growing greenhouse equipped with climate control.")
        pepper = _mock_pepper()

        query_mock = MagicMock()
        mock_db.query.return_value = query_mock
        query_mock.filter.return_value.first.side_effect = [zone, pepper]

        response = test_client.get("/api/zones/GH-01")

        assert response.status_code == 200
        assert response.json()["Description"] == "Main growing greenhouse equipped with climate control."

    def test_zone_area_returned_as_float(self, client):
        """AreaSquareMeters is returned as a float."""
        test_client, mock_db = client
        zone = _mock_zone(area=400.0)
        pepper = _mock_pepper()

        query_mock = MagicMock()
        mock_db.query.return_value = query_mock
        query_mock.filter.return_value.first.side_effect = [zone, pepper]

        response = test_client.get("/api/zones/GH-01")

        assert response.json()["AreaSquareMeters"] == 400.0

    def test_zone_area_none_returned_as_null(self, client):
        """AreaSquareMeters=None → returned as null, no error."""
        test_client, mock_db = client
        zone = _mock_zone(area=None, pepper_id=None)

        query_mock = MagicMock()
        mock_db.query.return_value = query_mock
        query_mock.filter.return_value.first.return_value = zone

        response = test_client.get("/api/zones/GH-01")

        assert response.status_code == 200
        assert response.json()["AreaSquareMeters"] is None

    def test_zone_description_none_returned_as_null(self, client):
        """Description=None → returned as null."""
        test_client, mock_db = client
        zone = _mock_zone(description=None, pepper_id=None)

        query_mock = MagicMock()
        mock_db.query.return_value = query_mock
        query_mock.filter.return_value.first.return_value = zone

        response = test_client.get("/api/zones/GH-01")

        assert response.json()["Description"] is None


# ======================================================================
# 2. Negative Tests
# ======================================================================

class TestGetZoneNotFound:
    def test_unknown_zone_code_returns_404(self, client):
        """Zone code not in DB → 404 with detail message."""
        test_client, mock_db = client

        query_mock = MagicMock()
        mock_db.query.return_value = query_mock
        query_mock.filter.return_value.first.return_value = None

        response = test_client.get("/api/zones/UNKNOWN")

        assert response.status_code == 404
        assert "UNKNOWN" in response.json()["detail"]

    def test_wrong_case_zone_code_returns_404(self, client):
        """Zone codes are case-sensitive; 'gh-01' ≠ 'GH-01' → 404."""
        test_client, mock_db = client

        query_mock = MagicMock()
        mock_db.query.return_value = query_mock
        query_mock.filter.return_value.first.return_value = None

        response = test_client.get("/api/zones/gh-01")

        assert response.status_code == 404


# ======================================================================
# 3. Pepper data edge cases
# ======================================================================

class TestGetZonePepperDetails:
    def test_pepper_without_scientific_name(self, client):
        """Pepper with ScientificName=None → field is null in response."""
        test_client, mock_db = client
        zone = _mock_zone()
        pepper = _mock_pepper(scientific_name=None)

        query_mock = MagicMock()
        mock_db.query.return_value = query_mock
        query_mock.filter.return_value.first.side_effect = [zone, pepper]

        response = test_client.get("/api/zones/GH-01")

        assert response.json()["pepper"]["ScientificName"] is None

    def test_pepper_without_scoville_values(self, client):
        """Pepper with no Scoville data → both fields null."""
        test_client, mock_db = client
        zone = _mock_zone()
        pepper = _mock_pepper(scoville_min=None, scoville_max=None)

        query_mock = MagicMock()
        mock_db.query.return_value = query_mock
        query_mock.filter.return_value.first.side_effect = [zone, pepper]

        response = test_client.get("/api/zones/GH-01")

        data = response.json()["pepper"]
        assert data["HeatLevelScovilleMin"] is None
        assert data["HeatLevelScovilleMax"] is None

    def test_pepper_without_description(self, client):
        """Pepper with GeneralDescription=None → field is null."""
        test_client, mock_db = client
        zone = _mock_zone()
        pepper = _mock_pepper(description=None)

        query_mock = MagicMock()
        mock_db.query.return_value = query_mock
        query_mock.filter.return_value.first.side_effect = [zone, pepper]

        response = test_client.get("/api/zones/GH-01")

        assert response.json()["pepper"]["GeneralDescription"] is None

    def test_pepper_without_image(self, client):
        """Pepper with ImageUrl=None → field is null."""
        test_client, mock_db = client
        zone = _mock_zone()
        pepper = _mock_pepper(image_url=None)

        query_mock = MagicMock()
        mock_db.query.return_value = query_mock
        query_mock.filter.return_value.first.side_effect = [zone, pepper]

        response = test_client.get("/api/zones/GH-01")

        assert response.json()["pepper"]["ImageUrl"] is None

    def test_pepper_id_matches_zone_pepper_id(self, client):
        """Returned pepper PepperId matches the zone's PepperId."""
        test_client, mock_db = client
        zone = _mock_zone(pepper_id=42)
        pepper = _mock_pepper(pepper_id=42)

        query_mock = MagicMock()
        mock_db.query.return_value = query_mock
        query_mock.filter.return_value.first.side_effect = [zone, pepper]

        response = test_client.get("/api/zones/GH-01")

        assert response.json()["pepper"]["PepperId"] == 42


# ======================================================================
# 4. All greenhouse zone codes are routable
# ======================================================================

class TestAllGreenhouseZones:
    @pytest.mark.parametrize("zone_code", [
        "GH-01", "GH-02", "GH-03", "GH-04", "GH-05",
        "GH-06", "GH-07", "GH-08", "GH-09", "GH-10",
    ])
    def test_each_greenhouse_zone_returns_200(self, client, zone_code):
        """Each of the 10 greenhouse zone codes returns 200 when found."""
        test_client, mock_db = client
        zone = _mock_zone(zone_code=zone_code, pepper_id=None)

        query_mock = MagicMock()
        mock_db.query.return_value = query_mock
        query_mock.filter.return_value.first.return_value = zone

        response = test_client.get(f"/api/zones/{zone_code}")

        assert response.status_code == 200
        assert response.json()["ZoneCode"] == zone_code

    @pytest.mark.parametrize("zone_code", [
        "NURSERY", "SHED-MAIN", "GERM-01", "GERM-02",
        "GERM-03", "GERM-04", "VIS-CENTER", "FACTORY",
    ])
    def test_non_greenhouse_zones_return_200(self, client, zone_code):
        """Non-greenhouse zones (nursery, shed, etc.) also return 200 when found."""
        test_client, mock_db = client
        zone = _mock_zone(zone_code=zone_code, pepper_id=None)

        query_mock = MagicMock()
        mock_db.query.return_value = query_mock
        query_mock.filter.return_value.first.return_value = zone

        response = test_client.get(f"/api/zones/{zone_code}")

        assert response.status_code == 200
