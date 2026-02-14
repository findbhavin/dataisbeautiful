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
    Tries local file first, falls back to CDN.
    Returns GeoJSON FeatureCollection with Indian states (NAME_1 property).
    """
    import urllib.request
    geojson_path = Path(__file__).parent.parent.parent / "data" / "india" / "indian_states.geojson"
    try:
        if geojson_path.exists():
            with open(geojson_path, 'r') as f:
                data = json.load(f)
        else:
            url = "https://raw.githubusercontent.com/Subhash9325/GeoJson-Data-of-Indian-States/master/Indian_States"
            with urllib.request.urlopen(url, timeout=10) as r:
                data = json.loads(r.read().decode())
        if data.get('features'):
            return data
    except Exception:
        pass
    try:
        url = "https://raw.githubusercontent.com/Subhash9325/GeoJson-Data-of-Indian-States/master/Indian_States"
        with urllib.request.urlopen(url, timeout=10) as r:
            data = json.loads(r.read().decode())
        if data.get('features'):
            return data
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"India GeoJSON unavailable: {str(e)}")
    raise HTTPException(status_code=404, detail="India GeoJSON not found. Run: py scripts/download_india_geojson.py")


@router.get("/india/option-b/geojson")
async def get_india_option_b_geojson() -> Dict[str, Any]:
    """
    Get India states GeoJSON from udit-001/india-maps-data (Option B).
    Fetches from CDN and aggregates district-level data to state-level.
    Uses st_nm for state name matching.
    """
    import urllib.request
    url = "https://cdn.jsdelivr.net/gh/udit-001/india-maps-data@ef25ebc/geojson/india.geojson"
    try:
        with urllib.request.urlopen(url, timeout=15) as r:
            data = json.loads(r.read().decode())
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"India Option B GeoJSON unavailable: {str(e)}")
    if not data.get("features"):
        raise HTTPException(status_code=502, detail="India Option B GeoJSON has no features")
    # Aggregate district features by state (st_nm)
    # Normalize state names to match our mobile data
    NAME_ALIASES = {
        "Andaman and Nicobar Islands": "Andaman and Nicobar",
    }
    from collections import defaultdict
    by_state = defaultdict(list)
    for f in data["features"]:
        props = f.get("properties") or {}
        st_nm = props.get("st_nm") or props.get("name") or ""
        if st_nm:
            st_nm = NAME_ALIASES.get(st_nm, st_nm)
            by_state[st_nm].append(f)
    # Merge geometries per state into MultiPolygon
    merged = []
    for st_nm, features in by_state.items():
        coords_list = []
        for f in features:
            geom = f.get("geometry")
            if not geom:
                continue
            gtype = geom.get("type", "")
            c = geom.get("coordinates", [])
            if gtype == "Polygon":
                coords_list.append(c)
            elif gtype == "MultiPolygon":
                coords_list.extend(c)
        if not coords_list:
            continue
        geom_type = "MultiPolygon" if len(coords_list) > 1 else "Polygon"
        geom_coords = coords_list if len(coords_list) > 1 else coords_list[0]
        merged.append({
            "type": "Feature",
            "properties": {"name": st_nm, "NAME_1": st_nm, "st_nm": st_nm},
            "geometry": {"type": geom_type, "coordinates": geom_coords}
        })
    # Gracefully amend with Ladakh from local file (Leh+Kargil) for correct rendering
    ladakh_path = Path(__file__).parent.parent.parent / "data" / "india" / "ladakh.geojson"
    if ladakh_path.exists():
        try:
            with open(ladakh_path, 'r') as f:
                ladakh_data = json.load(f)
            ladakh_features = ladakh_data.get("features") or []
            if ladakh_features:
                coords_list = []
                for f in ladakh_features:
                    geom = f.get("geometry")
                    if not geom:
                        continue
                    gtype = geom.get("type", "")
                    c = geom.get("coordinates", [])
                    if gtype == "Polygon":
                        coords_list.append(c)
                    elif gtype == "MultiPolygon":
                        coords_list.extend(c)
                if coords_list:
                    geom_type = "MultiPolygon" if len(coords_list) > 1 else "Polygon"
                    geom_coords = coords_list if len(coords_list) > 1 else coords_list[0]
                    ladakh_feature = {
                        "type": "Feature",
                        "properties": {"name": "Ladakh", "NAME_1": "Ladakh", "st_nm": "Ladakh"},
                        "geometry": {"type": geom_type, "coordinates": geom_coords}
                    }
                    merged = [m for m in merged if (m.get("properties") or {}).get("name") != "Ladakh"]
                    merged.append(ladakh_feature)
        except Exception:
            pass
    return {"type": "FeatureCollection", "features": merged}


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
