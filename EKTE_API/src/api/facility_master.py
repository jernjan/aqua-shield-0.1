"""
Facility Master Data Manager
Maintains a persistent cache of facility data from BarentsWatch with coordinates,
risk status, and other attributes needed for vessel-facility categorization.
"""
import json
import os
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any


FACILITY_MASTER_FILE = os.path.join(os.path.dirname(__file__), 'data', 'facility_master.json')


def _ensure_file():
    """Ensure facility master file exists"""
    os.makedirs(os.path.dirname(FACILITY_MASTER_FILE), exist_ok=True)
    if not os.path.exists(FACILITY_MASTER_FILE):
        with open(FACILITY_MASTER_FILE, 'w') as f:
            json.dump({
                "timestamp": datetime.utcnow().isoformat(),
                "facilities": {},
                "summary": {"total": 0, "with_coordinates": 0}
            }, f, indent=2)


def save_facility_master(facilities: List[Dict[str, Any]]) -> None:
    """
    Save facility master data to JSON with coordinates and metadata.
    Called after fetching from BarentsWatch get_lice_data_v2().
    
    Args:
        facilities: List of facility objects from BW with geometry (GeoJSON)
    """
    _ensure_file()
    
    master_data = {}
    with_coords = 0
    
    for fac in facilities:
        # Extract from GeoJSON geometry
        locality = fac.get("locality", {})
        locality_no = locality.get("no")
        
        if not locality_no:
            continue
        
        # GeoJSON format: coordinates are [longitude, latitude]
        coordinates = fac.get("geometry", {}).get("coordinates", [])
        longitude = coordinates[0] if len(coordinates) > 0 else None
        latitude = coordinates[1] if len(coordinates) > 1 else None
        
        diseases = fac.get("diseases", [])
        
        fac_entry = {
            "facility_code": str(locality_no),
            "facility_name": locality.get("name", f"Facility {locality_no}"),
            "latitude": latitude,
            "longitude": longitude,
            "municipality": locality.get("municipalityCode"),
            "production_type": locality.get("type"),  # Laks, Ørret, etc
            "diseases": diseases,
            "has_disease": len(diseases) > 0,
            "updated_at": datetime.utcnow().isoformat()
        }
        
        master_data[str(locality_no)] = fac_entry
        if latitude and longitude:
            with_coords += 1
    
    # Write to file
    cache = {
        "timestamp": datetime.utcnow().isoformat(),
        "facilities": master_data,
        "summary": {
            "total": len(master_data),
            "with_coordinates": with_coords
        }
    }
    
    with open(FACILITY_MASTER_FILE, 'w') as f:
        json.dump(cache, f, indent=2)
    
    print(f"[FACILITY_MASTER] Saved {len(master_data)} facilities ({with_coords} with coordinates)")


def load_facility_master() -> Dict[str, Dict[str, Any]]:
    """
    Load facility master data from cache.
    Returns dict: {facility_code -> facility_data}
    """
    _ensure_file()
    
    try:
        with open(FACILITY_MASTER_FILE, 'r') as f:
            cache = json.load(f)
            return cache.get("facilities", {})
    except:
        return {}


def get_facility(facility_code: str) -> Optional[Dict[str, Any]]:
    """Get single facility data by code"""
    facilities = load_facility_master()
    return facilities.get(str(facility_code))


def get_facilities_with_coordinates() -> List[Dict[str, Any]]:
    """Get all facilities that have lat/lon coordinates"""
    facilities = load_facility_master()
    return [
        fac for fac in facilities.values()
        if fac.get('latitude') and fac.get('longitude')
    ]


def get_infected_facilities() -> List[Dict[str, Any]]:
    """Get facilities with disease status"""
    facilities = load_facility_master()
    return [
        fac for fac in facilities.values()
        if fac.get('has_disease') and fac.get('latitude') and fac.get('longitude')
    ]


def is_facility_infected(facility_code: str) -> bool:
    """Check if facility has disease status"""
    fac = get_facility(facility_code)
    return fac.get('has_disease', False) if fac else False


def get_cache_age_minutes() -> Optional[float]:
    """Get age of cached facility data in minutes. None if no cache."""
    if not os.path.exists(FACILITY_MASTER_FILE):
        return None
    
    try:
        with open(FACILITY_MASTER_FILE, 'r') as f:
            cache = json.load(f)
            timestamp_str = cache.get('timestamp')
            if timestamp_str:
                timestamp = datetime.fromisoformat(timestamp_str)
                age = datetime.utcnow() - timestamp
                return age.total_seconds() / 60
    except:
        pass
    
    return None


def is_cache_fresh(max_age_hours: int = 24) -> bool:
    """Check if facility cache is fresh enough"""
    age_minutes = get_cache_age_minutes()
    if age_minutes is None:
        return False
    return age_minutes <= (max_age_hours * 60)
