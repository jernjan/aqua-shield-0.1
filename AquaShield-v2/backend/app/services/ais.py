"""AIS (Automatic Identification System) integration service"""
import httpx
from typing import Optional, List, Dict
from ..utils.logger import logger


class AISService:
    """Service for AIS vessel tracking data"""
    
    BASE_URL = "https://www.barentswatch.no/api/v2"
    
    def __init__(self):
        self.client = httpx.Client(timeout=30.0)
    
    async def get_vessels(self, area: str = "barentsregion") -> List[Dict]:
        """Fetch vessels in specified area"""
        try:
            url = f"{self.BASE_URL}/ais/{area}"
            
            response = self.client.get(url)
            response.raise_for_status()
            
            logger.info(f"Fetched vessels from AIS for area: {area}")
            return response.json()
        except Exception as e:
            logger.error(f"Error fetching AIS vessels: {e}")
            return []
    
    async def get_vessel_by_mmsi(self, mmsi: str) -> Optional[Dict]:
        """Fetch vessel details by MMSI"""
        try:
            url = f"{self.BASE_URL}/ais/vessel/{mmsi}"
            
            response = self.client.get(url)
            response.raise_for_status()
            
            return response.json()
        except Exception as e:
            logger.error(f"Error fetching AIS vessel {mmsi}: {e}")
            return None
    
    async def get_wellboats(self) -> List[Dict]:
        """Fetch all wellboat vessels"""
        try:
            url = f"{self.BASE_URL}/ais/wellboats"
            
            response = self.client.get(url)
            response.raise_for_status()
            
            logger.info("Fetched wellboats from AIS")
            return response.json()
        except Exception as e:
            logger.error(f"Error fetching wellboats: {e}")
            return []
    
    def close(self):
        """Close HTTP client"""
        self.client.close()
