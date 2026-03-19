"""AIS Client for vessel tracking data from BarentsWatch."""

import requests
from typing import Optional, List, Dict, Any
import os
from dotenv import load_dotenv
import datetime

load_dotenv()


class AISClient:
    """Client for BarentsWatch AIS API for vessel tracking."""

    def __init__(self):
        # Try to use dedicated AIS credentials, fall back to regular ones
        self.client_id = os.getenv("AIS_CLIENT_ID") or os.getenv("BARENTSWATCH_CLIENT_ID")
        self.client_secret = os.getenv("AIS_CLIENT_SECRET") or os.getenv("BARENTSWATCH_CLIENT_SECRET")
        self.token = None
        self.token_expiry = None
        self.token_url = "https://id.barentswatch.no/connect/token"
        self.ais_url = "https://live.ais.barentswatch.no/v1/latest/ais"

    def get_token(self) -> str:
        """Get valid OAuth2 access token for AIS scope."""
        if self.token and self.token_expiry and datetime.datetime.now() < self.token_expiry:
            return self.token

        # For AIS API, send credentials in POST data, not auth header
        response = requests.post(
            self.token_url,
            data={
                "grant_type": "client_credentials",
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "scope": "ais",
            },
            timeout=10,
        )
        response.raise_for_status()
        data = response.json()
        self.token = data["access_token"]
        expires_in = data.get("expires_in", 3600)
        self.token_expiry = datetime.datetime.now() + datetime.timedelta(seconds=expires_in - 60)
        return self.token

    def get_vessels(self) -> List[Dict[str, Any]]:
        """Get all vessels from BarentsWatch AIS API.
        
        Returns list of vessel data with:
        - mmsi: Maritime Mobile Service Identity
        - latitude, longitude: Position
        - courseOverGround, speedOverGround: Navigation data
        - msgtime: Last update timestamp
        """
        token = self.get_token()
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }
        
        try:
            response = requests.get(
                self.ais_url,
                headers=headers,
                timeout=15,
            )
            response.raise_for_status()
            
            vessels = response.json() if response.text else []
            
            # Try to enrich with static data (ship names/types)
            # Note: BarentsWatch may have Type 5 messages available
            try:
                static_response = requests.get(
                    f"{self.ais_url.replace('/latest/ais', '')}/static",
                    headers=headers,
                    timeout=10,
                )
                if static_response.status_code == 200:
                    static_data = static_response.json() if static_response.text else {}
                    # Merge static data (name, type) into position data by MMSI
                    for vessel in vessels:
                        mmsi = vessel.get("mmsi")
                        if mmsi and mmsi in static_data:
                            static = static_data[mmsi]
                            if "name" in static and not vessel.get("name"):
                                vessel["name"] = static.get("name")
                            if "type" in static and not vessel.get("type"):
                                vessel["type"] = static.get("type")
            except:
                # Static data endpoint may not exist, that's ok
                pass
            
            return vessels
        except requests.exceptions.RequestException as e:
            print(f"Error fetching AIS data: {e}")
            return []

    def get_vessels_near_location(
        self, latitude: float, longitude: float, radius_km: float = 5
    ) -> List[Dict[str, Any]]:
        """Get vessels within a certain radius of a location."""
        from math import radians, cos, sin, asin, sqrt
        
        vessels = self.get_vessels()
        
        def haversine(lat1, lon1, lat2, lon2):
            """Calculate distance in km."""
            lon1, lat1, lon2, lat2 = map(radians, [lon1, lat1, lon2, lat2])
            dlon = lon2 - lon1
            dlat = lat2 - lat1
            a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
            c = 2 * asin(sqrt(a))
            return 6371 * c  # Radius of earth in kilometers
        
        nearby = []
        for vessel in vessels:
            try:
                if "latitude" not in vessel or "longitude" not in vessel:
                    continue
                
                distance = haversine(latitude, longitude, vessel["latitude"], vessel["longitude"])
                
                if distance <= radius_km:
                    vessel["distance_km"] = round(distance, 2)
                    nearby.append(vessel)
            except (TypeError, KeyError):
                continue
        
        return sorted(nearby, key=lambda x: x.get("distance_km", float("inf")))
