#!/usr/bin/env python3
"""
Test Copernicus Marine Service API for ocean currents
"""
import requests
import json

print("=" * 80)
print("COPERNICUS MARINE SERVICE - OCEAN CURRENT API TEST")
print("=" * 80)

# Copernicus Marine har flere ways to access:
# 1. Web viewer: https://marine.copernicus.eu/access-data/ocean-visualisation-tools
# 2. API/MOTU service
# 3. OpenDAP

# Test endpoints
print("\n[1] Checking Copernicus Marine Catalogue")

try:
    # Direct API call to Copernicus Marine catalogue
    url = "https://nrt.cmems-du.eu/motu-web/Motu"
    
    # List available products
    params = {
        "action": "listproducts"
    }
    
    r = requests.get(url, params=params, timeout=10)
    print(f"Status: {r.status_code}")
    print(f"Response length: {len(r.text)}")
    
    if r.status_code == 200:
        # Parse XML response
        print("\n✅ Connected to Copernicus Marine!")
        print("Available products exist in response")
        
        # Print first 500 chars
        print(f"\nResponse preview: {r.text[:500]}")
    else:
        print(f"Response: {r.text[:200]}")
        
except Exception as e:
    print(f"❌ Error: {e}")

# Alternative: Try OpenDAP endpoint
print("\n" + "=" * 80)
print("[2] Checking OpenDAP endpoints")

opendap_urls = [
    "http://my.cmems-du.eu/thredds/dodsC/",
    "http://oceandata.sci.gsfc.nasa.gov/thredds/dodsC/",
]

for url in opendap_urls:
    try:
        r = requests.head(url, timeout=5)
        print(f"{url}: {r.status_code}")
    except Exception as e:
        print(f"{url}: {str(e)[:50]}")

# Direct NETCDF download
print("\n" + "=" * 80)
print("[3] Check direct NetCDF datasets")

datasets = [
    "https://www.ncei.noaa.gov/products/etss-global-realtime-ocean-forecast/access",
]

for url in datasets:
    try:
        r = requests.get(url, timeout=5)
        print(f"{url}: {r.status_code}")
    except Exception as e:
        print(f"{url}: Connection failed")

print("\n" + "=" * 80)
print("INFO: Copernicus requires registration but is FREE")
print("Sign up at: https://marine.copernicus.eu/")
print("=" * 80)
