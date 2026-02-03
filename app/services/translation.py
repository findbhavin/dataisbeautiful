"""
Translation service for normalizing state identifiers to ISO-2 codes.
Handles FIPS codes, full state names, abbreviated names, and 'OTH' logic.
"""
import pandas as pd
from pathlib import Path
from typing import Optional, Dict

# Cache for state mapping data
_state_mapping: Optional[pd.DataFrame] = None


def _load_state_mapping() -> pd.DataFrame:
    """Load state FIPS to ISO-2 mapping data."""
    global _state_mapping
    if _state_mapping is None:
        mapping_path = Path(__file__).parent.parent.parent / "data" / "mappings" / "state_fips_to_iso.csv"
        _state_mapping = pd.read_csv(mapping_path)
        # Ensure FIPS codes are zero-padded strings
        _state_mapping['fips'] = _state_mapping['fips'].astype(str).str.zfill(2)
    return _state_mapping


def normalize_state_identifier(identifier: str) -> str:
    """
    Normalize a state identifier (FIPS, full name, or abbreviation) to ISO-2 code.
    
    Args:
        identifier: State identifier (e.g., '06', 'California', 'CA', 'N. Carolina')
        
    Returns:
        ISO-2 state code (e.g., 'CA', 'NC')
        Returns 'OTH' for unrecognized identifiers or aggregate rows
        
    Examples:
        normalize_state_identifier('06') -> 'CA'
        normalize_state_identifier('California') -> 'CA'
        normalize_state_identifier('CA') -> 'CA'
        normalize_state_identifier('N. Carolina') -> 'NC'
        normalize_state_identifier('Others (Avg)') -> 'OTH'
    """
    if not identifier or pd.isna(identifier):
        return 'OTH'
    
    identifier = str(identifier).strip()
    
    # Handle aggregate/other rows
    lower_id = identifier.lower()
    if any(keyword in lower_id for keyword in ['other', 'avg', 'aggregate', 'total']):
        return 'OTH'
    
    mapping = _load_state_mapping()
    
    # Try exact ISO-2 match first
    iso_match = mapping[mapping['iso2'].str.upper() == identifier.upper()]
    if not iso_match.empty:
        return iso_match.iloc[0]['iso2']
    
    # Try FIPS code match (zero-padded)
    if identifier.isdigit():
        fips_padded = identifier.zfill(2)
        fips_match = mapping[mapping['fips'] == fips_padded]
        if not fips_match.empty:
            return fips_match.iloc[0]['iso2']
    
    # Try full state name match (case-insensitive)
    name_match = mapping[mapping['name'].str.upper() == identifier.upper()]
    if not name_match.empty:
        return name_match.iloc[0]['iso2']
    
    # Handle abbreviated state names (e.g., "N. Carolina" -> "North Carolina")
    # Common abbreviations in the dataset
    abbreviation_map = {
        'N. Carolina': 'North Carolina',
        'S. Carolina': 'South Carolina',
        'N. Dakota': 'North Dakota',
        'S. Dakota': 'South Dakota',
        'W. Virginia': 'West Virginia',
        'N. Hampshire': 'New Hampshire',
        'N. Jersey': 'New Jersey',
        'N. Mexico': 'New Mexico',
        'N. York': 'New York',
    }
    
    for abbrev, full in abbreviation_map.items():
        if identifier == abbrev:
            name_match = mapping[mapping['name'] == full]
            if not name_match.empty:
                return name_match.iloc[0]['iso2']
    
    # If no match found, return OTH
    return 'OTH'


def get_state_name(iso2_code: str) -> Optional[str]:
    """
    Get full state name from ISO-2 code.
    
    Args:
        iso2_code: ISO-2 state code (e.g., 'CA')
        
    Returns:
        Full state name or None if not found
    """
    if iso2_code == 'OTH':
        return 'Other'
    
    mapping = _load_state_mapping()
    match = mapping[mapping['iso2'] == iso2_code.upper()]
    if not match.empty:
        return match.iloc[0]['name']
    return None
