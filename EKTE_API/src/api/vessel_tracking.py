"""
Vessel Track Storage and Management
Stores historical AIS positions for quarantined vessels over 48 hour period
"""
import json
import os
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional


TRACKS_FILE = os.path.join(os.path.dirname(__file__), "data", "vessel_tracks.json")


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _parse_timestamp_utc(value: str) -> datetime:
    parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _ensure_tracks_file():
    """Ensure vessel_tracks.json exists"""
    os.makedirs(os.path.dirname(TRACKS_FILE), exist_ok=True)
    if not os.path.exists(TRACKS_FILE):
        with open(TRACKS_FILE, 'w') as f:
            json.dump({}, f)


def record_vessel_position(mmsi: int, latitude: float, longitude: float, 
                          facility_code: Optional[str] = None,
                          speed: float = 0, heading: Optional[float] = None) -> None:
    """
    Record a vessel's position at the current timestamp.
    Used for tracking vessels in quarantine or under observation.
    
    Args:
        mmsi: Vessel MMSI number
        latitude: Vessel latitude
        longitude: Vessel longitude
        facility_code: Facility code if vessel is near a facility
        speed: Speed over ground (knots)
        heading: True heading or course over ground
    """
    _ensure_tracks_file()
    
    try:
        with open(TRACKS_FILE, 'r') as f:
            tracks = json.load(f)
    except:
        tracks = {}
    
    mmsi_str = str(mmsi)
    if mmsi_str not in tracks:
        tracks[mmsi_str] = []
    
    position = {
        "timestamp": _utc_now().isoformat().replace("+00:00", "Z"),
        "latitude": float(latitude),
        "longitude": float(longitude),
        "speed": float(speed),
        "heading": heading,
        "facility_code": facility_code
    }
    
    tracks[mmsi_str].append(position)
    
    # Keep only last 48 hours of data
    cutoff_time = _utc_now() - timedelta(hours=48)
    tracks[mmsi_str] = [
        p for p in tracks[mmsi_str]
        if _parse_timestamp_utc(p["timestamp"]) > cutoff_time
    ]
    
    with open(TRACKS_FILE, 'w') as f:
        json.dump(tracks, f, indent=2)


def get_vessel_track(mmsi: int, hours: int = 48) -> List[Dict[str, Any]]:
    """
    Get historical track for a vessel over the last N hours.
    
    Returns positions in chronological order.
    """
    _ensure_tracks_file()
    
    try:
        with open(TRACKS_FILE, 'r') as f:
            tracks = json.load(f)
    except:
        return []
    
    mmsi_str = str(mmsi)
    if mmsi_str not in tracks:
        return []
    
    cutoff_time = _utc_now() - timedelta(hours=hours)
    track = [
        p for p in tracks[mmsi_str]
        if _parse_timestamp_utc(p["timestamp"]) > cutoff_time
    ]
    
    return track


def get_all_active_tracks() -> Dict[int, List[Dict[str, Any]]]:
    """
    Get all active vessel tracks (positions from last 48 hours).
    """
    _ensure_tracks_file()
    
    try:
        with open(TRACKS_FILE, 'r') as f:
            tracks = json.load(f)
    except:
        return {}
    
    cutoff_time = _utc_now() - timedelta(hours=48)
    active_tracks = {}
    
    for mmsi_str, positions in tracks.items():
        active = [
            p for p in positions
            if _parse_timestamp_utc(p["timestamp"]) > cutoff_time
        ]
        if active:
            active_tracks[int(mmsi_str)] = active
    
    return active_tracks


def clear_old_tracks(older_than_hours: int = 72) -> int:
    """
    Delete tracks older than specified hours. Returns number of records removed.
    """
    _ensure_tracks_file()
    
    try:
        with open(TRACKS_FILE, 'r') as f:
            tracks = json.load(f)
    except:
        return 0
    
    cutoff_time = _utc_now() - timedelta(hours=older_than_hours)
    total_removed = 0
    
    for mmsi_str in list(tracks.keys()):
        original_count = len(tracks[mmsi_str])
        tracks[mmsi_str] = [
            p for p in tracks[mmsi_str]
            if _parse_timestamp_utc(p["timestamp"]) > cutoff_time
        ]
        removed = original_count - len(tracks[mmsi_str])
        total_removed += removed
        
        # Remove empty entries
        if not tracks[mmsi_str]:
            del tracks[mmsi_str]
    
    with open(TRACKS_FILE, 'w') as f:
        json.dump(tracks, f, indent=2)
    
    return total_removed
