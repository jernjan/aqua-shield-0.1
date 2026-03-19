#!/usr/bin/env python3
"""
Raw test of BarentsWatch NAIS Health API
No database, no abstraction - just pure HTTP calls
"""
import requests
import json
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv

# Load environment from .env
load_dotenv()

# Configuration
BARENTSWATCH_CLIENT_ID = os.getenv("BARENTSWATCH_CLIENT_ID", "")
BARENTSWATCH_CLIENT_SECRET = os.getenv("BARENTSWATCH_CLIENT_SECRET", "")
BARENTSWATCH_AUTH_URL = "https://id.barentswatch.no/connect/token"
BARENTSWATCH_API_URL = os.getenv("BARENTSWATCH_API_BASE_URL", "https://www.barentswatch.no/bwapi")

print("=" * 70)
print("RAW BarentsWatch NAIS Health API TEST")
print("=" * 70)

# Step 1: Get OAuth2 token
print("\n[STEP 1] Getting OAuth2 token...")
print(f"Client ID: {BARENTSWATCH_CLIENT_ID[:20]}..." if BARENTSWATCH_CLIENT_ID else "No Client ID set!")
print(f"Client Secret: {BARENTSWATCH_CLIENT_SECRET[:20]}..." if BARENTSWATCH_CLIENT_SECRET else "No Client Secret set!")

if not BARENTSWATCH_CLIENT_ID or not BARENTSWATCH_CLIENT_SECRET:
    print("\n❌ ERROR: Environment variables not set!")
    print("Need: BARENTSWATCH_CLIENT_ID and BARENTSWATCH_CLIENT_SECRET")
    exit(1)

try:
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
        print(f"❌ Token request failed: {token_response.status_code}")
        print(f"Response: {token_response.text}")
        exit(1)
    
    token_data = token_response.json()
    access_token = token_data.get("access_token")
    
    if not access_token:
        print(f"❌ No access token in response: {token_data}")
        exit(1)
    
    print(f"✅ Token obtained: {access_token[:50]}...")
    
except Exception as e:
    print(f"❌ Token request error: {e}")
    exit(1)

# Step 2: Test NAIS Health endpoint
print("\n[STEP 2] Testing NAIS Health endpoint...")

# Get current year and week
today = datetime.now()
year = today.year
week = today.isocalendar()[1]

url = f"{BARENTSWATCH_API_URL}/geodata/fishhealth/{year}/{week}"
print(f"URL: {url}")

headers = {
    "Authorization": f"Bearer {access_token}",
    "Content-Type": "application/json"
}

try:
    response = requests.get(url, headers=headers, timeout=10)
    
    print(f"Status Code: {response.status_code}")
    print(f"Response Headers: {dict(response.headers)}")
    
    if response.status_code == 200:
        try:
            data = response.json()
            print(f"\n✅ RESPONSE OK")
            print(f"Response type: {type(data)}")
            
            if isinstance(data, list):
                print(f"Record count: {len(data)}")
                if len(data) > 0:
                    print(f"\nFirst record (sample):")
                    print(json.dumps(data[0], indent=2, ensure_ascii=False))
                else:
                    print("⚠️  Response is empty list - no records returned")
            elif isinstance(data, dict):
                print(f"Response keys: {list(data.keys())}")
                print(f"Full response:\n{json.dumps(data, indent=2, ensure_ascii=False)}")
            else:
                print(f"Response: {data}")
                
        except json.JSONDecodeError as e:
            print(f"❌ Response is not valid JSON: {e}")
            print(f"Raw response: {response.text[:500]}")
    else:
        print(f"❌ API returned error: {response.status_code}")
        print(f"Response: {response.text[:500]}")
        
except Exception as e:
    print(f"❌ Request error: {e}")

# Step 3: Test with different parameters
print("\n[STEP 3] Testing with recent weeks...")

headers = {
    "Authorization": f"Bearer {access_token}",
    "Content-Type": "application/json"
}

for weeks_back in [0, 1, 2, 4]:
    check_date = today - timedelta(weeks=weeks_back)
    check_year = check_date.year
    check_week = check_date.isocalendar()[1]
    
    url = f"{BARENTSWATCH_API_URL}/geodata/fishhealth/{check_year}/{check_week}"
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            record_count = len(data) if isinstance(data, list) else 0
            print(f"Week {check_week} ({check_year}): {record_count} records")
        else:
            print(f"Week {check_week} ({check_year}): Error {response.status_code}")
    except Exception as e:
        print(f"Week {check_week} ({check_year}): Exception {e}")

print("\n" + "=" * 70)
print("TEST COMPLETE")
print("=" * 70)
