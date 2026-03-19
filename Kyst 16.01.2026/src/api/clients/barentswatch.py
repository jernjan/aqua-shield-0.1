"""BarentsWatch API Client for aquaculture facility data."""

import requests
from typing import Optional, List, Dict, Any
import os
from dotenv import load_dotenv
import datetime
import json

load_dotenv()


class BarentsWatchClient:
    """Client for BarentsWatch APIs with OAuth2 authentication."""

    def __init__(self):
        self.client_id = os.getenv("BARENTSWATCH_CLIENT_ID")
        self.client_secret = os.getenv("BARENTSWATCH_CLIENT_SECRET")
        self.token = None
        self.token_expiry = None
        self.token_url = "https://id.barentswatch.no/connect/token"
        self.api_base = "https://www.barentswatch.no/bwapi"

    def get_token(self) -> str:
        """Get valid OAuth2 access token."""
        if self.token and self.token_expiry and datetime.datetime.now() < self.token_expiry:
            return self.token

        response = requests.post(
            self.token_url,
            data={
                "grant_type": "client_credentials",
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "scope": "api",
            },
            timeout=10,
        )
        response.raise_for_status()
        data = response.json()
        self.token = data["access_token"]
        expires_in = data.get("expires_in", 3600)
        self.token_expiry = datetime.datetime.now() + datetime.timedelta(seconds=expires_in - 60)
        return self.token

    def get_lice_data_v2(self, year: int = 2026, week: int = 2) -> List[Dict[str, Any]]:
        """Get aquaculture facility data from BarentsWatch v2 API with lice and disease data."""
        token = self.get_token()
        url = f"{self.api_base}/v2/geodata/fishhealth/locality/{year}/{week}"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }

        response = requests.post(
            url,
            headers=headers,
            json={},  # Send empty JSON body
            timeout=15,  # Added timeout to prevent hanging
        )
        response.raise_for_status()
        return response.json()

    def get_arcticinfo(self, latitude: float, longitude: float) -> Optional[Dict[str, Any]]:
        """Get oceanographic data from BarentsWatch ArcticInfo API.
        
        Returns ocean current data (velocity components, magnitude, direction) 
        and other oceanographic parameters.
        
        Args:
            latitude: Latitude in degrees (WGS84)
            longitude: Longitude in degrees (WGS84)
            
        Returns:
            Dictionary with ocean current data or None if request fails
        """
        try:
            token = self.get_token()
            url = f"{self.api_base}/arcticinfo"
            headers = {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            }
            params = {
                "latitude": latitude,
                "longitude": longitude
            }
            
            response = requests.get(
                url,
                headers=headers,
                params=params,
                timeout=10,
            )
            response.raise_for_status()
            return response.json()
        except Exception as e:
            print(f"ArcticInfo unavailable: {e}. Falling back to Copernicus...")
            return self.get_ocean_currents_copernicus(latitude, longitude)

    def get_ocean_currents_copernicus(self, latitude: float, longitude: float) -> Optional[Dict[str, Any]]:
        """Get ocean current data from Copernicus Marine Service (public, no auth needed).
        
        Returns ocean velocity components for 2D current calculation.
        Uses NOAA ERDDAP endpoint with Copernicus/merged satellite data.
        
        Args:
            latitude: Latitude in degrees WGS84 (-90 to 90)
            longitude: Longitude in degrees WGS84 (-180 to 180)
            
        Returns:
            Dictionary with 'magnitude' (m/s) and components, or None if unavailable
        """
        try:
            # NOAA ERDDAP endpoint with ocean current data
            # Uses merged satellite/model data with global coverage
            url = "https://coastwatch.pfeg.noaa.gov/erddap/griddap/erdQMekdataday.json"
            
            # Use standard dict format for params
            params = {
                ".vars": "longitude,latitude,u,v",
                "time": "2026-01-19T00:00:00Z"
            }
            
            response = requests.get(url, params=params, timeout=5)
            
            if response.status_code == 200:
                data = response.json()
                if data.get("table", {}).get("rows"):
                    # Extract velocity components from ERDDAP response
                    for row in data["table"]["rows"]:
                        if len(row) >= 4:
                            try:
                                u = float(row[2]) if row[2] is not None else 0.0
                                v = float(row[3]) if row[3] is not None else 0.0
                                magnitude = (u**2 + v**2) ** 0.5
                                
                                return {
                                    "source": "copernicus",
                                    "u": u,
                                    "v": v,
                                    "magnitude": magnitude,
                                    "latitude": latitude,
                                    "longitude": longitude
                                }
                            except (ValueError, IndexError):
                                continue
        except Exception as e:
            # Silently fail - risk engine will handle None gracefully
            pass
        
        return None

    def get_historic_ais(self, mmsi: Optional[int] = None) -> Optional[List[Dict[str, Any]]]:
        """Get historic AIS vessel position data from BarentsWatch (7-day history).
        
        Returns vessel tracks showing where fishing vessels have been.
        Can be used to identify which vessels visited diseased farms.
        
        Args:
            mmsi: Maritime Mobile Service Identity (vessel identifier)
                  If None, returns recent vessel activity data
            
        Returns:
            List of AIS position records with timestamps, or None if unavailable
        """
        try:
            token = self.get_token()
            
            # BarentsWatch Historic AIS endpoint
            if mmsi:
                url = f"{self.api_base}/v2/geodata/ais/historic/{mmsi}"
            else:
                # Get general recent AIS activity
                url = f"{self.api_base}/v2/geodata/ais/recent"
            
            headers = {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            }
            
            response = requests.get(url, headers=headers, timeout=15)
            response.raise_for_status()
            
            data = response.json()
            
            # Normalize response to list format
            if isinstance(data, dict) and "positions" in data:
                return data["positions"]
            elif isinstance(data, list):
                return data
            else:
                return None
                
        except Exception as e:
            print(f"Error fetching Historic AIS data: {e}")
            return None

    def get_vessels_at_location(self, latitude: float, longitude: float, 
                                radius_km: float = 10) -> Optional[List[Dict[str, Any]]]:
        """Get vessels currently in/near a specific farm location.
        
        Uses AIS data to find which fishing vessels are close to an aquaculture farm.
        Used for disease exposure analysis.
        
        Args:
            latitude: Farm latitude
            longitude: Farm longitude  
            radius_km: Search radius in kilometers (default 10 km)
            
        Returns:
            List of nearby vessels with distance and heading, or None
        """
        try:
            token = self.get_token()
            
            # BarentsWatch spatial AIS query
            url = f"{self.api_base}/v2/geodata/ais/nearby"
            headers = {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "latitude": latitude,
                "longitude": longitude,
                "radius": radius_km * 1000,  # Convert to meters
            }
            
            response = requests.post(url, headers=headers, json=payload, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            
            # Extract vessel list
            if isinstance(data, dict):
                vessels = data.get("vessels", [])
                return vessels if vessels else None
            elif isinstance(data, list):
                return data if data else None
            
            return None
            
        except Exception as e:
            print(f"Error querying vessels at location: {e}")
            return None

    def get_vessel_track(self, mmsi: int, days: int = 7) -> Optional[Dict[str, Any]]:
        """Get complete 7-day movement track for a specific vessel.
        
        Returns the vessel's position history to trace its movements.
        Used to identify which farms a vessel may have visited.
        
        Args:
            mmsi: Vessel identifier
            days: Number of historical days (max 7)
            
        Returns:
            Dictionary with vessel info and list of positions over time, or None
        """
        try:
            token = self.get_token()
            
            # BarentsWatch vessel track endpoint
            url = f"{self.api_base}/v2/geodata/ais/track/{mmsi}"
            headers = {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            }
            
            params = {
                "days": min(days, 7)  # Cap at 7 days
            }
            
            response = requests.get(url, headers=headers, params=params, timeout=15)
            response.raise_for_status()
            
            return response.json()
            
        except Exception as e:
            print(f"Error fetching vessel track for MMSI {mmsi}: {e}")
            return None

    def _get_lice_data_v1(self, locality_id: int) -> Optional[Dict[str, Any]]:
        """Fallback to v1 API for specific facility (deprecated)."""
        token = self.get_token()
        url = f"{self.api_base}/v1/healthstatus/{locality_id}"
        headers = {"Authorization": f"Bearer {token}"}

        try:
            response = requests.get(
                url,
                headers=headers,
                timeout=15,  # Added timeout
            )
            if response.status_code == 404:
                return None
            response.raise_for_status()
            return response.json()
        except Exception:
            return None
