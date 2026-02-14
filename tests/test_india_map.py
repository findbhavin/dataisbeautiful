"""
Test cases for India map GeoJSON - validates structure for proper D3 rendering.
Ensures coordinates, features, and properties are valid for map visualization.
Run with: pytest tests/test_india_map.py -v
Requires: pip install fastapi pytest (or project dependencies)
"""
import json
import pytest
from pathlib import Path

try:
    from fastapi.testclient import TestClient
    from app.main import app
    client = TestClient(app)
    HAS_FASTAPI = True
except ImportError:
    HAS_FASTAPI = False

# India bounds (approximate): lng 68-97, lat 8-37
INDIA_LNG_MIN, INDIA_LNG_MAX = 68, 97
INDIA_LAT_MIN, INDIA_LAT_MAX = 6, 38


def _get_india_geojson():
    """Fetch India GeoJSON from API."""
    if not HAS_FASTAPI:
        pytest.skip("FastAPI not installed - run: pip install fastapi")
    response = client.get("/api/geo/india/geojson/states")
    assert response.status_code == 200, f"API returned {response.status_code}"
    return response.json()


def _validate_coordinates(coords, depth=0):
    """Recursively validate GeoJSON coordinates are [lng, lat] in valid range."""
    if depth > 4:
        return
    if isinstance(coords, (int, float)):
        return
    if isinstance(coords[0], (int, float)):
        lng, lat = coords[0], coords[1]
        assert -180 <= lng <= 180, f"Longitude {lng} out of range"
        assert -90 <= lat <= 90, f"Latitude {lat} out of range"
        return
    for c in coords:
        _validate_coordinates(c, depth + 1)


def test_india_geojson_api_returns_feature_collection():
    """India GeoJSON API must return a valid FeatureCollection."""
    data = _get_india_geojson()
    assert data.get("type") == "FeatureCollection"
    assert "features" in data
    assert isinstance(data["features"], list)
    assert len(data["features"]) >= 28, "India should have at least 28 states/UTs"


def test_india_geojson_features_have_geometry():
    """Each feature must have valid geometry for path rendering."""
    data = _get_india_geojson()
    for i, f in enumerate(data["features"]):
        assert f.get("type") == "Feature", f"Feature {i} missing type"
        assert "geometry" in f, f"Feature {i} missing geometry"
        geom = f["geometry"]
        assert geom.get("type") in ("Polygon", "MultiPolygon"), f"Feature {i} invalid geometry type: {geom.get('type')}"
        assert "coordinates" in geom, f"Feature {i} missing coordinates"
        _validate_coordinates(geom["coordinates"])


def test_india_geojson_features_have_name_property():
    """Each feature must have NAME_1 or name for tooltip/label rendering."""
    data = _get_india_geojson()
    for i, f in enumerate(data["features"]):
        props = f.get("properties") or {}
        name = props.get("NAME_1") or props.get("name")
        assert name, f"Feature {i} missing NAME_1/name in properties"


def test_india_geojson_coordinates_in_india_bounds():
    """Feature coordinates should be within India's approximate bounds (allows POK)."""
    data = _get_india_geojson()
    all_lngs, all_lats = [], []

    def collect_coords(c, d=0):
        if d > 4:
            return
        if isinstance(c[0], (int, float)):
            all_lngs.append(c[0])
            all_lats.append(c[1])
        else:
            for x in c:
                collect_coords(x, d + 1)

    for f in data["features"]:
        geom = f.get("geometry", {})
        if "coordinates" in geom:
            collect_coords(geom["coordinates"])

    assert all_lngs and all_lats, "No coordinates found"
    # India + POK: lng roughly 68-77 (POK west) to 97, lat 8-37
    assert min(all_lngs) >= 65, f"Coordinates extend too far west: {min(all_lngs)}"
    assert max(all_lngs) <= 100, f"Coordinates extend too far east: {max(all_lngs)}"
    assert min(all_lats) >= 5, f"Coordinates extend too far south: {min(all_lats)}"
    assert max(all_lats) <= 40, f"Coordinates extend too far north: {max(all_lats)}"


def test_india_geojson_no_empty_geometries():
    """No feature should have empty coordinates array."""
    data = _get_india_geojson()
    for i, f in enumerate(data["features"]):
        geom = f.get("geometry", {})
        coords = geom.get("coordinates", [])
        assert coords, f"Feature {i} has empty coordinates"
        if geom.get("type") == "MultiPolygon":
            assert any(len(p[0]) > 2 for p in coords if p and p[0]), f"Feature {i} MultiPolygon has no ring with 3+ points"
        else:
            assert len(coords) > 2 if coords else False, f"Feature {i} Polygon has insufficient points"


def test_india_geojson_local_file_if_exists():
    """If local indian_states.geojson exists, it should be valid GeoJSON."""
    geojson_path = Path(__file__).parent.parent / "data" / "india" / "indian_states.geojson"
    if not geojson_path.exists():
        pytest.skip("Local indian_states.geojson not present")
    with open(geojson_path) as f:
        data = json.load(f)
    assert data.get("type") == "FeatureCollection"
    assert len(data.get("features", [])) >= 20
