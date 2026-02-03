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
    
    # Filter out OTH (aggregate) rows for totals and aggregation
    df_states = df[df['state_iso'] != 'OTH'].copy()
    
    # Calculate total subscribers across all states
    total_subscribers = int(df_states['Total_Mobile_T'].sum() * 1_000_000)  # Convert millions to actual count
    
    # Prepare state-level data
    by_state = []
    for _, row in df.iterrows():
        state_iso = row['state_iso']
        
        state_data = {
            'state_iso': state_iso,
            'state_name': get_state_name(state_iso) if state_iso != 'OTH' else 'Other',
            'total_subscribers': float(row['Total_Mobile_T']),
            'total_prepaid': float(row['Total_Pre']),
            'total_postpaid': float(row['Total_Post']),
            'verizon_total': float(row['Verizon_T']),
            'verizon_prepaid': float(row['Verizon_Pre']),
            'verizon_postpaid': float(row['Verizon_Post']),
            'tmobile_total': float(row['TMobile_T']),
            'tmobile_prepaid': float(row['TMobile_Pre']),
            'tmobile_postpaid': float(row['TMobile_Post']),
            'att_total': float(row['ATT_T']),
            'att_prepaid': float(row['ATT_Pre']),
            'att_postpaid': float(row['ATT_Post']),
            'others_total': float(row['Others_T']),
            'others_prepaid': float(row['Others_Pre']),
            'others_postpaid': float(row['Others_Post']),
        }
        by_state.append(state_data)
    
    # Available metrics
    metrics_available = [
        'total_subscribers',
        'total_prepaid',
        'total_postpaid',
        'verizon_total',
        'tmobile_total',
        'att_total',
        'others_total'
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
