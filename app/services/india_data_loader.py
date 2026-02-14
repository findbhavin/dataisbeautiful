"""
Data loader for India mobile subscribers (TRAI/GSMA style).
All values in Cr (Crores), currency INR.
"""
import json
from pathlib import Path
from typing import Dict, Any, Optional

INDIA_DATA_PATH = Path(__file__).parent.parent.parent / "data" / "india" / "state_level_mobile.json"


def load_india_mobile_data() -> Dict[str, Any]:
    """
    Load India mobile subscribers data from JSON.
    
    Returns:
        Dictionary with total_subscribers, by_state, metrics_available, currency, etc.
    """
    with open(INDIA_DATA_PATH, "r") as f:
        data = json.load(f)
    
    # Ensure total_subscribers is int for display
    total = data.get("total_subscribers", 0)
    if isinstance(total, float):
        data["total_subscribers"] = int(total)
    
    return data


def get_india_state_detail(state_iso: str) -> Optional[Dict[str, Any]]:
    """Get detailed data for a specific India state by ISO code."""
    data = load_india_mobile_data()
    for state in data.get("by_state", []):
        if state.get("state_iso", "").upper() == state_iso.upper():
            return state
    return None
