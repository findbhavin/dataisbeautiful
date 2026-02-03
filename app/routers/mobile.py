"""
Router for mobile subscribers data API endpoints.
"""
from fastapi import APIRouter, HTTPException
from typing import Dict, Any
from app.services.data_loader import load_mobile_subscribers_data, get_state_detail

router = APIRouter(prefix="/api/mobile", tags=["mobile"])


@router.get("/data")
async def get_mobile_data() -> Dict[str, Any]:
    """
    Get all mobile subscribers data aggregated by state.
    
    Returns:
        JSON with total_subscribers, by_state array, and metrics_available
    """
    try:
        data = load_mobile_subscribers_data()
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading mobile data: {str(e)}")


@router.get("/state/{state_iso}")
async def get_state_data(state_iso: str) -> Dict[str, Any]:
    """
    Get mobile subscribers data for a specific state.
    
    Args:
        state_iso: ISO-2 state code (e.g., 'CA', 'TX')
        
    Returns:
        JSON with state details
    """
    try:
        state_data = get_state_detail(state_iso)
        if state_data is None:
            raise HTTPException(status_code=404, detail=f"State {state_iso} not found")
        return state_data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading state data: {str(e)}")
