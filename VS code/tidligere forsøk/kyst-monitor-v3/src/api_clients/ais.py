"""
AIS API Client
Handles vessel tracking data from BarentsWatch AIS
"""

import os
import json
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, List
import requests
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)


class AISAuth:
    """Handle OAuth2 authentication for AIS API"""

    def __init__(self):
        self.client_id = os.getenv("AIS_CLIENT_ID")
        self.client_secret = os.getenv("AIS_CLIENT_SECRET")
        self.auth_url = os.getenv("AIS_AUTH_URL")
        self.scope = os.getenv("AIS_SCOPE")
        self.token = None
        self.token_expiry = None

    def get_token(self) -> str:
        """Get valid access token, refresh if needed"""
        if self.token and self.token_expiry and datetime.now() < self.token_expiry:
            return self.token

        logger.info("Fetching new AIS token...")
        
        try:
            response = requests.post(
                self.auth_url,
                data={
                    "grant_type": "client_credentials",
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "scope": self.scope,
                },
                timeout=10,
            )
            response.raise_for_status()
            
            data = response.json()
            self.token = data.get("access_token")
            expires_in = data.get("expires_in", 3600)
            self.token_expiry = datetime.now() + timedelta(seconds=expires_in - 60)
            
            logger.info(f"✅ AIS token obtained (expires in {expires_in}s)")
            return self.token
            
        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Failed to get AIS token: {e}")
            raise


class AISClient:
    """Client for AIS (Automatic Identification System) API"""

    def __init__(self):
        self.auth = AISAuth()
        self.base_url = os.getenv("AIS_API_BASE_URL")

    def _get_headers(self) -> Dict[str, str]:
        """Get headers with authentication"""
        token = self.auth.get_token()
        return {
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
        }

    def get_vessels_in_area(
        self,
        latitude: float,
        longitude: float,
        radius_km: float = 50
    ) -> List[Dict]:
        """
        Get all vessels in a geographic area
        Returns list of vessel positions and info
        Endpoint: GET /v1/geodata/ais/positions
        """
        try:
            url = f"{self.base_url}/v1/geodata/ais/positions"
            params = {
                "latitude": latitude,
                "longitude": longitude,
                "radius": radius_km,
            }
            response = requests.get(url, headers=self._get_headers(), params=params, timeout=15)
            response.raise_for_status()
            
            vessels = response.json()
            logger.info(f"✅ Retrieved {len(vessels)} vessels in area ({latitude}, {longitude})")
            return vessels
            
        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Failed to fetch vessels: {e}")
            return []

    def get_vessel_track(self, mmsi: int, hours: int = 24) -> List[Dict]:
        """
        Get vessel movement history (track)
        mmsi = vessel identifier
        """
        try:
            url = f"{self.base_url}/vessels/{mmsi}/track"
            params = {"hours": hours}
            response = requests.get(url, headers=self._get_headers(), params=params, timeout=15)
            response.raise_for_status()
            
            track = response.json()
            logger.info(f"✅ Retrieved track for vessel MMSI {mmsi}")
            return track
            
        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Failed to fetch vessel track: {e}")
            return []

    def get_vessel_info(self, mmsi: int) -> Optional[Dict]:
        """Get detailed info about a specific vessel"""
        try:
            url = f"{self.base_url}/vessels/{mmsi}"
            response = requests.get(url, headers=self._get_headers(), timeout=10)
            response.raise_for_status()
            
            logger.info(f"✅ Retrieved info for vessel MMSI {mmsi}")
            return response.json()
            
        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Failed to fetch vessel info: {e}")
            return None


if __name__ == "__main__":
    # Test the API
    logging.basicConfig(level=logging.INFO)
    
    print("\n🚤 Testing AIS API...\n")
    client = AISClient()
    
    # Test 1: Get vessels in a sample area (Hardangerfjord region)
    print("1️⃣ Fetching vessels in sample area...")
    vessels = client.get_vessels_in_area(latitude=60.3, longitude=6.1, radius_km=30)
    if vessels:
        print(f"   ✅ Got {len(vessels)} vessels")
        if len(vessels) > 0:
            print(f"   Sample: {json.dumps(vessels[0], indent=2, default=str)[:200]}...")
    else:
        print("   ℹ️ No vessels found in area (this is normal if no ships are there)")
