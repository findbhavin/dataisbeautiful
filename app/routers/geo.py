"""
Router for geographic data API endpoints.
Provides TopoJSON and GeoJSON conversion services.
"""
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pathlib import Path
import json
from typing import Dict, Any

router = APIRouter(prefix="/api/geo", tags=["geo"])
# Primary: Highsoft in-all includes Ladakh (post-2019). POK merged from datameet.
INDIA_GEOJSON_PRIMARY_URL = "https://code.highcharts.com/mapdata/countries/in/in-all.geo.json"
# Fallback: Subhash9325 (may lack Ladakh). udit-001 has district-level with Ladakh, J&K.
INDIA_GEOJSON_FALLBACK_URL = "https://raw.githubusercontent.com/Subhash9325/GeoJson-Data-of-Indian-States/master/Indian_States"
INDIA_GEOJSON_UDIT001_URL = "https://raw.githubusercontent.com/udit-001/india-maps-data/main/geojson/india.geojson"


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


def _normalize_india_feature_names(data: dict) -> dict:
    """
    Normalize state/UT names to a consistent schema used by frontend/data lookups.
    Handles both state-level (NAME_1/name) and district-level (st_nm) sources e.g. udit-001.
    """
    alias_map = {
        "Andaman and Nicobar Islands": "Andaman and Nicobar",
        "Dadra & Nagar Haveli and Daman & Diu": "Dadra and Nagar Haveli and Daman and Diu",
    }
    for feature in data.get("features", []):
        props = feature.setdefault("properties", {})
        raw_name = props.get("NAME_1") or props.get("name") or props.get("st_nm")
        if not raw_name:
            continue
        canonical = alias_map.get(raw_name, raw_name)
        props["NAME_1"] = canonical
        props["name"] = canonical
    return data


def _convert_udit001_district_to_state(data: dict) -> dict:
    """
    Convert udit-001 district-level GeoJSON to state-level schema.
    Uses st_nm as NAME_1 so frontend can match. Districts render as separate polygons.
    """
    for feature in data.get("features", []):
        props = feature.setdefault("properties", {})
        st_nm = props.get("st_nm")
        if st_nm:
            props["NAME_1"] = st_nm
            props["name"] = st_nm
    return _normalize_india_feature_names(data)


def _merge_pok_into_india(data: dict) -> dict:
    """Merge POK (Pakistan-occupied Kashmir) polygons into India GeoJSON."""
    has_pok = any(
        "POK" in str(f.get("properties", {}).get("NAME_1", "")) or
        "Pakistan-occupied" in str(f.get("properties", {}).get("NAME_1", "")) or
        "POK" in str(f.get("properties", {}).get("name", "")) or
        "Pakistan-occupied" in str(f.get("properties", {}).get("name", ""))
        for f in data.get("features", [])
    )
    if has_pok:
        return data
    import urllib.request
    try:
        pok_url = "https://raw.githubusercontent.com/datameet/maps/master/Country/disputed/pok-alhasan.geojson"
        with urllib.request.urlopen(pok_url, timeout=10) as r:
            pok = json.loads(r.read().decode())
        for f in pok.get("features", []):
            if f.get("geometry"):
                props = f.get("properties", {})
                prov = props.get("PROVINCE", "POK")
                dist = props.get("DISTRICT", "")
                name = f"POK - {prov}" + (f" ({dist})" if dist else "")
                data.setdefault("features", []).append({
                    "type": "Feature",
                    "properties": {
                        "ID_0": 105, "ISO": "IND", "NAME_0": "India",
                        "NAME_1": name, "TYPE_1": "Disputed",
                        "ENGTYPE_1": "Disputed Territory"
                    },
                    "geometry": f["geometry"]
                })
    except Exception:
        pass
    return data


@router.get("/india/geojson/states")
async def get_india_states_geojson() -> Dict[str, Any]:
    """
    Get India states GeoJSON for map visualization (includes POK).
    Tries local file first, falls back to CDN. Merges POK when using CDN.
    Returns GeoJSON FeatureCollection with Indian states (NAME_1 property).
    """
    import urllib.request
    geojson_path = Path(__file__).parent.parent.parent / "data" / "india" / "indian_states.geojson"

    # 1) Local file first (preferred for reproducibility/offline use)
    try:
        if geojson_path.exists():
            with open(geojson_path, 'r') as f:
                data = json.load(f)
            data = _normalize_india_feature_names(data)
            data = _merge_pok_into_india(data)
            if data.get('features'):
                return data
    except Exception:
        pass

    # 2) CDN fallbacks: Highsoft (Ladakh), Subhash9325, udit-001 (district-level, has Ladakh+J&K)
    last_error = None
    sources = [
        (INDIA_GEOJSON_PRIMARY_URL, lambda d: _normalize_india_feature_names(d)),
        (INDIA_GEOJSON_FALLBACK_URL, lambda d: _normalize_india_feature_names(d)),
        (INDIA_GEOJSON_UDIT001_URL, _convert_udit001_district_to_state),
    ]
    for url, normalize_fn in sources:
        try:
            with urllib.request.urlopen(url, timeout=15) as r:
                data = json.loads(r.read().decode())
            data = normalize_fn(data)
            data = _merge_pok_into_india(data)
            if data.get('features'):
                return data
        except Exception as e:
            last_error = e
            continue

    if last_error:
        raise HTTPException(status_code=502, detail=f"India GeoJSON unavailable: {str(last_error)}")
    raise HTTPException(status_code=404, detail="India GeoJSON not found. Run: py scripts/download_india_geojson_with_pok.py")


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
