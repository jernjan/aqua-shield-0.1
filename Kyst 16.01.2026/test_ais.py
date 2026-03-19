#!/usr/bin/env python3
"""
Test BarentsWatch AIS API
"""

import requests
import os
from dotenv import load_dotenv

load_dotenv()

client_id = os.getenv("BARENTSWATCH_CLIENT_ID", "janinge88@hotmail.com:Kyst-Monitor")
client_secret = os.getenv("BARENTSWATCH_CLIENT_SECRET", "Test123456789")

print("="*70)
print("BARENTSWATCH AIS API TEST")
print("="*70)
print(f"\nClient ID: {client_id}")

# Token request for AIS - use scope=ais
print("\n[1] Requesting AIS access token (scope=ais)...")
print("-" * 70)

token_url = "https://id.barentswatch.no/connect/token"

token_data = {
    "client_id": client_id,
    "client_secret": client_secret,
    "scope": "ais",
    "grant_type": "client_credentials"
}

try:
    response = requests.post(token_url, data=token_data, timeout=10)
    print(f"Status: {response.status_code}")
    
    if response.status_code == 200:
        token_data_resp = response.json()
        access_token = token_data_resp.get("access_token")
        expires_in = token_data_resp.get("expires_in")
        
        print(f"✅ SUCCESS!")
        print(f"  Access Token: {access_token[:30]}...")
        print(f"  Expires in: {expires_in} seconds")
        
        # Now try to use the token with AIS API
        print("\n[2] Testing AIS API call with token...")
        print("-" * 70)
        
        # Try latest AIS endpoint
        ais_url = "https://live.ais.barentswatch.no/v1/latest/ais"
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
        
        print(f"GET {ais_url}")
        
        ais_response = requests.get(ais_url, headers=headers, timeout=10)
        print(f"Status: {ais_response.status_code}")
        
        if ais_response.status_code == 200:
            data = ais_response.json()
            if isinstance(data, list):
                print(f"✅ SUCCESS! Got {len(data)} AIS records!")
                if len(data) > 0:
                    print(f"\nFirst AIS record sample:")
                    print(f"  {data[0]}")
            else:
                print(f"✅ SUCCESS! Got AIS data")
                print(f"  Type: {type(data).__name__}")
        elif ais_response.status_code == 400 or ais_response.status_code == 422:
            print(f"⚠️  Status {ais_response.status_code}")
            print(f"AIS endpoint may require parameters (mmsi, lat, lon, etc.)")
            print(f"Response: {ais_response.text[:300]}")
        else:
            print(f"❌ Status: {ais_response.status_code}")
            print(f"Response: {ais_response.text[:300]}")
            
    else:
        print(f"❌ FAILED to get AIS token")
        print(f"Response: {response.text}")
        
except Exception as e:
    print(f"❌ ERROR: {str(e)}")

print("\n" + "="*70)
