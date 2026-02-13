"""
Data loader service for loading and normalizing CSV data.
"""
import pandas as pd
from pathlib import Path
from typing import Dict, Any, List
from .translation import normalize_state_identifier, get_state_name


def load_mobile_subscribers_data() -> Dict[str, Any]:
    """
    Load and normalize mobile subscribers data from CSV.
    
    Returns:
        Dictionary containing:
        - total_subscribers: int (sum across all states, excluding OTH)
        - by_state: list of state data with aggregated metrics
        - metrics_available: list of available metric names
    """
    # Load the CSV file
    csv_path = Path(__file__).parent.parent.parent / "data" / "mobile_subscribers.csv"
    df = pd.read_csv(csv_path)
    
    # Normalize state identifier to ISO-2 code
    df['state_iso'] = df['State'].apply(normalize_state_identifier)
    
    # Total = all rows including Others (aggregate of remaining 19 states)
    total_subscribers = int(df['Total Mobile (T)'].sum() * 1_000_000)
    
    # Prepare state-level data
    by_state = []
    for _, row in df.iterrows():
        state_iso = row['state_iso']
        
        state_data = {
            'state_iso': state_iso,
            'state_name': get_state_name(state_iso) or state_iso,
            'latitude': float(row['Latitude']),
            'longitude': float(row['Longitude']),
            'total_subscribers': float(row['Total Mobile (T)']),
            'total_prepaid': float(row['Total (Pre)']),
            'total_postpaid': float(row['Total (Post)']),
            'verizon_total': float(row['Verizon (T)']),
            'verizon_prepaid': float(row['Verizon (Pre)']),
            'verizon_postpaid': float(row['Verizon (Post)']),
            'tmobile_total': float(row['T-Mobile (T)']),
            'tmobile_prepaid': float(row['T-Mobile (Pre)']),
            'tmobile_postpaid': float(row['T-Mobile (Post)']),
            'att_total': float(row['AT&T (T)']),
            'att_prepaid': float(row['AT&T (Pre)']),
            'att_postpaid': float(row['AT&T (Post)']),
            'others_total': float(row['Others (T)']),
            'others_prepaid': float(row['Others (Pre)']),
            'others_postpaid': float(row['Others (Post)']),
        }
        by_state.append(state_data)
    
    # Available metrics - now includes all 15 metrics
    metrics_available = [
        'total_subscribers',
        'total_prepaid',
        'total_postpaid',
        'verizon_total',
        'verizon_prepaid',
        'verizon_postpaid',
        'tmobile_total',
        'tmobile_prepaid',
        'tmobile_postpaid',
        'att_total',
        'att_prepaid',
        'att_postpaid',
        'others_total',
        'others_prepaid',
        'others_postpaid'
    ]
    
    return {
        'total_subscribers': total_subscribers,
        'by_state': by_state,
        'metrics_available': metrics_available
    }


def get_state_detail(state_iso: str) -> Dict[str, Any]:
    """
    Get detailed data for a specific state.
    
    Args:
        state_iso: ISO-2 state code
        
    Returns:
        Dictionary with state details or None if not found
    """
    data = load_mobile_subscribers_data()
    
    for state in data['by_state']:
        if state['state_iso'] == state_iso.upper():
            return state
    
    return None
