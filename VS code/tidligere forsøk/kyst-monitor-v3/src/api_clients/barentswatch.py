"""
BarentsWatch API Client
Handles authentication and API calls to BarentsWatch FiskInfo, NAIS, ArcticInfo
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


class BarentsWatchAuth:
    """Handle OAuth2 authentication for BarentsWatch API"""

    def __init__(self):
        self.client_id = os.getenv("BARENTSWATCH_CLIENT_ID")
        self.client_secret = os.getenv("BARENTSWATCH_CLIENT_SECRET")
        self.auth_url = os.getenv("BARENTSWATCH_AUTH_URL")
        self.scope = os.getenv("BARENTSWATCH_SCOPE")
        self.token = None
        self.token_expiry = None

    def get_token(self) -> str:
        """Get valid access token, refresh if needed"""
        if self.token and self.token_expiry and datetime.now() < self.token_expiry:
            return self.token

        logger.info("Fetching new BarentsWatch token...")
        
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
            
            logger.info(f"✅ BarentsWatch token obtained (expires in {expires_in}s)")
            return self.token
            
        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Failed to get BarentsWatch token: {e}")
            raise


class BarentsWatchClient:
    """Client for BarentsWatch API endpoints"""

    def __init__(self):
        self.auth = BarentsWatchAuth()
        self.base_url = os.getenv("BARENTSWATCH_API_BASE_URL")

    def _get_headers(self) -> Dict[str, str]:
        """Get headers with authentication"""
        token = self.auth.get_token()
        return {
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
        }

    def get_facilities(self) -> List[Dict]:
        """
        Get all aquaculture facilities from Fish Health API
        Returns list of farms with their info
        Endpoint: GET /v1/geodata/fishhealth/localities
        """
        try:
            url = f"{self.base_url}/v1/geodata/fishhealth/localities"
            response = requests.get(url, headers=self._get_headers(), timeout=15)
            response.raise_for_status()
            
            facilities = response.json()
            logger.info(f"✅ Retrieved aquaculture localities from Fish Health API")
            return facilities
            
        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Failed to fetch facilities: {e}")
            return []

    def get_facility_details(self, facility_id: str) -> Optional[Dict]:
        """Get details for specific facility"""
        try:
            url = f"{self.base_url}/fishingfacilities/{facility_id}"
            response = requests.get(url, headers=self._get_headers(), timeout=10)
            response.raise_for_status()
            
            logger.info(f"✅ Retrieved details for facility {facility_id}")
            return response.json()
            
        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Failed to fetch facility {facility_id}: {e}")
            return None

    def get_nais_status(self, year: int = 2026, week: int = 3) -> List[Dict]:
        """
        Get fish health status data for current week
        Includes lice counts, diseases, and health data for all sites
        Endpoint: GET /v1/geodata/fishhealth/{year}/{week}
        """
        try:
            url = f"{self.base_url}/v1/geodata/fishhealth/{year}/{week}"
            response = requests.get(url, headers=self._get_headers(), timeout=15)
            response.raise_for_status()
            
            nais_data = response.json()
            logger.info(f"✅ Retrieved fish health status data for week {week}, {year}")
            return nais_data
            
        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Failed to fetch NAIS data: {e}")
            return []

    def get_arctic_info(self, latitude: float, longitude: float) -> Optional[Dict]:
        """
        Get ArcticInfo - oceanographic data (currents, temperature, etc)
        """
        try:
            url = f"{self.base_url}/arcticinfo"
            params = {"latitude": latitude, "longitude": longitude}
            response = requests.get(url, headers=self._get_headers(), params=params, timeout=10)
            response.raise_for_status()
            
            logger.info(f"✅ Retrieved ArcticInfo for ({latitude}, {longitude})")
            return response.json()
            
        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Failed to fetch ArcticInfo: {e}")
            return None


if __name__ == "__main__":
    # Test the API
    logging.basicConfig(level=logging.INFO)
    
    print("\n🔍 Testing BarentsWatch API...\n")
    client = BarentsWatchClient()
    
    # Test 1: Get facilities
    print("1️⃣ Fetching facilities...")
    facilities = client.get_facilities()
    if facilities:
        print(f"   ✅ Got {len(facilities)} facilities")
        print(f"   Sample: {json.dumps(facilities[0], indent=2, default=str)[:200]}...")
    
    # Test 2: Get NAIS status
    print("\n2️⃣ Fetching NAIS status...")
    nais = client.get_nais_status()
    if nais:
        print(f"   ✅ Got NAIS data")
        print(f"   Sample: {json.dumps(nais[0], indent=2, default=str)[:200]}...")
