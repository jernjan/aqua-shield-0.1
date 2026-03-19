#!/usr/bin/env python
"""Test script for BarentsWatch ArcticInfo API integration."""

import sys
import json
from src.api.clients.barentswatch import BarentsWatchClient
from src.api.risk_engine import RiskEngine

def test_arcticinfo():
    """Test fetching real ocean current data from BarentsWatch."""
    
    print("=" * 60)
    print("Testing BarentsWatch ArcticInfo API (Real Ocean Current Data)")
    print("=" * 60)
    
    try:
        client = BarentsWatchClient()
        print("\n✅ BarentsWatchClient initialized")
        
        # Test locations in Barentshavet
        test_locations = [
            {"name": "Barentshavet North", "lat": 71.5, "lon": 20.3},
            {"name": "Barentshavet West", "lat": 70.8, "lon": 18.5},
            {"name": "Near Nordkapp", "lat": 71.1, "lon": 25.5},
        ]
        
        print("\nFetching real ocean current data for test locations:\n")
        
        for loc in test_locations:
            print(f"📍 {loc['name']} ({loc['lat']:.1f}°N, {loc['lon']:.1f}°E)")
            
            data = client.get_arcticinfo(loc['lat'], loc['lon'])
            
            if data:
                print("   ✅ Data received")
                print(f"   Raw response keys: {list(data.keys())}")
                
                # Pretty print the data
                print(f"   Data: {json.dumps(data, indent=6)}")
            else:
                print("   ❌ No data returned (API may not be available yet)")
            
            print()
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    return True


def test_risk_engine_with_currents():
    """Test RiskEngine water exchange scoring with real current data."""
    
    print("\n" + "=" * 60)
    print("Testing RiskEngine Water Exchange Scoring")
    print("=" * 60)
    
    try:
        # We need some dummy facility data to initialize RiskEngine
        dummy_facilities = [
            {
                "locality": {"no": "TEST001", "name": "Test Facility"},
                "geometry": {"coordinates": [20.3, 71.5]},
                "healthstatus": {}
            }
        ]
        
        engine = RiskEngine(dummy_facilities)
        print("✅ RiskEngine initialized\n")
        
        # Test scoring at different locations
        test_points = [
            {"name": "Current test point 1", "lat": 71.5, "lon": 20.3},
            {"name": "Current test point 2", "lat": 70.8, "lon": 18.5},
        ]
        
        for point in test_points:
            print(f"Testing water exchange score at {point['name']}:")
            score = engine.score_water_exchange(point['lat'], point['lon'])
            
            if score is not None:
                print(f"   ✅ Score: {score:.1f}")
                if score >= 70:
                    print("      → High risk (still water)")
                elif score >= 50:
                    print("      → Moderate risk (weak current)")
                elif score >= 30:
                    print("      → Good dispersal (moderate current)")
                else:
                    print("      → Very good dispersal (strong current)")
            else:
                print("   ⚠️  Score: None (no data available)")
            print()
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    return True


if __name__ == "__main__":
    print("\nStarting ArcticInfo API Tests...\n")
    
    result1 = test_arcticinfo()
    result2 = test_risk_engine_with_currents()
    
    print("\n" + "=" * 60)
    if result1 and result2:
        print("✅ All tests passed!")
    else:
        print("⚠️  Some tests failed - check output above")
    print("=" * 60)
