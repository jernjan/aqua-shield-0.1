"""
Weather API Client
Integrates weather data from multiple sources (YR.no, etc)
"""

import os
import json
import logging
from typing import Optional, Dict
import requests
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)


class WeatherClient:
    """Client for weather data from YR.no and other sources"""

    def __init__(self):
        # YR.no uses their own API, no auth needed but we should use user-agent
        self.yr_url = "https://api.met.no/weatherapi/locationforecast/2.0/complete"
        self.headers = {
            "User-Agent": "Kyst-Monitor/1.0 (monitoring@kyst-monitor.no)"
        }

    def get_forecast(self, latitude: float, longitude: float) -> Optional[Dict]:
        """
        Get weather forecast for a location using YR.no API
        Returns temperature, precipitation, wind, etc.
        """
        try:
            params = {
                "lat": latitude,
                "lon": longitude,
            }
            response = requests.get(
                self.yr_url,
                params=params,
                headers=self.headers,
                timeout=10
            )
            response.raise_for_status()
            
            data = response.json()
            logger.info(f"✅ Retrieved weather forecast for ({latitude}, {longitude})")
            return data
            
        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Failed to fetch weather: {e}")
            return None

    def get_current_conditions(self, latitude: float, longitude: float) -> Optional[Dict]:
        """Get current weather conditions (temperature, wind, etc)"""
        try:
            forecast = self.get_forecast(latitude, longitude)
            if forecast and "properties" in forecast and "timeseries" in forecast["properties"]:
                # Get first entry which is current conditions
                current = forecast["properties"]["timeseries"][0]
                logger.info(f"✅ Retrieved current conditions for ({latitude}, {longitude})")
                return current
            return None
            
        except Exception as e:
            logger.error(f"❌ Failed to parse current conditions: {e}")
            return None


if __name__ == "__main__":
    # Test the API
    logging.basicConfig(level=logging.INFO)
    
    print("\n🌤️ Testing Weather API...\n")
    client = WeatherClient()
    
    # Test 1: Get forecast for a sample location (Hardangerfjord)
    print("1️⃣ Fetching weather forecast...")
    forecast = client.get_forecast(latitude=60.3, longitude=6.1)
    if forecast:
        print(f"   ✅ Got forecast data")
        print(f"   Sample: {json.dumps(forecast, indent=2, default=str)[:300]}...")
    
    # Test 2: Get current conditions
    print("\n2️⃣ Fetching current conditions...")
    current = client.get_current_conditions(latitude=60.3, longitude=6.1)
    if current:
        print(f"   ✅ Got current conditions")
        print(f"   Data: {json.dumps(current, indent=2, default=str)[:300]}...")
