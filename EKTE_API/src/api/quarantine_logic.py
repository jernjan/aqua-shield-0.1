"""
Automatic quarantine detection and management for vessels near infected facilities.
Implements proximity-based auto-registration with configurable thresholds.
"""

import json
import os
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, Dict, List
import logging

logger = logging.getLogger(__name__)

# Import database for permanent exposure logging
try:
    from src.api.database import log_exposure_event
except ImportError:
    # Fallback if database module not available
    def log_exposure_event(*args, **kwargs):
        pass

# Configuration
PROXIMITY_THRESHOLD_KM = 1.0  # Must be within 1 km
EXPOSURE_THRESHOLD_MINUTES = 30  # Must be there for 30+ minutes
QUARANTINE_DURATION_HOURS = 48  # Quarantine window
COOLDOWN_DURATION_DAYS = 7  # Lock-out period after quarantine expires

# Data files
DATA_DIR = Path(__file__).parent.parent.parent / "data"
QUARANTINE_REGISTRY_FILE = DATA_DIR / "quarantine_registry.json"
EXPOSURE_TRACKING_FILE = DATA_DIR / "exposure_tracking.json"
QUARANTINE_ARCHIVE_FILE = DATA_DIR / "quarantine_archive.json"


def ensure_data_files():
    """Create data directory and files if they don't exist."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    
    if not QUARANTINE_REGISTRY_FILE.exists():
        with open(QUARANTINE_REGISTRY_FILE, 'w') as f:
            json.dump({"auto_registered": [], "last_updated": datetime.utcnow().isoformat()}, f, indent=2)
    
    if not EXPOSURE_TRACKING_FILE.exists():
        with open(EXPOSURE_TRACKING_FILE, 'w') as f:
            json.dump({"tracking": {}}, f, indent=2)
    
    if not QUARANTINE_ARCHIVE_FILE.exists():
        with open(QUARANTINE_ARCHIVE_FILE, 'w') as f:
            json.dump({"archived": []}, f, indent=2)


def calculate_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two points using Haversine formula (in km)."""
    import math
    R = 6371  # Earth's radius in kilometers
    
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)
    
    a = math.sin(delta_lat / 2) ** 2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    return R * c


def load_exposure_tracking() -> Dict:
    """Load current exposure tracking data."""
    ensure_data_files()
    try:
        with open(EXPOSURE_TRACKING_FILE, 'r') as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Error loading exposure tracking: {e}")
        return {"tracking": {}}


def save_exposure_tracking(data: Dict):
    """Save exposure tracking data."""
    ensure_data_files()
    try:
        with open(EXPOSURE_TRACKING_FILE, 'w') as f:
            json.dump(data, f, indent=2)
    except Exception as e:
        logger.error(f"Error saving exposure tracking: {e}")


def load_quarantine_registry() -> Dict:
    """Load quarantine registry."""
    ensure_data_files()
    try:
        with open(QUARANTINE_REGISTRY_FILE, 'r') as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Error loading quarantine registry: {e}")
        return {"auto_registered": []}


def save_quarantine_registry(data: Dict):
    """Save quarantine registry."""
    ensure_data_files()
    try:
        data["last_updated"] = datetime.utcnow().isoformat()
        with open(QUARANTINE_REGISTRY_FILE, 'w') as f:
            json.dump(data, f, indent=2)
    except Exception as e:
        logger.error(f"Error saving quarantine registry: {e}")


def load_quarantine_archive() -> Dict:
    """Load quarantine archive."""
    ensure_data_files()
    try:
        with open(QUARANTINE_ARCHIVE_FILE, 'r') as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Error loading quarantine archive: {e}")
        return {"archived": []}


def save_quarantine_archive(data: Dict):
    """Save quarantine archive."""
    ensure_data_files()
    try:
        with open(QUARANTINE_ARCHIVE_FILE, 'w') as f:
            json.dump(data, f, indent=2)
    except Exception as e:
        logger.error(f"Error saving quarantine archive: {e}")


def track_exposure(mmsi: int, facility_name: str, distance_km: float) -> bool:
    """
    Track vessel exposure to infected facility.
    Returns True if exposure threshold met (30+ minutes nearby).
    
    Logic:
    - First detection: Record timestamp + distance
    - Second detection (≤30 min later): Vessel stayed, trigger registration
    - Later detections: Continue tracking or archive
    """
    tracking = load_exposure_tracking()
    mmsi_str = str(mmsi)
    current_time = datetime.utcnow()
    
    if mmsi_str not in tracking["tracking"]:
        # First detection - log to permanent database
        tracking["tracking"][mmsi_str] = {
            "facility_name": facility_name,
            "first_detection": current_time.isoformat(),
            "last_detection": current_time.isoformat(),
            "detections": [
                {
                    "timestamp": current_time.isoformat(),
                    "distance_km": distance_km
                }
            ]
        }
        save_exposure_tracking(tracking)
        logger.info(f"Exposure tracking started for MMSI {mmsi} at {facility_name}")
        
        # Log initial proximity event (not yet quarantine)
        try:
            log_exposure_event(
                vessel_mmsi=mmsi_str,
                facility_id=facility_name,
                distance_km=distance_km,
                facility_name=facility_name,
                disease_status="infected",
                risk_triggered=False,
                risk_level="Monitoring",
                notes="Initial proximity detection"
            )
        except Exception as e:
            logger.warning(f"Failed to log initial exposure: {e}")
        
        return False
    
    exposure_data = tracking["tracking"][mmsi_str]
    first_detection = datetime.fromisoformat(exposure_data["first_detection"])
    time_elapsed = (current_time - first_detection).total_seconds() / 60  # minutes
    
    # Record latest detection
    exposure_data["last_detection"] = current_time.isoformat()
    exposure_data["detections"].append({
        "timestamp": current_time.isoformat(),
        "distance_km": distance_km
    })
    
    # Check if threshold met (30+ minutes)
    if time_elapsed >= EXPOSURE_THRESHOLD_MINUTES:
        logger.info(f"Exposure threshold met for MMSI {mmsi}: {time_elapsed:.0f} minutes at {facility_name}")
        save_exposure_tracking(tracking)
        return True
    
    save_exposure_tracking(tracking)
    return False


def auto_register_vessel(mmsi: int, vessel_name: str, facility_name: str, 
                        distance_km: float, exposure_minutes: int) -> Dict:
    """
    Auto-register a vessel in quarantine.
    
    Args:
        mmsi: Vessel MMSI number
        vessel_name: Vessel name from AIS data
        facility_name: Infected facility name
        distance_km: Distance in km
        exposure_minutes: How long vessel was near facility
    
    Returns:
        Registration record
    """
    ensure_data_files()
    registry = load_quarantine_registry()
    mmsi_str = str(mmsi)
    current_time = datetime.utcnow()
    quarantine_expires = current_time + timedelta(hours=QUARANTINE_DURATION_HOURS)
    cooldown_expires = quarantine_expires + timedelta(days=COOLDOWN_DURATION_DAYS)
    
    # Check if already registered
    for vessel in registry["auto_registered"]:
        if str(vessel["mmsi"]) == mmsi_str:
            # Re-exposure: reset timer
            vessel["quarantine_expires"] = quarantine_expires.isoformat()
            vessel["status"] = "quarantine"
            vessel["visits_logged"].append({
                "timestamp": current_time.isoformat(),
                "facility_name": facility_name,
                "action": "re_exposure",
                "distance_km": distance_km
            })
            logger.info(f"Re-exposure detected for MMSI {mmsi}: quarantine timer reset")
            
            # Log to permanent database
            try:
                log_exposure_event(
                    vessel_mmsi=mmsi_str,
                    facility_id=facility_name,  # Using name as ID for now
                    distance_km=distance_km,
                    vessel_name=vessel_name,
                    facility_name=facility_name,
                    duration_min=exposure_minutes,
                    disease_status="infected",
                    quarantine_end_time=quarantine_expires.isoformat(),
                    risk_triggered=True,
                    risk_level="Ekstrem",
                    notes="Re-exposure - quarantine timer reset"
                )
            except Exception as e:
                logger.warning(f"Failed to log exposure event: {e}")
            
            save_quarantine_registry(registry)
            return vessel
    
    # New registration
    registration = {
        "mmsi": mmsi,
        "vessel_name": vessel_name or f"Vessel {mmsi}",
        "registered_at": current_time.isoformat(),
        "registered_from_facility": facility_name,
        "quarantine_expires": quarantine_expires.isoformat(),
        "cooldown_expires": cooldown_expires.isoformat(),
        "status": "quarantine",
        "visits_logged": [
            {
                "timestamp": current_time.isoformat(),
                "facility_name": facility_name,
                "action": "auto_detected",
                "distance_km": distance_km,
                "exposure_duration_minutes": exposure_minutes
            }
        ],
        "subsequent_facility_visits": []
    }
    
    registry["auto_registered"].append(registration)
    logger.info(f"Auto-registered MMSI {mmsi} from {facility_name}")
    
    # Log to permanent database
    try:
        log_exposure_event(
            vessel_mmsi=mmsi_str,
            facility_id=facility_name,  # Using name as ID for now
            distance_km=distance_km,
            vessel_name=vessel_name,
            facility_name=facility_name,
            duration_min=exposure_minutes,
            disease_status="infected",
            quarantine_end_time=quarantine_expires.isoformat(),
            risk_triggered=True,
            risk_level="Ekstrem",
            notes="Auto-registered quarantine"
        )
    except Exception as e:
        logger.warning(f"Failed to log exposure event: {e}")
    
    save_quarantine_registry(registry)
    
    # Clear exposure tracking for this vessel
    tracking = load_exposure_tracking()
    if mmsi_str in tracking["tracking"]:
        del tracking["tracking"][mmsi_str]
        save_exposure_tracking(tracking)
    
    return registration


def check_quarantine_status(mmsi: int) -> Dict:
    """
    Check if a vessel is currently in quarantine.
    
    Returns:
        {
            "in_quarantine": bool,
            "status": "quarantine|cooldown|clear",
            "hours_remaining": int,
            "facility_name": str,
            "registered_at": str,
            "visits": [...]
        }
    """
    registry = load_quarantine_registry()
    mmsi_str = str(mmsi)
    current_time = datetime.utcnow()
    
    for vessel in registry["auto_registered"]:
        if str(vessel["mmsi"]) == mmsi_str:
            expires = datetime.fromisoformat(vessel["quarantine_expires"])
            cooldown_expires = datetime.fromisoformat(vessel.get("cooldown_expires", expires.isoformat()))
            
            if current_time < expires:
                # Still in active quarantine
                hours_remaining = (expires - current_time).total_seconds() / 3600
                return {
                    "in_quarantine": True,
                    "status": "quarantine",
                    "hours_remaining": max(0, int(hours_remaining)),
                    "facility_name": vessel["registered_from_facility"],
                    "registered_at": vessel["registered_at"],
                    "visits": vessel["visits_logged"],
                    "auto_registered": True
                }
            elif current_time < cooldown_expires:
                # In cooldown period (7 days after quarantine)
                hours_remaining = (cooldown_expires - current_time).total_seconds() / 3600
                return {
                    "in_quarantine": False,
                    "status": "cooldown",
                    "hours_remaining": max(0, int(hours_remaining)),
                    "facility_name": vessel["registered_from_facility"],
                    "registered_at": vessel["registered_at"],
                    "visits": vessel["visits_logged"],
                    "auto_registered": True,
                    "note": "In cooldown period - cannot re-trigger from same facility"
                }
            else:
                # Expired - move to archive
                archive = load_quarantine_archive()
                archive["archived"].append({
                    **vessel,
                    "archived_at": current_time.isoformat()
                })
                save_quarantine_archive(archive)
                
                # Remove from active registry
                registry["auto_registered"] = [v for v in registry["auto_registered"] if str(v["mmsi"]) != mmsi_str]
                save_quarantine_registry(registry)
                
                return {
                    "in_quarantine": False,
                    "status": "clear",
                    "hours_remaining": 0,
                    "facility_name": vessel["registered_from_facility"],
                    "registered_at": vessel["registered_at"],
                    "auto_registered": True,
                    "note": "Quarantine period expired and archived"
                }
    
    return {
        "in_quarantine": False,
        "status": "clear",
        "hours_remaining": 0,
        "auto_registered": False
    }


def get_active_quarantines() -> List[Dict]:
    """Get all currently active quarantines."""
    registry = load_quarantine_registry()
    current_time = datetime.utcnow()
    active = []
    
    for vessel in registry["auto_registered"]:
        expires = datetime.fromisoformat(vessel["quarantine_expires"])
        if current_time < expires:
            hours_remaining = (expires - current_time).total_seconds() / 3600

            facility_name = str(vessel.get("registered_from_facility") or "").strip()
            exposure_minutes = None

            # Fallback: use latest logged visit if registry top-level name is missing
            visits_logged = vessel.get("visits_logged") or []
            if (not facility_name) and visits_logged:
                for log_entry in reversed(visits_logged):
                    candidate = str(log_entry.get("facility_name") or "").strip()
                    if candidate:
                        facility_name = candidate
                        break

            if visits_logged:
                latest_log = visits_logged[-1]
                exposure_minutes = latest_log.get("exposure_duration_minutes")

            active.append({
                "mmsi": vessel.get("mmsi"),
                "vessel_name": vessel.get("vessel_name"),
                "facility_name": facility_name,
                "facility_code": vessel.get("registered_from_facility_code"),
                "hours_remaining": max(0, int(hours_remaining)),
                "registered_at": vessel.get("registered_at"),
                "exposure_minutes": exposure_minutes
            })
    
    return active


def check_proximity_and_trigger(vessels: List[Dict], infected_facilities: List[Dict]) -> List[Dict]:
    """
    Main proximity detection function.
    Checks all unregistered vessels against infected facilities.
    
    Returns:
        List of newly registered quarantines
    """
    registry = load_quarantine_registry()
    registered_mmsis = {str(v["mmsi"]) for v in registry["auto_registered"]}
    newly_registered = []
    
    for vessel in vessels:
        mmsi = vessel.get("mmsi")
        if not mmsi or str(mmsi) in registered_mmsis:
            continue
        
        vessel_lat = vessel.get("latitude")
        vessel_lon = vessel.get("longitude")
        
        if vessel_lat is None or vessel_lon is None:
            continue
        
        # Check distance to each infected facility
        for facility in infected_facilities:
            facility_lat = facility.get("latitude")
            facility_lon = facility.get("longitude")
            
            if facility_lat is None or facility_lon is None:
                continue
            
            distance = calculate_distance_km(
                vessel_lat, vessel_lon,
                facility_lat, facility_lon
            )
            
            # Within proximity threshold
            if distance <= PROXIMITY_THRESHOLD_KM:
                # Try multiple keys, skip None values
                facility_name = (
                    facility.get("name") or 
                    facility.get("facility_name") or 
                    facility.get("facilityName") or 
                    "Unknown Facility"
                )
                
                # Track exposure and check if threshold met
                if track_exposure(mmsi, facility_name, distance):
                    # Exposure threshold met - auto-register
                    vessel_name = vessel.get("name", vessel.get("vessel_name"))
                    registration = auto_register_vessel(
                        mmsi=mmsi,
                        vessel_name=vessel_name,
                        facility_name=facility_name,
                        distance_km=distance,
                        exposure_minutes=EXPOSURE_THRESHOLD_MINUTES
                    )
                    newly_registered.append(registration)
    
    return newly_registered


# Initialize data files on import
ensure_data_files()
