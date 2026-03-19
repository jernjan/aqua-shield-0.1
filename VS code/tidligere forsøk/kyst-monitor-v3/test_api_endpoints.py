#!/usr/bin/env python3
"""
Test which endpoints exist on BarentsWatch API
"""
import requests
import json
from datetime import datetime
from dotenv import load_dotenv
import os

load_dotenv()

BARENTSWATCH_CLIENT_ID = os.getenv("BARENTSWATCH_CLIENT_ID")
BARENTSWATCH_CLIENT_SECRET = os.getenv("BARENTSWATCH_CLIENT_SECRET")
BARENTSWATCH_AUTH_URL = "https://id.barentswatch.no/connect/token"

# Get token
print("[Getting token...]")
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

print("✅ Token obtained\n")

# Test various endpoints
endpoints = [
    "https://www.barentswatch.no/bwapi/",
    "https://www.barentswatch.no/bwapi/v1/",
    "https://www.barentswatch.no/bwapi/geodata/",
    "https://www.barentswatch.no/bwapi/v1/geodata/",
    "https://www.barentswatch.no/api/v1/",
    "https://www.barentswatch.no/api/v1/geodata/",
    "https://www.barentswatch.no/api/v1/geodata/fishhealth/",
    "https://www.barentswatch.no/api/v2/",
]

print("Testing endpoints:")
print("=" * 80)

for endpoint in endpoints:
    try:
        response = requests.get(endpoint, headers=headers, timeout=5)
        status = response.status_code
        
        # Try to parse JSON
        try:
            data = response.json()
            content = str(data)[:100]
        except:
            content = response.text[:100]
        
        print(f"{status:3d} | {endpoint}")
        if status != 404:
            print(f"      └─ Response: {content}")
    except Exception as e:
        print(f"ERR  | {endpoint} - {e}")

print("\n" + "=" * 80)
