"""Ship name cache/lookup - caches vessel names from AIS or external sources."""

import json
import os
from typing import Optional, Dict
from pathlib import Path

# Use path relative to EKTE_API root
SHIP_CACHE_FILE = Path(__file__).parent.parent.parent / "ship_names_cache.json"


class ShipNameCache:
    """Simple in-memory cache for ship names fetched from AIS or external sources."""
    
    def __init__(self):
        self.cache = self._load_cache()
    
    def _load_cache(self) -> Dict[str, str]:
        """Load cached ship names from file."""
        if SHIP_CACHE_FILE.exists():
            try:
                with open(SHIP_CACHE_FILE, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception as e:
                print(f"Warning: Could not load ship cache: {e}")
                return {}
        return {}
    
    def _save_cache(self):
        """Save cache to file."""
        try:
            with open(SHIP_CACHE_FILE, 'w', encoding='utf-8') as f:
                json.dump(self.cache, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"Warning: Could not save ship cache: {e}")
    
    def get_name(self, mmsi: str) -> Optional[str]:
        """Get cached ship name."""
        return self.cache.get(str(mmsi))
    
    def set_name(self, mmsi: str, name: str):
        """Cache ship name."""
        if name and name != "Unknown Vessel":
            self.cache[str(mmsi)] = name
            self._save_cache()
    
    def lookup_online(self, mmsi: str) -> Optional[str]:
        """Try to lookup ship name from online source (IMO lookup via checkship or similar).
        
        This is a simplified version - in production you'd want to use an actual maritime DB API.
        For now, we cache what we find from AIS static messages.
        """
        # Check if already cached
        cached = self.get_name(mmsi)
        if cached:
            return cached
        
        # Try public maritime API (marinetraffic requires API key, so using generic approach)
        try:
            import requests
            # Using a simple public API endpoint for vessel lookup
            # Note: Most require authentication, so this is a placeholder
            # In production, integrate with actual maritime vessel database
            pass
        except:
            pass
        
        return None


# Global cache instance
_ship_cache = ShipNameCache()


def get_ship_name(mmsi: str) -> Optional[str]:
    """Get ship name from cache or try online lookup."""
    return _ship_cache.get_name(mmsi)


def cache_ship_name(mmsi: str, name: str):
    """Add ship name to cache."""
    _ship_cache.set_name(mmsi, name)
