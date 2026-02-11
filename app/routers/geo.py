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
