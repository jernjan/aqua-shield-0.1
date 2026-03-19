"""CMEMS Ocean Current Data Client - Using local CSV data"""
import os
import math
from typing import Dict, Any, Optional
from datetime import datetime
import csv

class CMEMSClient:
    """Load CMEMS ocean current data from local CSV file"""
    
    def __init__(self):
        self.data = None
        self.data_loaded = False
        self.csv_file = None
        self._find_cmems_csv()
    
    def _find_cmems_csv(self):
        """Find CMEMS CSV file in workspace"""
        # Look in root of workspace
        # Current path: EKTE_API/src/api/clients/cmems.py
        # Need to go up 4 levels: clients -> api -> src -> EKTE_API -> (root workspace)
        current_dir = os.path.dirname(__file__)
        for _ in range(4):
            current_dir = os.path.dirname(current_dir)
        workspace_root = current_dir
        
        print(f"[CMEMSClient] Looking for CSV in: {workspace_root}")
        
        # Try to find cmems*.csv
        try:
            for filename in os.listdir(workspace_root):
                if filename.startswith('cmems_') and filename.endswith('.csv'):
                    self.csv_file = os.path.join(workspace_root, filename)
                    print(f"[CMEMSClient] ✓ Found CMEMS file: {filename}")
                    return
        except Exception as e:
            print(f"[CMEMSClient] Error listing directory: {e}")
        
        print("[CMEMSClient] No CMEMS CSV file found in workspace")
    
    def _load_csv_data(self):
        """Load all data from CSV into memory"""
        if self.data_loaded or not self.csv_file:
            return
        
        try:
            self.data = []
            with open(self.csv_file, 'r') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    try:
                        # Skip rows with missing lat/lon
                        lat = row.get('latitude', '').strip()
                        lon = row.get('longitude', '').strip()
                        uo = row.get('uo', '').strip()
                        vo = row.get('vo', '').strip()
                        
                        if not lat or not lon or not uo or not vo:
                            continue
                        
                        self.data.append({
                            'time': row.get('time', ''),
                            'latitude': float(lat),
                            'longitude': float(lon),
                            'uo': float(uo),  # U-component (E-W)
                            'vo': float(vo),  # V-component (N-S)
                        })
                    except (ValueError, TypeError):
                        # Skip malformed rows
                        continue
            
            self.data_loaded = True
            print(f"[CMEMSClient] ✓ Loaded {len(self.data)} valid data points from CSV")
        except Exception as e:
            print(f"[CMEMSClient] Error loading CSV: {e}")
    
    def get_ocean_current(self, latitude: float, longitude: float) -> Optional[Dict[str, Any]]:
        """
        Get ocean current at specific lat/lon
        Returns interpolated/nearest-neighbor current data
        """
        if not self.csv_file:
            return self._fallback_current()
        
        # Load data if needed
        if not self.data_loaded:
            self._load_csv_data()
        
        if not self.data or len(self.data) == 0:
            return self._fallback_current()
        
        try:
            # Find nearest data point
            nearest = self._find_nearest(latitude, longitude)
            
            if nearest is None:
                return self._fallback_current()
            
            # Calculate direction and speed from u,v components
            uo = nearest['uo']  # m/s, eastward
            vo = nearest['vo']  # m/s, northward
            
            # Speed in m/s
            speed = math.sqrt(uo**2 + vo**2)
            
            # Direction in degrees (0=N, 90=E, 180=S, 270=W)
            # atan2 gives radians where 0°=east, so we need to convert
            direction_rad = math.atan2(vo, uo)  # atan2(northward, eastward)
            direction_deg = (math.degrees(direction_rad) + 90) % 360
            
            return {
                'latitude': nearest['latitude'],
                'longitude': nearest['longitude'],
                'uo': round(uo, 4),
                'vo': round(vo, 4),
                'speed': round(speed, 4),  # m/s
                'direction': round(direction_deg, 1),  # degrees (0=N)
                'timestamp': nearest['time'],
                'source': 'cmems'
            }
        except Exception as e:
            print(f"[CMEMSClient] Error getting current: {e}")
            return self._fallback_current()
    
    def _find_nearest(self, latitude: float, longitude: float) -> Optional[Dict[str, Any]]:
        """Find nearest data point using simple distance calculation"""
        if not self.data:
            return None
        
        min_distance = float('inf')
        nearest = None
        
        for point in self.data:
            # Simple Euclidean distance (for small areas, good enough)
            distance = math.sqrt(
                (point['latitude'] - latitude)**2 + 
                (point['longitude'] - longitude)**2
            )
            
            if distance < min_distance:
                min_distance = distance
                nearest = point
        
        return nearest
    
    def _fallback_current(self) -> Dict[str, Any]:
        """Return fallback ocean current data when real data unavailable"""
        return {
            'latitude': 0.0,
            'longitude': 0.0,
            'uo': 0.0,
            'vo': 0.0,
            'speed': 0.0,
            'direction': 0.0,
            'timestamp': datetime.now().isoformat(),
            'source': 'fallback'
        }

    def get_area_summary(self) -> Dict[str, Any]:
        """Return a summary of the available ocean current dataset."""
        has_csv = bool(self.csv_file)
        data_points = len(self.data) if self.data_loaded and self.data else 0
        source = "cmems_csv" if has_csv else "fallback"

        return {
            "dataset": "NorKyst-800 (CSV extract)" if has_csv else "Fallback",
            "source": source,
            "csv_file": os.path.basename(self.csv_file) if has_csv else None,
            "data_points": data_points,
            "resolution_meters": 800,
            "resolution_km": 0.8,
            "update_frequency": "unknown",
            "variables": ["uo", "vo"],
            "note": "Local CSV used for currents" if has_csv else "No CMEMS CSV found"
        }
