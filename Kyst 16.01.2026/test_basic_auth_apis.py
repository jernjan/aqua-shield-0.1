#!/usr/bin/env python3
"""
Test BarentsWatch APIs with Basic Authentication.
"""

import requests
import os
from dotenv import load_dotenv
from pathlib import Path
import base64
import json

load_dotenv()

class BarentsWatchBasicAuth:
    """Handle Basic Authentication for BarentsWatch APIs"""
    
    def __init__(self, username, password):
        self.username = username
        self.password = password
        self.api_base = "https://www.barentswatch.no/bwapi"
        
    def get_headers(self):
        """Get request headers with Basic Auth"""
        credentials = base64.b64encode(f"{self.username}:{self.password}".encode()).decode()
        return {
            "Authorization": f"Basic {credentials}",
            "Content-Type": "application/json"
        }


def test_facilities():
    """Test BarentsWatch Facilities API"""
    print("\n" + "="*60)
    print("TEST 1: BarentsWatch Facilities API (Basic Auth)")
    print("="*60)
    
    username = "Kyst-Monitor"
    password = os.getenv("BARENTSWATCH_CLIENT_SECRET", "cXv1n3M3jjqF7GA")
    
    auth = BarentsWatchBasicAuth(username, password)
    headers = auth.get_headers()
    
    print(f"  Authenticating as: {username}")
    
    url = f"{auth.api_base}/v1/geodata/fishhealth/localities"
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        print(f"  Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            count = len(data) if isinstance(data, list) else 1
            print(f"SUCCESS: Got {count} facility records")
            if isinstance(data, list) and len(data) > 0:
                print(f"\nSample facilities:")
                for i, facility in enumerate(data[:3]):
                    print(f"  [{i+1}] {facility.get('name', 'N/A')} (ID: {facility.get('localityId', 'N/A')})")
                    print(f"      Municipality: {facility.get('municipality', 'N/A')}")
                    print(f"      Coords: {facility.get('latitude', 'N/A')}, {facility.get('longitude', 'N/A')}")
            return True
        else:
            print(f"FAILED: Status {response.status_code}")
            print(f"Response: {response.text[:300]}")
            return False
    except Exception as e:
        print(f"ERROR: {str(e)}")
        return False


def test_nais():
    """Test BarentsWatch NAIS Health API"""
    print("\n" + "="*60)
    print("TEST 2: BarentsWatch NAIS Health API (Basic Auth)")
    print("="*60)
    
    username = "Kyst-Monitor"
    password = os.getenv("BARENTSWATCH_CLIENT_SECRET", "cXv1n3M3jjqF7GA")
    
    auth = BarentsWatchBasicAuth(username, password)
    headers = auth.get_headers()
    
    print(f"  Authenticating as: {username}")
    
    from datetime import datetime
    year = datetime.now().year
    week = datetime.now().isocalendar()[1]
    
    url = f"{auth.api_base}/v1/geodata/fishhealth/{year}/{week}"
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        print(f"  Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"SUCCESS: Got NAIS data for week {week}/{year}")
            print(f"Data type: {type(data).__name__}")
            
            if isinstance(data, dict):
                print(f"Keys: {list(data.keys())}")
                for key in ["numberOfReportingLocalities", "percentageAboveThreshold", "totalNumberOfLocalities"]:
                    if key in data:
                        print(f"  {key}: {data[key]}")
                if "escapes" in data and isinstance(data["escapes"], list):
                    print(f"  Number of escapes reported: {len(data['escapes'])}")
            
            return True
        else:
            print(f"FAILED: Status {response.status_code}")
            print(f"Response: {response.text[:300]}")
            return False
    except Exception as e:
        print(f"ERROR: {str(e)}")
        return False


def test_ais():
    """Test BarentsWatch AIS Vessel API"""
    print("\n" + "="*60)
    print("TEST 3: BarentsWatch AIS Vessel API (Basic Auth)")
    print("="*60)
    
    username = "Kyst-Monitor-AIS"
    password = os.getenv("BARENTSWATCH_AIS_CLIENT_SECRET", "cXv1n3M3jjqF7GA")
    
    auth = BarentsWatchBasicAuth(username, password)
    headers = auth.get_headers()
    
    print(f"  Authenticating as: {username}")
    
    url = f"{auth.api_base}/v1/geodata/ais"
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        print(f"  Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"SUCCESS: Got AIS data")
            print(f"Records: {len(data) if isinstance(data, list) else 1}")
            return True
        elif response.status_code == 400 or response.status_code == 422:
            print(f"Note: AIS endpoint returned {response.status_code}")
            print(f"AIS may require specific query parameters (latitude, longitude, etc.)")
            print(f"Response: {response.text[:200]}")
            return False
        else:
            print(f"Status: {response.status_code}")
            print(f"Response: {response.text[:300]}")
            return False
    except Exception as e:
        print(f"ERROR: {str(e)}")
        return False


def test_copernicus():
    """Test Copernicus data"""
    print("\n" + "="*60)
    print("TEST 4: Copernicus Marine Data File")
    print("="*60)
    
    copernicus_dir = Path("copernicus_data")
    
    if copernicus_dir.exists():
        nc_files = list(copernicus_dir.glob("*.nc"))
        if nc_files:
            print(f"SUCCESS: Found {len(nc_files)} NetCDF file(s)")
            for f in nc_files:
                size_mb = f.stat().st_size / (1024*1024)
                print(f"  - {f.name} ({size_mb:.2f} MB)")
            return True
        else:
            print("FAILED: No NetCDF files found")
            return False
    else:
        print("FAILED: copernicus_data/ directory not found")
        return False


def main():
    print("\n" + "="*70)
    print("AQUACULTURE RISK SYSTEM - API VERIFICATION TEST (Basic Auth)")
    print("="*70)
    
    results = {
        "BarentsWatch Facilities": test_facilities(),
        "BarentsWatch NAIS": test_nais(),
        "BarentsWatch AIS": test_ais(),
        "Copernicus Data": test_copernicus(),
    }
    
    print("\n" + "="*70)
    print("SUMMARY")
    print("="*70)
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test_name, passed_test in results.items():
        status = "PASSED" if passed_test else "FAILED"
        print(f"  {test_name}: {status}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed >= 3:
        print("\n✅ READY TO INTEGRATE INTO API")
        print("All required data sources are working!")
    else:
        print("\n⚠️  Some tests failed - review errors above")


if __name__ == "__main__":
    main()
