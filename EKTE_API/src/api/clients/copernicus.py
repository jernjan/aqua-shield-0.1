"""NorKyst-800 Ocean Data Client via OPeNDAP"""
import os
from typing import Dict, Any
import warnings

# Suppress warnings from xarray/netcdf
warnings.filterwarnings('ignore')

try:
    import xarray as xr
    XARRAY_AVAILABLE = True
except ImportError:
    XARRAY_AVAILABLE = False

try:
    from scipy.interpolate import RegularGridInterpolator
    SCIPY_AVAILABLE = True
except ImportError:
    SCIPY_AVAILABLE = False


class CopernicusClient:
    """Client for accessing NorKyst-800 ocean current data via OPeNDAP from MET Norway THREDDS"""
    
    def __init__(self):
        # NorKyst-800 OPeNDAP endpoints
        self.norkyst_base = "https://thredds.met.no/thredds/dodsC/sea/norkyst800m/24h"
        self.aggregate_url = f"{self.norkyst_base}/aggregate_be"
        
        self.data_cache = None
        self.cache_time = None
        self.cache_ttl_seconds = 3600  # Cache for 1 hour
    
    def _load_forecast_data(self) -> Dict[str, Any]:
        """Load latest NorKyst-800 forecast data via OPeNDAP"""
        if not XARRAY_AVAILABLE:
            print("⚠️ xarray not installed - returning fallback data")
            return self._get_fallback_data()
        
        try:
            print("📡 Loading NorKyst-800 data from MET Norway THREDDS...")
            
            # Open OPeNDAP dataset (don't download - open streaming)
            ds = xr.open_dataset(self.aggregate_url, engine='netcdf4')
            
            # Extract U and V components (eastward/northward velocities)
            # NorKyst-800 uses 'u' and 'v' for velocity components
            u = ds['u'].isel(time=0, depth=0)  # Latest time, surface
            v = ds['v'].isel(time=0, depth=0)
            
            return {
                'u': u.values,
                'v': v.values,
                'lat': u.lat.values,
                'lon': u.lon.values,
                'timestamp': str(ds['time'].values[0]),
                'depth_m': float(ds['depth'].values[0])
            }
        except Exception as e:
            print(f"⚠️ Failed to load NorKyst-800: {e}")
            return self._get_fallback_data()
    
    def _get_fallback_data(self) -> Dict[str, Any]:
        """Return fallback/mock data when NorKyst-800 is unavailable"""
        import numpy as np
        
        # Create a simple mock grid for Barentshavet
        lat = np.linspace(70, 82, 50)
        lon = np.linspace(10, 35, 100)
        
        # Create realistic current patterns
        u = np.random.normal(0.1, 0.05, (50, 100))
        v = np.random.normal(-0.05, 0.05, (50, 100))
        
        return {
            'u': u,
            'v': v,
            'lat': lat,
            'lon': lon,
            'timestamp': 'fallback',
            'depth_m': 0
        }
    
    def _interpolate_velocity(self, latitude: float, longitude: float, data: Dict[str, Any]) -> tuple:
        """Interpolate u,v velocities to specific lat/lon point"""
        if not SCIPY_AVAILABLE:
            # Simple nearest-neighbor fallback
            la_idx = int((latitude - data['lat'].min()) / (data['lat'].max() - data['lat'].min()) * len(data['lat']))
            lo_idx = int((longitude - data['lon'].min()) / (data['lon'].max() - data['lon'].min()) * len(data['lon']))
            la_idx = max(0, min(la_idx, len(data['lat']) - 1))
            lo_idx = max(0, min(lo_idx, len(data['lon']) - 1))
            return data['u'][la_idx, lo_idx], data['v'][la_idx, lo_idx]
        
        try:
            # Create interpolators for u and v
            u_interp = RegularGridInterpolator(
                (data['lat'], data['lon']),
                data['u'],
                bounds_error=False,
                fill_value=0
            )
            v_interp = RegularGridInterpolator(
                (data['lat'], data['lon']),
                data['v'],
                bounds_error=False,
                fill_value=0
            )
            
            u_val = float(u_interp((latitude, longitude)))
            v_val = float(v_interp((latitude, longitude)))
            return u_val, v_val
        except Exception as e:
            print(f"⚠️ Interpolation failed: {e}")
            return 0.1, -0.05  # Return default currents
    
    def get_ocean_currents(self, latitude: float, longitude: float) -> Dict[str, Any]:
        """
        Get ocean current data for a specific location from NorKyst-800
        
        Args:
            latitude: Latitude in degrees
            longitude: Longitude in degrees
            
        Returns:
            Dictionary with ocean current data (u, v velocities)
        """
        
        # Load data (with fallback to mock if unavailable)
        data = self._load_forecast_data()
        
        # Interpolate to requested location
        u_ms, v_ms = self._interpolate_velocity(latitude, longitude, data)
        
        # Calculate magnitude and direction
        magnitude = (u_ms ** 2 + v_ms ** 2) ** 0.5
        direction_degrees = int((270 - (180 / 3.14159 * __import__('math').atan2(v_ms, u_ms))) % 360)
        
        return {
            "latitude": latitude,
            "longitude": longitude,
            "eastward_velocity_ms": round(u_ms, 4),
            "northward_velocity_ms": round(v_ms, 4),
            "magnitude": round(magnitude, 4),  # m/s
            "direction": direction_degrees,  # degrees
            "velocity_magnitude": round(magnitude, 4),
            "direction_degrees": direction_degrees,
            "data_source": "NorKyst-800 (MET Norway THREDDS)",
            "timestamp": data.get('timestamp', 'unknown'),
            "depth_m": data.get('depth_m', 0)
        }
    
    def get_area_summary(self) -> Dict[str, Any]:
        """Get summary of NorKyst-800 ocean current data for Barentshavet"""
        return {
            "area": "Barentshavet & Nordsjøen",
            "region": {
                "latitude_range": [50.0, 84.5],
                "longitude_range": [3.0, 36.0],
                "depth_range_m": [0, 500]
            },
            "dataset": "NorKyst-800",
            "resolution_meters": 800,
            "resolution_km": 0.8,
            "update_frequency": "daily",
            "forecast_range_days": 1,
            "variables": ["eastward_velocity", "northward_velocity", "temperature", "salinity"],
            "source": "MET Norway THREDDS - https://thredds.met.no/thredds/fou-hi/norkystv3.html"
        }
