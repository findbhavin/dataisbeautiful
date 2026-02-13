"""
Router for analytics and market-wide data API endpoints.
Serves JSON datasets for additional visualizations.
"""
from fastapi import APIRouter, HTTPException
from pathlib import Path
import json
from typing import Dict, Any

router = APIRouter(prefix="/api/analytics", tags=["analytics"])
DATA_DIR = Path(__file__).parent.parent.parent / "data"


def _load_json(filename: str) -> Dict[str, Any]:
    path = DATA_DIR / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Data file {filename} not found")
    with open(path, "r") as f:
        return json.load(f)


@router.get("/market-wide")
async def get_market_wide() -> Dict[str, Any]:
    """National metrics, market share, financial scorecard, top 10 states."""
    return _load_json("market_wide.json")


@router.get("/metros")
async def get_metros() -> Dict[str, Any]:
    """Top 10 US metropolitan areas by carrier."""
    return _load_json("metros.json")


@router.get("/spectrum")
async def get_spectrum() -> Dict[str, Any]:
    """Spectrum holdings by band and by market."""
    return _load_json("spectrum.json")


@router.get("/revenue-by-state")
async def get_revenue_by_state() -> Dict[str, Any]:
    """Estimated wireless revenue by state."""
    return _load_json("revenue_by_state.json")


@router.get("/datasets")
async def list_datasets() -> Dict[str, Any]:
    """List available datasets for table input / visualization."""
    return {
        "datasets": [
            {"id": "market-wide", "name": "National Metrics & Market Share", "endpoint": "/api/analytics/market-wide"},
            {"id": "metros", "name": "Top 10 Metro Areas", "endpoint": "/api/analytics/metros"},
            {"id": "spectrum", "name": "Spectrum Holdings", "endpoint": "/api/analytics/spectrum"},
            {"id": "revenue-by-state", "name": "Revenue by State", "endpoint": "/api/analytics/revenue-by-state"},
            {"id": "mobile", "name": "State Subscribers (Map)", "endpoint": "/api/mobile/data"}
        ]
    }
