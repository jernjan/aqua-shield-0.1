#!/usr/bin/env python3
"""
Direct test of facilities endpoint
"""
import requests
from dotenv import load_dotenv
import os
import json

load_dotenv()

BARENTSWATCH_CLIENT_ID = os.getenv("BARENTSWATCH_CLIENT_ID")
BARENTSWATCH_CLIENT_SECRET = os.getenv("BARENTSWATCH_CLIENT_SECRET")
BARENTSWATCH_AUTH_URL = "https://id.barentswatch.no/connect/token"
BARENTSWATCH_BASE_URL = os.getenv("BARENTSWATCH_API_BASE_URL")

print(f"Base URL: {BARENTSWATCH_BASE_URL}")
print(f"Client ID: {BARENTSWATCH_CLIENT_ID[:30]}...\n")

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

if token_response.status_code != 200:
    print(f"❌ Token error: {token_response.status_code}\n{token_response.text}")
    exit(1)

token = token_response.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}

print("✅ Token obtained\n")

# Test facilities endpoint
url = f"{BARENTSWATCH_BASE_URL}/v1/geodata/fishhealth/localities"
print(f"Testing: {url}\n")

r = requests.get(url, headers=headers, timeout=10)

print(f"Status: {r.status_code}")
print(f"Headers: {dict(r.headers)}\n")

if r.status_code == 200:
    try:
        data = r.json()
        print(f"✅ Got response")
        print(f"Type: {type(data)}")
        if isinstance(data, list):
            print(f"Records: {len(data)}")
            if len(data) > 0:
                print(f"\nFirst record:")
                print(json.dumps(data[0], indent=2, ensure_ascii=False))
        else:
            print(f"Data: {data}")
    except:
        print(f"Response (text): {r.text[:500]}")
else:
    print(f"❌ Error response:")
    print(f"Text: {r.text[:500]}")
