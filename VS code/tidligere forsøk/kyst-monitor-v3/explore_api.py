#!/usr/bin/env python3
"""
Explore BarentsWatch API structure
"""
import requests
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

if token_response.status_code != 200:
    print(f"❌ Token error: {token_response.status_code}")
    print(token_response.text)
    exit(1)

token = token_response.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}

print("✅ Token obtained\n")

# Try different paths that might contain data
base = "https://www.barentswatch.no/bwapi"

paths = [
    "/",
    "/v1/",
    "/facilities",
    "/v1/facilities",
    "/fishhealth",
    "/v1/fishhealth",
    "/health",
    "/v1/health", 
    "/geodata",
    "/v1/geodata",
    "/positions",
    "/ais/positions",
    "/v1/ais/positions",
]

print("Trying different paths on bwapi:")
print("=" * 80)

for path in paths:
    url = base + path
    try:
        r = requests.get(url, headers=headers, timeout=5, allow_redirects=True)
        
        # Check response
        if r.status_code == 200:
            try:
                data = r.json()
                item_count = len(data) if isinstance(data, list) else "dict/other"
                print(f"✅ {r.status_code} | {path:40s} | Items: {item_count}")
            except:
                content_preview = r.text[:80].replace('\n', ' ')
                print(f"✅ {r.status_code} | {path:40s} | HTML/Text: {content_preview}...")
        else:
            print(f"❌ {r.status_code} | {path}")
            
    except Exception as e:
        print(f"❌ FAIL | {path:40s} | {str(e)[:50]}")

print("\n" + "=" * 80)
