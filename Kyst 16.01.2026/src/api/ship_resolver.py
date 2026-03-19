"""Ship name resolver - fetches missing ship names from external sources."""

import requests
from typing import Optional
import time
from src.api.ship_cache import get_ship_name, cache_ship_name


def resolve_ship_name(mmsi: str) -> Optional[str]:
    """
    Try to resolve ship name from external sources.
    
    Tries multiple free APIs and caches the result.
    Returns None if ship name cannot be found.
    """
    # First check cache
    cached = get_ship_name(mmsi)
    if cached:
        return cached
    
    # Try ShipFinder API (free tier available)
    name = _try_shipfinder_api(mmsi)
    if name:
        cache_ship_name(mmsi, name)
        return name
    
    # Try Vessel Finder API
    name = _try_vesselfinder_api(mmsi)
    if name:
        cache_ship_name(mmsi, name)
        return name
    
    # Try MarineTraffic (limited free tier)
    name = _try_marinetraffic_api(mmsi)
    if name:
        cache_ship_name(mmsi, name)
        return name
    
    return None


def _try_shipfinder_api(mmsi: str) -> Optional[str]:
    """Try ShipFinder API for ship data."""
    try:
        url = f"https://shipfinder.com/api/v1/vessel/{mmsi}"
        response = requests.get(url, timeout=3)
        
        if response.status_code == 200:
            data = response.json()
            if data.get("name"):
                return data["name"]
    except:
        pass
    
    return None


def _try_vesselfinder_api(mmsi: str) -> Optional[str]:
    """Try VesselFinder API for ship data."""
    try:
        url = f"https://www.vesselfinder.com/api/pub/vessels"
        params = {"mmsi": mmsi}
        response = requests.get(url, params=params, timeout=3)
        
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, list) and len(data) > 0:
                vessel = data[0]
                if vessel.get("shipname"):
                    return vessel["shipname"]
    except:
        pass
    
    return None


def _try_marinetraffic_api(mmsi: str) -> Optional[str]:
    """Try MarineTraffic API for ship data (limited free tier)."""
    try:
        # Note: MarineTraffic requires API key for detailed data
        # This is a basic fallback attempt
        url = f"https://www.marinetraffic.com/api/vessels/json/"
        params = {"mmsi": mmsi}
        response = requests.get(url, params=params, timeout=3)
        
        if response.status_code == 200:
            data = response.json()
            if data.get("vessels"):
                vessel = data["vessels"][0]
                if vessel.get("SHIPNAME"):
                    return vessel["SHIPNAME"]
    except:
        pass
    
    return None


def enrich_vessel_names_batch(vessels_list: list) -> dict:
    """
    Enrich a list of vessels with ship names using cache and external APIs.
    
    Args:
        vessels_list: List of vessel dicts with at least 'mmsi' field
    
    Returns:
        Dict mapping MMSI to ship name
    """
    results = {}
    unknown_mmsis = []
    
    for vessel in vessels_list:
        mmsi = str(vessel.get("mmsi"))
        
        # Try cache first
        cached = get_ship_name(mmsi)
        if cached:
            results[mmsi] = cached
        else:
            unknown_mmsis.append(mmsi)
            results[mmsi] = None
    
    # For remaining unknowns, try external APIs with rate limiting
    if unknown_mmsis:
        for mmsi in unknown_mmsis[:10]:  # Limit API calls
            name = resolve_ship_name(mmsi)
            if name:
                results[mmsi] = name
            time.sleep(0.5)  # Rate limit
    
    return results
