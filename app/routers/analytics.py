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


@router.get("/city-coordinates")
async def get_city_coordinates() -> Dict[str, Any]:
    """City name to [lng, lat] for Hub Pair map."""
    try:
        return _load_json("city_coordinates.json")
    except HTTPException:
        return {}


@router.get("/india/city-coordinates")
async def get_india_city_coordinates() -> Dict[str, Any]:
    """India city name to [lng, lat] for Hub Pair map."""
    try:
        return _load_json("india/india_city_coordinates.json")
    except HTTPException:
        return {}


@router.get("/india/hub-pairs")
async def get_india_hub_pairs() -> Dict[str, Any]:
    """India hub pairs by type: dual, single, superCore."""
    try:
        return _load_json("india/india_hub_pairs.json")
    except HTTPException:
        return {"dual": {"label": "", "pairs": []}, "single": {"label": "", "pairs": []}, "superCore": {"label": "", "pairs": []}}


@router.get("/india/data-center-tiers")
async def get_india_data_center_tiers() -> Dict[str, Any]:
    """India data center tiers (Tier 1 Super Core, Tier 2 Regional, Tier 3 Edge)."""
    try:
        return _load_json("india/india_data_center_tiers.json")
    except HTTPException:
        return {"tier1": {"label": "", "states": []}, "tier2": {"label": "", "states": []}, "tier3": {"label": "", "states": []}}


@router.get("/india/analytics")
async def get_india_analytics() -> Dict[str, Any]:
    """India analytics: metros, spectrum, revenue, market share, top states."""
    try:
        return _load_json("india/analytics.json")
    except HTTPException:
        return {}


@router.get("/india/metros")
async def get_india_metros() -> Dict[str, Any]:
    """India top 10 metros by carrier (dummy data)."""
    try:
        data = _load_json("india/analytics.json")
        return {"top10_metros": data.get("top10_metros", []), "country": "India", "currency": "INR", "unit": "Cr"}
    except HTTPException:
        return {"top10_metros": [], "country": "India"}


@router.get("/india/spectrum")
async def get_india_spectrum() -> Dict[str, Any]:
    """India spectrum by state."""
    try:
        data = _load_json("india/analytics.json")
        return {"spectrum_by_state": data.get("spectrum_by_state", []), "country": "India"}
    except HTTPException:
        return {"spectrum_by_state": []}


@router.get("/india/revenue-by-state")
async def get_india_revenue_by_state() -> Dict[str, Any]:
    """India revenue by state (INR Cr). Returns all states from state_level_mobile for map/bar chart."""
    try:
        from app.services.india_data_loader import load_india_mobile_data
        data = load_india_mobile_data()
        by_state = data.get("by_state", [])
        rev = sorted(
            [{"state": d.get("state_name", ""), "revenue_inr_cr": d.get("revenue_inr_cr", 0)} for d in by_state if d.get("state_name")],
            key=lambda x: x["revenue_inr_cr"],
            reverse=True
        )
        revenue_top10 = [
            {"state": d["state"], "revenue_inr_cr": d["revenue_inr_cr"], "annual_revenue_b": d["revenue_inr_cr"] / 1000}
            for d in rev
        ]
        return {"revenue_top10": revenue_top10, "country": "India", "currency": "INR"}
    except Exception:
        try:
            data = _load_json("india/analytics.json")
            rev = data.get("revenue_by_state", [])
            revenue_top10 = [
                {"state": d["state"], "revenue_inr_cr": d.get("revenue_inr_cr", 0), "annual_revenue_b": d.get("revenue_inr_cr", 0) / 1000, "growth_pct": d.get("growth_pct", 0)}
                for d in rev[:15]
            ]
            return {"revenue_top10": revenue_top10, "country": "India", "currency": "INR"}
        except HTTPException:
            return {"revenue_top10": []}


@router.get("/india/market-wide")
async def get_india_market_wide() -> Dict[str, Any]:
    """India market-wide: market share, top states, national metrics."""
    try:
        data = _load_json("india/analytics.json")
        # Build top10_states from revenue_by_state for chart compatibility
        rev = data.get("revenue_by_state", [])
        top10 = [{"state": d["state"], "customers_m": d.get("revenue_inr_cr", 0) / 1000, "revenue_inr_cr": d.get("revenue_inr_cr", 0), "growth_pct": d.get("growth_pct")} for d in rev[:10]]
        return {
            "market_share": data.get("market_share", []),
            "top10_states": top10,
            "country": "India",
            "currency": "INR",
            "unit": "Cr"
        }
    except HTTPException:
        return {"market_share": [], "top10_states": []}


@router.get("/hub-pairs")
async def get_hub_pairs() -> Dict[str, Any]:
    """Hub pairs by type: dual (Regional & Edge), single (Single Edge), superCore (Super Core)."""
    try:
        return _load_json("hub_pairs.json")
    except HTTPException:
        return {"dual": {"label": "", "pairs": []}, "single": {"label": "", "pairs": []}, "superCore": {"label": "", "pairs": []}}


@router.get("/data-center-tiers")
async def get_data_center_tiers() -> Dict[str, Any]:
    """Data center tiers (Tier 1 Super Core, Tier 2 Regional, Tier 3 Edge) by state."""
    try:
        return _load_json("data_center_tiers.json")
    except HTTPException:
        return {"tier1": {"label": "Tier 1 - Super Core", "states": []}, "tier2": {"label": "Tier 2 - Regional", "states": []}, "tier3": {"label": "Tier 3 - Edge", "states": []}}


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
