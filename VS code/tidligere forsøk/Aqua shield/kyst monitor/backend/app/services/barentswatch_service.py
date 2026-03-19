"""BarentsWatch API integration service with OAuth2 client credentials."""
import httpx
import asyncio
from datetime import datetime, timedelta
from typing import Optional, Any
from app.core.config import settings
from urllib.parse import quote
import logging

logger = logging.getLogger(__name__)


class BarentsWatchOAuth2:
    """OAuth2 client credentials flow for BarentsWatch API."""
    
    def __init__(self):
        self.client_id = settings.BARENTZWATCH_CLIENT_ID
        self.client_secret = settings.BARENTZWATCH_CLIENT_SECRET
        self.token_url = settings.BARENTZWATCH_TOKEN_URL
        self.api_base_url = settings.BARENTZWATCH_API_BASE_URL
        self.access_token: Optional[str] = None
        self.token_expires_at: Optional[datetime] = None
        self._lock = asyncio.Lock()

    async def get_access_token(self) -> str:
        """Get a valid access token, refreshing if necessary."""
        # Check if token is still valid
        if self.access_token and self.token_expires_at:
            if datetime.utcnow() < self.token_expires_at - timedelta(minutes=1):
                return self.access_token

        # Get new token
        async with self._lock:
            # Double-check after acquiring lock
            if self.access_token and self.token_expires_at:
                if datetime.utcnow() < self.token_expires_at - timedelta(minutes=1):
                    return self.access_token

            try:
                # URL-encode client ID (required by BarentsWatch)
                encoded_client_id = quote(self.client_id, safe="")
                
                async with httpx.AsyncClient() as client:
                    response = await client.post(
                        self.token_url,
                        auth=(encoded_client_id, self.client_secret),
                        data={"grant_type": "client_credentials", "scope": "api"},
                        timeout=10
                    )
                    response.raise_for_status()
                    data = response.json()
                    
                    self.access_token = data["access_token"]
                    expires_in = data.get("expires_in", 3600)
                    self.token_expires_at = datetime.utcnow() + timedelta(seconds=expires_in)
                    
                    logger.info(f"BarentsWatch token refreshed, expires in {expires_in}s")
                    return self.access_token
            except Exception as e:
                logger.error(f"Failed to get BarentsWatch access token: {e}")
                raise

    async def get(self, endpoint: str, params: Optional[dict] = None) -> dict:
        """Make an authenticated GET request to BarentsWatch API."""
        token = await self.get_access_token()
        
        try:
            async with httpx.AsyncClient() as client:
                headers = {"Authorization": f"Bearer {token}"}
                url = f"{self.api_base_url}{endpoint}"
                response = await client.get(url, headers=headers, params=params, timeout=15)
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.error(f"BarentsWatch API request failed: {e}")
            raise


class BarentsWatchService:
    """Service for fetching vessel and maritime data from BarentsWatch."""
    
    def __init__(self):
        self.oauth = BarentsWatchOAuth2()
        self._vessel_cache: Optional[dict] = None
        self._cache_timestamp: Optional[datetime] = None
        self._cache_ttl = timedelta(minutes=5)

    def is_cache_valid(self) -> bool:
        """Check if cached data is still valid."""
        if not self._cache_timestamp:
            return False
        return datetime.utcnow() - self._cache_timestamp < self._cache_ttl

    async def get_vessels_near_bounds(
        self,
        lat_min: float,
        lat_max: float,
        lon_min: float,
        lon_max: float,
        vessel_type: Optional[str] = None
    ) -> list[dict]:
        """Get vessels within geographic bounds.
        
        Args:
            lat_min: Minimum latitude
            lat_max: Maximum latitude
            lon_min: Minimum longitude
            lon_max: Maximum longitude
            vessel_type: Optional filter by vessel type
            
        Returns:
            List of vessel data
        """
        try:
            token = await self.oauth.get_access_token()
            endpoint = "/vessels"
            params = {
                "latitude_min": lat_min,
                "latitude_max": lat_max,
                "longitude_min": lon_min,
                "longitude_max": lon_max,
            }
            
            if vessel_type:
                params["vessel_type"] = vessel_type
            
            async with httpx.AsyncClient() as client:
                headers = {"Authorization": f"Bearer {token}"}
                url = f"{self.api_base_url}{endpoint}"
                response = await client.get(url, headers=headers, params=params, timeout=15)
                response.raise_for_status()
                data = response.json()
            
            vessels = data.get("vessels", []) if isinstance(data, dict) else data
            logger.info(f"Fetched {len(vessels)} vessels from BarentsWatch")
            return vessels
            
        except Exception as e:
            logger.warning(f"Failed to get vessels from BarentsWatch: {e}")
            # Return empty list on failure (no fallback - let caller handle)
            return []

    async def get_fishing_activity(self, geometry: Optional[dict] = None) -> list[dict]:
        """Get fishing activity data.
        
        Args:
            geometry: Optional GeoJSON geometry for filtering
            
        Returns:
            List of fishing activity records
        """
        try:
            endpoint = "/fishing-activity"
            data = await self.oauth.get(endpoint)
            return data.get("features", []) if isinstance(data, dict) else data
        except Exception as e:
            logger.error(f"Failed to get fishing activity: {e}")
            return []

    async def get_ais_positions(self, limit: int = 1000) -> list[dict]:
        """Get recent AIS positions.
        
        Args:
            limit: Maximum number of positions to return
            
        Returns:
            List of AIS position records
        """
        try:
            endpoint = "/ais"
            params = {"limit": limit}
            data = await self.oauth.get(endpoint, params)
            return data.get("positions", []) if isinstance(data, dict) else data
        except Exception as e:
            logger.error(f"Failed to get AIS positions: {e}")
            return []


# Global instance
barentswatch_service = BarentsWatchService()
