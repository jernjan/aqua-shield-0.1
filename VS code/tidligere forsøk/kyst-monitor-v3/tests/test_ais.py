"""
Test AIS API
Run this to verify AIS integration is working
"""

import sys
import os
import logging

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.api_clients.ais import AISClient

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def test_ais_auth():
    """Test getting authentication token"""
    print("\n" + "="*60)
    print("TEST 1: AIS Authentication")
    print("="*60)
    
    try:
        client = AISClient()
        token = client.auth.get_token()
        
        if token:
            print("✅ PASS: Successfully obtained AIS authentication token")
            print(f"   Token (first 50 chars): {token[:50]}...")
            return True
        else:
            print("❌ FAIL: No token received")
            return False
            
    except Exception as e:
        print(f"❌ FAIL: {e}")
        return False


def test_get_vessels():
    """Test fetching vessels in area"""
    print("\n" + "="*60)
    print("TEST 2: Get Vessels in Area")
    print("="*60)
    
    try:
        client = AISClient()
        # Test with Hardangerfjord area
        vessels = client.get_vessels_in_area(latitude=60.3, longitude=6.1, radius_km=30)
        
        print(f"✅ PASS: Retrieved vessel data")
        if vessels and len(vessels) > 0:
            print(f"   Found {len(vessels)} vessels in area")
            print(f"   Sample vessel: {vessels[0]}")
        else:
            print(f"   No vessels found (this is normal if no ships are in the area)")
        return True
            
    except Exception as e:
        print(f"❌ FAIL: {e}")
        return False


def main():
    """Run all tests"""
    print("\n" + "="*60)
    print("🚤 AIS API Test Suite")
    print("="*60)
    
    results = []
    
    # Run tests
    results.append(("Authentication", test_ais_auth()))
    results.append(("Get Vessels", test_get_vessels()))
    
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
