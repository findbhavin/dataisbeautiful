"""
Router for geographic data API endpoints.
Provides TopoJSON and GeoJSON conversion services.
"""
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pathlib import Path
import json
import urllib.request
from typing import Dict, Any

router = APIRouter(prefix="/api/geo", tags=["geo"])

# Highsoft in-all: includes full India boundaries (J&K, Ladakh region)
HIGHSOFT_INDIA_URL = "https://code.highcharts.com/mapdata/countries/in/in-all.geo.json"
# Datameet POK: Pakistan-occupied Kashmir / disputed northern region
POK_GEOJSON_URL = "https://raw.githubusercontent.com/datameet/maps/master/Country/disputed/pok-alhasan.geojson"
SUBHASH_INDIA_URL = "https://raw.githubusercontent.com/Subhash9325/GeoJson-Data-of-Indian-States/master/Indian_States"


def _normalize_india_feature(feature: Dict[str, Any]) -> None:
    """Ensure NAME_1 and name are set for map compatibility."""
    props = feature.get("properties") or {}
    name = props.get("NAME_1") or props.get("name") or ""
    if not name and "hc-key" in props:
        name = props.get("hc-key", "").replace("-", " ").title()
    if name:
        feature.setdefault("properties", {})["NAME_1"] = name
        feature["properties"]["name"] = name


def _merge_pok_into_india(data: Dict[str, Any]) -> Dict[str, Any]:
    """Add POK (Pakistan-occupied Kashmir) region to India GeoJSON. Fails gracefully."""
    try:
        with urllib.request.urlopen(POK_GEOJSON_URL, timeout=8) as r:
            pok = json.loads(r.read().decode())
        features = data.get("features") or []
        for f in (pok.get("features") or []):
            if not f.get("geometry"):
                continue
            props = dict(f.get("properties") or {})
            props["NAME_1"] = "POK"
            props["name"] = "POK"
            features.append({
                "type": "Feature",
                "properties": props,
                "geometry": f["geometry"]
            })
        return {"type": "FeatureCollection", "features": features}
    except Exception:
        return data


@router.get("/topojson/states")
async def get_states_topojson() -> Dict[str, Any]:
    """
    Get US states TopoJSON data with validation.
    
    Returns:
        TopoJSON object with US states
        
    Raises:
        HTTPException: If file not found, invalid, or is a placeholder
    """
    try:
        topojson_path = Path(__file__).parent.parent.parent / "data" / "topojson" / "us_states.topo.json"
        
        with open(topojson_path, 'r') as f:
            data = json.load(f)
        
        # Validate it's not a placeholder (check for arcs)
        if not data.get('arcs') or len(data.get('arcs', [])) == 0:
            raise ValueError("Placeholder TopoJSON detected - no arc data")
        
        return data
        
    except FileNotFoundError:
        # Return helpful error message
        raise HTTPException(
            status_code=404, 
            detail={
                "error": "States TopoJSON file not found",
                "solution": "Run ./scripts/download_dependencies.sh to download required map data"
            }
        )
    except ValueError as e:
        # Placeholder file detected
        raise HTTPException(
            status_code=404, 
            detail={
                "error": "States TopoJSON file is invalid or placeholder",
                "message": str(e),
                "solution": "Run ./scripts/download_dependencies.sh to download required map data"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading TopoJSON: {str(e)}")


@router.get("/topojson/counties")
async def get_counties_topojson() -> Dict[str, Any]:
    """
    Get US counties TopoJSON data.
    
    Returns:
        TopoJSON object with US counties
    """
    try:
        topojson_path = Path(__file__).parent.parent.parent / "data" / "topojson" / "us_counties.topo.json"
        with open(topojson_path, 'r') as f:
            data = json.load(f)
        return data
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Counties TopoJSON file not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading TopoJSON: {str(e)}")


@router.get("/topojson/india-states")
async def get_india_states_topojson() -> Dict[str, Any]:
    """
    Get India states TopoJSON data with validation.
    
    Returns:
        TopoJSON object with India states
        
    Raises:
        HTTPException: If file not found, invalid, or is a placeholder
    """
    try:
        topojson_path = Path(__file__).parent.parent.parent / "data" / "topojson" / "india_states.topo.json"
        
        with open(topojson_path, 'r') as f:
            data = json.load(f)
        
        # Validate it's not a placeholder (check for arcs)
        if not data.get('arcs') or len(data.get('arcs', [])) == 0:
            raise ValueError("Placeholder TopoJSON detected - no arc data")
        
        return data
        
    except FileNotFoundError:
        # Return helpful error message
        raise HTTPException(
            status_code=404, 
            detail={
                "error": "India states TopoJSON file not found",
                "solution": "Ensure data/topojson/india_states.topo.json exists"
            }
        )
    except ValueError as e:
        # Placeholder file detected
        raise HTTPException(
            status_code=404, 
            detail={
                "error": "India states TopoJSON file is invalid or placeholder",
                "message": str(e),
                "solution": "Ensure data/topojson/india_states.topo.json has valid geographic data"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading India TopoJSON: {str(e)}")


@router.get("/india/city-coordinates")
async def get_india_city_coordinates() -> Dict[str, Any]:
    """
    Get India city coordinates for all cities, districts, and talukas.
    
    Returns:
        Dictionary mapping city names to [longitude, latitude] coordinates
    """
    try:
        coords_path = Path(__file__).parent.parent.parent / "data" / "india" / "city_coordinates.json"
        with open(coords_path, 'r') as f:
            data = json.load(f)
        return data
    except FileNotFoundError:
        raise HTTPException(
            status_code=404,
            detail="India city coordinates file not found"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading India city coordinates: {str(e)}")


@router.get("/india/geojson/states")
async def get_india_states_geojson() -> Dict[str, Any]:
    """
    Get India states GeoJSON for map visualization.
    Tries local file first, then Highsoft (full boundaries), then Subhash9325.
    Merges POK (Pakistan-occupied Kashmir) region for complete northern boundary.
    Returns GeoJSON FeatureCollection with Indian states (NAME_1 property).
    """
    geojson_path = Path(__file__).parent.parent.parent / "data" / "india" / "indian_states.geojson"
    data = None

    # 1. Local file
    try:
        if geojson_path.exists():
            with open(geojson_path, 'r') as f:
                data = json.load(f)
    except Exception:
        pass

    # 2. Highsoft in-all (includes Ladakh region, full boundaries)
    if not data or not data.get('features'):
        try:
            with urllib.request.urlopen(HIGHSOFT_INDIA_URL, timeout=10) as r:
                data = json.loads(r.read().decode())
        except Exception:
            pass

    # 3. Subhash9325 fallback
    if not data or not data.get('features'):
        try:
            with urllib.request.urlopen(SUBHASH_INDIA_URL, timeout=10) as r:
                data = json.loads(r.read().decode())
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"India GeoJSON unavailable: {str(e)}")

    if not data or not data.get('features'):
        raise HTTPException(status_code=404, detail="India GeoJSON not found. Run: py scripts/download_india_geojson.py")

    # Normalize feature names (NAME_1 for map compatibility)
    for f in data.get('features', []):
        _normalize_india_feature(f)

    # Merge POK (northern disputed region) - fails gracefully if fetch fails
    data = _merge_pok_into_india(data)
    return data


@router.get("/geojson/states")
async def get_states_geojson() -> Dict[str, Any]:
    """
    Get US states as GeoJSON (converted from TopoJSON).
    
    Note: In a production environment, you would use a library like 'topojson'
    to properly convert TopoJSON to GeoJSON. For this MVP, we return a simplified
    GeoJSON structure that can be used with D3.js
    
    Returns:
        GeoJSON FeatureCollection with US states
    """
    try:
        # For MVP, we'll return a simplified GeoJSON structure
        # In production, use proper TopoJSON -> GeoJSON conversion
        topojson_data = await get_states_topojson()
        
        # Simple conversion (not a full implementation)
        geojson = {
            "type": "FeatureCollection",
            "features": []
        }
        
        if "objects" in topojson_data and "states" in topojson_data["objects"]:
            geometries = topojson_data["objects"]["states"].get("geometries", [])
            for geom in geometries:
                feature = {
                    "type": "Feature",
                    "id": geom.get("id"),
                    "properties": geom.get("properties", {}),
                    "geometry": {
                        "type": geom.get("type", "Polygon"),
                        "coordinates": []  # Simplified for MVP
                    }
                }
                geojson["features"].append(feature)
        
        return geojson
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error converting to GeoJSON: {str(e)}")
