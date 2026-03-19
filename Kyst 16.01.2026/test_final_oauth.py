#!/usr/bin/env python3
"""
Test BarentsWatch APIs with correct OAuth2 Client Credentials format.
"""

import requests
import os
from dotenv import load_dotenv
from pathlib import Path
import json

load_dotenv()

class BarentsWatchOAuth2:
    """Handle OAuth2 Client Credentials for BarentsWatch APIs"""
    
    def __init__(self, client_id, client_secret):
        self.client_id = client_id
        self.client_secret = client_secret
        self.token = None
        self.token_url = "https://id.barentswatch.no/connect/token"
        self.api_base = "https://www.barentswatch.no/bwapi"
        
    def get_token(self):
        """Get OAuth2 access token using Client Credentials grant"""
        if self.token:
            return self.token
            
        print(f"  Requesting OAuth2 token...")
        print(f"  Client ID: {self.client_id}")
        
        auth_data = {
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "scope": "api",
            "grant_type": "client_credentials"
        }
        
        try:
            response = requests.post(self.token_url, data=auth_data, timeout=10)
            print(f"  Token response status: {response.status_code}")
            
            if response.status_code == 200:
                token_data = response.json()
                self.token = token_data.get("access_token")
                expires_in = token_data.get("expires_in", "unknown")
                print(f"  Token obtained! (expires in {expires_in}s)")
                return self.token
            else:
                print(f"  ERROR: Failed to get token")
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
    
    auth = BarentsWatchOAuth2(client_id, client_secret)
    headers = auth.get_headers()
    
    if not headers:
        print("  Authentication failed!")
        return False
    
    url = f"{auth.api_base}/v1/geodata/fishhealth/localities"
    print(f"  URL: {url}")
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        print(f"  Response status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            count = len(data) if isinstance(data, list) else 1
            print(f"SUCCESS: Got {count} facility records!")
            
            if isinstance(data, list) and len(data) > 0:
                print(f"\nSample facilities (first 3):")
                for i, facility in enumerate(data[:3]):
                    print(f"  [{i+1}] {facility.get('name', 'N/A')}")
                    print(f"      ID: {facility.get('localityId', 'N/A')}")
                    print(f"      Municipality: {facility.get('municipality', 'N/A')}")
                    print(f"      Coordinates: {facility.get('latitude', 'N/A')}, {facility.get('longitude', 'N/A')}")
            return True
        else:
            print(f"FAILED: Status {response.status_code}")
            print(f"Response: {response.text[:500]}")
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
        print("ERROR: Credentials not in .env")
        return False
    
    auth = BarentsWatchOAuth2(client_id, client_secret)
    headers = auth.get_headers()
    
    if not headers:
        print("  Authentication failed!")
        return False
    
    from datetime import datetime
    year = datetime.now().year
    week = datetime.now().isocalendar()[1]
    
    url = f"{auth.api_base}/v1/geodata/fishhealth/{year}/{week}"
    print(f"  URL: {url}")
    print(f"  Week: {week}/{year}")
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        print(f"  Response status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"SUCCESS: Got NAIS data for week {week}/{year}!")
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
            print(f"Response: {response.text[:500]}")
            return False
    except Exception as e:
        print(f"ERROR: {str(e)}")
        return False


def test_copernicus():
    """Test Copernicus data"""
    print("\n" + "="*60)
    print("TEST 3: Copernicus Marine Data")
    print("="*60)
    
    copernicus_dir = Path("copernicus_data")
    
    if copernicus_dir.exists():
        nc_files = list(copernicus_dir.glob("*.nc"))
        if nc_files:
            print(f"SUCCESS: Found {len(nc_files)} NetCDF file(s)!")
            for f in nc_files:
                size_mb = f.stat().st_size / (1024*1024)
                print(f"  - {f.name}")
                print(f"    Size: {size_mb:.2f} MB")
                
                try:
                    import xarray as xr
                    ds = xr.open_dataset(str(f))
                    print(f"    Variables: {list(ds.data_vars.keys())}")
                    print(f"    Dimensions: time={ds.dims.get('time', '?')}, depth={ds.dims.get('depth', '?')}, lat={ds.dims.get('latitude', '?')}, lon={ds.dims.get('longitude', '?')}")
                    ds.close()
                except:
                    pass
            
            return True
        else:
            print("FAILED: No NetCDF files found")
            return False
    else:
        print("FAILED: copernicus_data/ directory not found")
        return False


def main():
    print("\n" + "="*70)
    print("AQUACULTURE RISK SYSTEM - API VERIFICATION TEST")
    print("="*70)
    
    results = {
        "BarentsWatch Facilities": test_facilities(),
        "BarentsWatch NAIS": test_nais(),
        "Copernicus Data": test_copernicus(),
    }
    
    print("\n" + "="*70)
    print("SUMMARY")
    print("="*70)
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test_name, passed_test in results.items():
        status = "✅ PASSED" if passed_test else "❌ FAILED"
        print(f"  {test_name}: {status}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n✅✅✅ ALL SYSTEMS GO! READY TO BUILD API ✅✅✅")
    elif passed >= 2:
        print("\n⚠️  Most systems working - proceed with caution")
    else:
        print("\n❌ Critical issues - review errors above")


if __name__ == "__main__":
    main()
