"""
Test BarentsWatch API
Run this to verify API integration is working
"""

import sys
import os
import logging

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.api_clients.barentswatch import BarentsWatchClient

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def test_barentswatch_auth():
    """Test getting authentication token"""
    print("\n" + "="*60)
    print("TEST 1: BarentsWatch Authentication")
    print("="*60)
    
    try:
        client = BarentsWatchClient()
        token = client.auth.get_token()
        
        if token:
            print("✅ PASS: Successfully obtained authentication token")
            print(f"   Token (first 50 chars): {token[:50]}...")
            return True
        else:
            print("❌ FAIL: No token received")
            return False
            
    except Exception as e:
        print(f"❌ FAIL: {e}")
        return False


def test_get_facilities():
    """Test fetching facilities"""
    print("\n" + "="*60)
    print("TEST 2: Get Facilities (FiskInfo)")
    print("="*60)
    
    try:
        client = BarentsWatchClient()
        facilities = client.get_facilities()
        
        if facilities and len(facilities) > 0:
            print(f"✅ PASS: Retrieved {len(facilities)} facilities")
            print(f"   Sample facility: {facilities[0]}")
            return True
        else:
            print("❌ FAIL: No facilities returned")
            return False
            
    except Exception as e:
        print(f"❌ FAIL: {e}")
        return False


def test_get_nais_status():
    """Test fetching NAIS status"""
    print("\n" + "="*60)
    print("TEST 3: Get NAIS Status")
    print("="*60)
    
    try:
        client = BarentsWatchClient()
        nais = client.get_nais_status()
        
        if nais and len(nais) > 0:
            print(f"✅ PASS: Retrieved NAIS data")
            print(f"   Sample: {nais[0]}")
            return True
        else:
            print("ℹ️ INFO: No NAIS data returned (endpoint may not have data)")
            return True
            
    except Exception as e:
        print(f"⚠️ WARNING: {e}")
        return False


def main():
    """Run all tests"""
    print("\n" + "="*60)
    print("🧪 BarentsWatch API Test Suite")
    print("="*60)
    
    results = []
    
    # Run tests
    results.append(("Authentication", test_barentswatch_auth()))
    results.append(("Get Facilities", test_get_facilities()))
    results.append(("Get NAIS Status", test_get_nais_status()))
    
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
