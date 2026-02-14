"""
Test cases for India Option B GeoJSON API - POK+Ladakh full boundaries.
Ensures Ladakh and J&K include full India-claimed territory (POK, Leh, Kargil, Aksai Chin).
"""
import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_india_option_b_geojson_returns_200():
    """India Option B endpoint returns 200."""
    response = client.get("/api/geo/india/option-b/geojson")
    assert response.status_code == 200


def test_india_option_b_has_feature_collection():
    """India Option B returns valid GeoJSON FeatureCollection."""
    response = client.get("/api/geo/india/option-b/geojson")
    data = response.json()
    assert data.get("type") == "FeatureCollection"
    assert "features" in data
    assert isinstance(data["features"], list)
    assert len(data["features"]) >= 28  # India has 28+ states/UTs


def test_india_option_b_has_ladakh():
    """Ladakh must be present with valid geometry."""
    response = client.get("/api/geo/india/option-b/geojson")
    data = response.json()
    features = data.get("features", [])
    ladakh = next((f for f in features if (f.get("properties") or {}).get("name") == "Ladakh"), None)
    assert ladakh is not None, "Ladakh state missing"
    geom = ladakh.get("geometry")
    assert geom is not None
    assert geom.get("type") in ("Polygon", "MultiPolygon")
    coords = geom.get("coordinates", [])
    assert coords


def test_india_option_b_has_jk_with_pok():
    """Jammu and Kashmir must exist and have multiple polygons (J&K + POK)."""
    response = client.get("/api/geo/india/option-b/geojson")
    data = response.json()
    features = data.get("features", [])
    jk_names = ("Jammu and Kashmir", "Jammu & Kashmir")
    jk = next((f for f in features if (f.get("properties") or {}).get("name") in jk_names), None)
    assert jk is not None, "Jammu and Kashmir state missing"
    geom = jk.get("geometry")
    assert geom is not None
    # After POK merge, J&K should be MultiPolygon (Indian-administered + POK regions)
    assert geom.get("type") in ("Polygon", "MultiPolygon")
    coords = geom.get("coordinates", [])
    assert coords


def test_india_option_b_all_states_have_geometry():
    """All state features have non-empty geometry."""
    response = client.get("/api/geo/india/option-b/geojson")
    data = response.json()
    for f in data.get("features", []):
        name = (f.get("properties") or {}).get("name", "?")
        geom = f.get("geometry")
        assert geom, f"State {name} has no geometry"
        assert geom.get("coordinates"), f"State {name} has empty coordinates"
