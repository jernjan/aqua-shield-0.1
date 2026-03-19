#!/usr/bin/env python3
"""
Test NAIS Health endpoint
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

token = token_response.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}

# Test NAIS Health endpoint
year = datetime.now().year
week = datetime.now().isocalendar()[1]

print("=" * 70)
print("NAIS Health API Test")
print("=" * 70)

url = f"{BARENTSWATCH_BASE_URL}/v1/geodata/fishhealth/{year}/{week}"
print(f"\nTesting week {week}, year {year}")
print(f"URL: {url}\n")

r = requests.get(url, headers=headers, timeout=10)

print(f"Status Code: {r.status_code}")

if r.status_code == 200:
    try:
        data = r.json()
        if isinstance(data, list):
            print(f"✅ SUCCESS: Got {len(data)} records")
            if len(data) > 0:
                print(f"\nFirst record:")
                print(json.dumps(data[0], indent=2, ensure_ascii=False))
                print(f"\nField names: {list(data[0].keys())}")
            else:
                print("⚠️  Response is empty list")
        else:
            print(f"Data type: {type(data)}")
            print(f"Response: {json.dumps(data, indent=2)}")
    except json.JSONDecodeError as e:
        print(f"❌ Invalid JSON: {e}")
        print(f"Response: {r.text[:500]}")
else:
    print(f"❌ Error: {r.status_code}")
    try:
        print(f"Response: {r.json()}")
    except:
        print(f"Response: {r.text[:500]}")

# Also test last week
print("\n" + "=" * 70)
print("Testing last week for comparison")
print("=" * 70)

from datetime import timedelta
last_week_date = datetime.now() - timedelta(weeks=1)
last_week = last_week_date.isocalendar()[1]
last_year = last_week_date.year

url2 = f"{BARENTSWATCH_BASE_URL}/v1/geodata/fishhealth/{last_year}/{last_week}"
print(f"\nTesting week {last_week}, year {last_year}")
print(f"URL: {url2}\n")

r2 = requests.get(url2, headers=headers, timeout=10)
print(f"Status Code: {r2.status_code}")

if r2.status_code == 200:
    data2 = r2.json()
    if isinstance(data2, list):
        print(f"Records: {len(data2)}")
    else:
        print(f"Response type: {type(data2)}")
else:
    print(f"Error: {r2.status_code}")
