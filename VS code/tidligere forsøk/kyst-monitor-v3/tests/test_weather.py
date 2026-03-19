"""
Test Weather API
Run this to verify weather data integration is working
"""

import sys
import os
import logging

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.api_clients.weather import WeatherClient

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def test_get_forecast():
    """Test getting weather forecast"""
    print("\n" + "="*60)
    print("TEST 1: Get Weather Forecast")
    print("="*60)
    
    try:
        client = WeatherClient()
        forecast = client.get_forecast(latitude=60.3, longitude=6.1)
        
        if forecast:
            print("✅ PASS: Retrieved weather forecast")
            print(f"   Data keys: {list(forecast.keys())}")
            return True
        else:
            print("❌ FAIL: No forecast data")
            return False
            
    except Exception as e:
        print(f"❌ FAIL: {e}")
        return False


def test_get_current_conditions():
    """Test getting current weather conditions"""
    print("\n" + "="*60)
    print("TEST 2: Get Current Weather Conditions")
    print("="*60)
    
    try:
        client = WeatherClient()
        current = client.get_current_conditions(latitude=60.3, longitude=6.1)
        
        if current:
            print("✅ PASS: Retrieved current conditions")
            if "data" in current:
                print(f"   Temperature data available: {list(current['data'].keys())}")
            return True
        else:
            print("❌ FAIL: No current conditions data")
            return False
            
    except Exception as e:
        print(f"❌ FAIL: {e}")
        return False


def main():
    """Run all tests"""
    print("\n" + "="*60)
    print("🌤️ Weather API Test Suite")
    print("="*60)
    
    results = []
    
    # Run tests
    results.append(("Get Forecast", test_get_forecast()))
    results.append(("Get Current Conditions", test_get_current_conditions()))
    
    # Summary
    print("\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    print("="*60 + "\n")
    
    return passed == total


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
