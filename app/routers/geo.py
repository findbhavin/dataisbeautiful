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
    
    Returns:
        GeoJSON FeatureCollection with Indian states (NAME_1 property)
    """
    try:
        geojson_path = Path(__file__).parent.parent.parent / "data" / "india" / "indian_states.geojson"
        with open(geojson_path, 'r') as f:
            data = json.load(f)
        if not data.get('features'):
            raise ValueError("India GeoJSON has no features")
        return data
    except FileNotFoundError:
        raise HTTPException(
            status_code=404,
            detail={
                "error": "India states GeoJSON not found",
                "solution": "Run: python scripts/download_india_geojson.py"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading India GeoJSON: {str(e)}")


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
