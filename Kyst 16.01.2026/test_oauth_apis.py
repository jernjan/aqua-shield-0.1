#!/usr/bin/env python3
"""
Test BarentsWatch APIs with OAuth2 authentication.
"""

import requests
import os
from dotenv import load_dotenv
from pathlib import Path
import json

load_dotenv()

class BarentsWatchAuth:
    """Handle OAuth2 authentication for BarentsWatch APIs"""
    
    def __init__(self, client_id, client_secret):
        self.client_id = client_id
        self.client_secret = client_secret
        self.token = None
        self.token_url = "https://id.barentswatch.no/connect/token"
        self.api_base = "https://www.barentswatch.no/bwapi"
        
    def get_token(self):
        """Get OAuth2 access token"""
        if self.token:
            return self.token
            
        print(f"  Requesting OAuth2 token for: {self.client_id}...")
        
        auth_data = {
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "scope": "api",
            "grant_type": "client_credentials"
        }
        
        try:
            response = requests.post(self.token_url, data=auth_data, timeout=10)
            if response.status_code == 200:
                token_data = response.json()
                self.token = token_data.get("access_token")
                print(f"  Token obtained: {self.token[:20]}...")
                return self.token
            else:
                print(f"  ERROR: Failed to get token. Status: {response.status_code}")
                print(f"  Response: {response.text}")
                return None
        except Exception as e:
            print(f"  ERROR: {str(e)}")
            return None
    
    def get_headers(self):
        """Get request headers with authorization"""
        token = self.get_token()
        if not token:
            return None
        return {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }


def test_facilities():
    """Test BarentsWatch Facilities API"""
    print("\n" + "="*60)
    print("TEST 1: BarentsWatch Facilities API")
    print("="*60)
    
    client_id = os.getenv("BARENTSWATCH_CLIENT_ID")
    client_secret = os.getenv("BARENTSWATCH_CLIENT_SECRET")
    
    if not client_id or not client_secret:
        print("ERROR: BARENTSWATCH_CLIENT_ID or CLIENT_SECRET not in .env")
        return False
    
    auth = BarentsWatchAuth(client_id, client_secret)
    headers = auth.get_headers()
    
    if not headers:
        return False
    
    url = f"{auth.api_base}/v1/geodata/fishhealth/localities"
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        if response.status_code == 200:
            data = response.json()
            count = len(data) if isinstance(data, list) else 1
            print(f"SUCCESS: Got {count} facility records")
            if isinstance(data, list) and len(data) > 0:
                print(f"\nSample facility:")
                print(f"  ID: {data[0].get('localityId', 'N/A')}")
                print(f"  Name: {data[0].get('name', 'N/A')}")
                print(f"  Municipality: {data[0].get('municipality', 'N/A')}")
                print(f"  Coordinates: {data[0].get('latitude', 'N/A')}, {data[0].get('longitude', 'N/A')}")
            return True
        else:
            print(f"FAILED: Status {response.status_code}")
            print(f"Response: {response.text[:200]}")
            return False
    except Exception as e:
        print(f"ERROR: {str(e)}")
        return False


def test_nais():
    """Test BarentsWatch NAIS Health API"""
    print("\n" + "="*60)
    print("TEST 2: BarentsWatch NAIS Health API")
    print("="*60)
    
    client_id = os.getenv("BARENTSWATCH_CLIENT_ID")
    client_secret = os.getenv("BARENTSWATCH_CLIENT_SECRET")
    
    if not client_id or not client_secret:
        print("ERROR: BARENTSWATCH_CLIENT_ID or CLIENT_SECRET not in .env")
        return False
    
    auth = BarentsWatchAuth(client_id, client_secret)
    headers = auth.get_headers()
    
    if not headers:
        return False
    
    from datetime import datetime
    year = datetime.now().year
    week = datetime.now().isocalendar()[1]
    
    url = f"{auth.api_base}/v1/geodata/fishhealth/{year}/{week}"
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        if response.status_code == 200:
            data = response.json()
            print(f"SUCCESS: Got NAIS data for week {week}/{year}")
            print(f"Data type: {type(data).__name__}")
            
            if isinstance(data, dict):
                print(f"Keys: {list(data.keys())}")
                for key in ["numberOfReportingLocalities", "percentageAboveThreshold"]:
                    if key in data:
                        print(f"  {key}: {data[key]}")
                if "escapes" in data and isinstance(data["escapes"], list):
                    print(f"  Number of escapes reported: {len(data['escapes'])}")
            
            return True
        else:
            print(f"FAILED: Status {response.status_code}")
            print(f"Response: {response.text[:200]}")
            return False
    except Exception as e:
        print(f"ERROR: {str(e)}")
        return False


def test_ais():
    """Test BarentsWatch AIS API"""
    print("\n" + "="*60)
    print("TEST 3: BarentsWatch AIS Vessel API")
    print("="*60)
    
    client_id = os.getenv("BARENTSWATCH_AIS_CLIENT_ID")
    client_secret = os.getenv("BARENTSWATCH_AIS_CLIENT_SECRET")
    
    if not client_id or not client_secret:
        print("ERROR: BARENTSWATCH_AIS_CLIENT_ID or CLIENT_SECRET not in .env")
        return False
    
    auth = BarentsWatchAuth(client_id, client_secret)
    headers = auth.get_headers()
    
    if not headers:
        return False
    
    # Try AIS endpoint (may not be available)
    url = f"{auth.api_base}/v1/geodata/ais/positions"
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        if response.status_code == 200:
            data = response.json()
            print(f"SUCCESS: Got AIS data")
            print(f"Records: {len(data) if isinstance(data, list) else 1}")
            return True
        else:
            print(f"Status: {response.status_code}")
            print(f"Note: AIS endpoint may require specific parameters or permissions")
            print(f"Response: {response.text[:200]}")
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
    print("AQUACULTURE RISK SYSTEM - API VERIFICATION TEST (WITH OAuth2)")
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
    else:
        print("\n⚠️  Some tests failed - check credentials and endpoints")


if __name__ == "__main__":
    main()
