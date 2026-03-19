#!/usr/bin/env python3
"""
Systematisk test av alle relevante Fishhealth API endepunkter
"""
import requests
from dotenv import load_dotenv
import os
import json
from datetime import datetime

load_dotenv()

BARENTSWATCH_CLIENT_ID = os.getenv("BARENTSWATCH_CLIENT_ID")
BARENTSWATCH_CLIENT_SECRET = os.getenv("BARENTSWATCH_CLIENT_SECRET")
BARENTSWATCH_AUTH_URL = "https://id.barentswatch.no/connect/token"
BARENTSWATCH_BASE_URL = os.getenv("BARENTSWATCH_API_BASE_URL")

# Get token
print("=" * 80)
print("FISHHEALTH API - COMPREHENSIVE TEST")
print("=" * 80)

print("\n[AUTH] Getting OAuth2 token...")
token_response = requests.post(
    BARENTSWATCH_AUTH_URL,
    data={
        "client_id": BARENTSWATCH_CLIENT_ID,
        "client_secret": BARENTSWATCH_CLIENT_SECRET,
        "grant_type": "client_credentials",
        "scope": "api"
    },
    timeout=10
)

if token_response.status_code != 200:
    print(f"❌ Token error: {token_response.status_code}")
    exit(1)

token = token_response.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}
print("✅ Token obtained\n")

# Get current week
year = datetime.now().year
week = datetime.now().isocalendar()[1]

# Test endpoints
tests = [
    # Facilities
    ("📍 Facilities List", f"{BARENTSWATCH_BASE_URL}/v1/geodata/fishhealth/localities", {}),
    
    # National overview
    ("📊 National Overview (Week)", f"{BARENTSWATCH_BASE_URL}/v1/geodata/fishhealth/{year}/{week}", {}),
    
    # Locality summary
    ("📋 Locality Summary (All)", f"{BARENTSWATCH_BASE_URL}/v1/geodata/fishhealth/locality/{year}/{week}", {}),
    
    # Specific locality (test with first facility)
    ("🏢 Specific Locality (Sample)", f"{BARENTSWATCH_BASE_URL}/v1/geodata/fishhealth/locality/12870/{year}/{week}", {}),
    
    # Disease zones
    ("🦠 ILA Protection Zones", f"{BARENTSWATCH_BASE_URL}/v1/geodata/fishhealth/ilaprotectionzone/{year}/{week}", {}),
    ("🦠 PD Protection Zones", f"{BARENTSWATCH_BASE_URL}/v1/geodata/fishhealth/pdprotectionzone/{year}/{week}", {}),
    
    # Municipalities
    ("🏙️ Municipalities List", f"{BARENTSWATCH_BASE_URL}/v1/geodata/municipalities", {}),
    
    # Species
    ("🐟 Species List", f"{BARENTSWATCH_BASE_URL}/v1/geodata/fishhealth/species", {}),
    
    # Escape data
    ("🚨 Locality with Escapes", f"{BARENTSWATCH_BASE_URL}/v1/geodata/fishhealth/localitieswithescapes/{year}/{week}", {}),
    
    # Vessel tracks
    ("⛵ Latest Vessel Positions", f"{BARENTSWATCH_BASE_URL}/v1/geodata/fishhealth/vesselslatestpositions", {}),
]

results = []

for label, url, params in tests:
    try:
        print(f"\n{label}")
        print(f"  URL: {url}")
        
        r = requests.get(url, headers=headers, params=params, timeout=10)
        
        print(f"  Status: {r.status_code}")
        
        if r.status_code == 200:
            try:
                data = r.json()
                
                if isinstance(data, list):
                    count = len(data)
                    print(f"  ✅ SUCCESS: {count} records")
                    
                    if count > 0:
                        print(f"     Fields: {list(data[0].keys())[:5]}...")
                        results.append((label, "✅", count))
                    else:
                        print(f"     ⚠️  Empty list")
                        results.append((label, "⚠️ Empty", 0))
                        
                elif isinstance(data, dict):
                    keys = list(data.keys())
                    print(f"  ✅ SUCCESS: Dict with {len(keys)} fields")
                    print(f"     Fields: {keys[:5]}...")
                    results.append((label, "✅", len(keys)))
                else:
                    print(f"  Data type: {type(data)}")
                    results.append((label, "✅", "other"))
                    
            except json.JSONDecodeError:
                print(f"  ❌ Not JSON: {r.text[:100]}")
                results.append((label, "❌", "invalid"))
        else:
            print(f"  ❌ Error: {r.status_code}")
            try:
                error = r.json()
                print(f"     {error.get('title', error.get('message', ''))}")
            except:
                pass
            results.append((label, "❌", r.status_code))
            
    except Exception as e:
        print(f"  ❌ Exception: {str(e)[:80]}")
        results.append((label, "❌", str(e)[:30]))

# Summary
print("\n" + "=" * 80)
print("SUMMARY")
print("=" * 80)

print("\n{:<40} | {:<15} | {:<10}".format("Endpoint", "Status", "Data"))
print("-" * 80)

for label, status, data in results:
    print("{:<40} | {:<15} | {:<10}".format(label, status, str(data)[:10]))

# Count successful
successes = sum(1 for _, status, _ in results if "✅" in status)
print(f"\nSuccessful: {successes}/{len(results)}")

print("\n" + "=" * 80)
