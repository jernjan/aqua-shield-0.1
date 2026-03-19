"""Service for AIS (Automatic Identification System) data integration."""
import httpx
import json
from typing import Optional
from datetime import datetime
from app.core.config import settings
from app.logging.logger import logger


class AISService:
    """Service to interact with AIS API for vessel tracking."""
    
    BASE_URL = "https://api.ais.service.com/v1"  # Replace with actual AIS service
    
    def __init__(self):
        self.api_key = settings.AIS_API_KEY
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
    
    async def get_vessels_near_location(
        self,
        latitude: float,
        longitude: float,
        radius_km: float = 50
    ) -> Optional[dict]:
        """Get vessels operating near a farm location."""
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                url = f"{self.BASE_URL}/vessels"
                params = {
                    "lat": latitude,
                    "lng": longitude,
                    "radius": radius_km
                }
                
                response = await client.get(
                    url,
                    headers=self.headers,
                    params=params
                )
                response.raise_for_status()
                
                data = response.json()
                logger.info(f"Retrieved AIS data for location {latitude},{longitude}")
                return data
                
        except Exception as e:
            logger.error(f"Error fetching AIS data: {str(e)}")
            return None
    
    async def get_vessel_by_mmsi(self, mmsi: str) -> Optional[dict]:
        """Get detailed vessel information by MMSI number."""
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                url = f"{self.BASE_URL}/vessels/{mmsi}"
                
                response = await client.get(
                    url,
                    headers=self.headers
                )
                response.raise_for_status()
                
                data = response.json()
                logger.info(f"Retrieved vessel details for MMSI {mmsi}")
                return data
                
        except Exception as e:
            logger.error(f"Error fetching vessel details: {str(e)}")
            return None
    
    async def get_vessel_track(
        self,
        mmsi: str,
        hours: int = 24
    ) -> Optional[dict]:
        """Get vessel track history."""
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                url = f"{self.BASE_URL}/vessels/{mmsi}/track"
                params = {"hours": hours}
                
                response = await client.get(
                    url,
                    headers=self.headers,
                    params=params
                )
                response.raise_for_status()
                
                data = response.json()
                logger.info(f"Retrieved track for vessel {mmsi}")
                return data
                
        except Exception as e:
            logger.error(f"Error fetching vessel track: {str(e)}")
            return None
    
    def calculate_proximity_risk(
        self,
        farm_lat: float,
        farm_lng: float,
        vessel_lat: float,
        vessel_lng: float
    ) -> float:
        """Calculate risk score based on vessel proximity."""
        from math import radians, cos, sin, asin, sqrt
        
        # Haversine formula for distance
        lon1, lat1, lon2, lat2 = map(
            radians,
            [farm_lng, farm_lat, vessel_lng, vessel_lat]
        )
        
        dlon = lon2 - lon1
        dlat = lat2 - lat1
        a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
        c = 2 * asin(sqrt(a))
        km = 6371 * c
        
        # Risk increases as distance decreases
        if km < 1:
            return 1.0  # Critical
        elif km < 5:
            return 0.8  # High
        elif km < 20:
            return 0.5  # Medium
        elif km < 50:
            return 0.2  # Low
        else:
            return 0.0  # No risk
