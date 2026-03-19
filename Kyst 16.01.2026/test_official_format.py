#!/usr/bin/env python3
"""
Test BarentsWatch API with EXACT format from official documentation.
"""

import requests
import os
from dotenv import load_dotenv

load_dotenv()

# EXACT format from https://developer.barentswatch.no/docs/tutorial/
client_id = os.getenv("BARENTSWATCH_CLIENT_ID", "janinge88@hotmail.com:Kyst-Monitor")
client_secret = os.getenv("BARENTSWATCH_CLIENT_SECRET", "Test123456789")

print("="*70)
print("BARENTSWATCH API - OFFICIAL DOCUMENTATION TEST")
print("="*70)
print(f"\nClient ID: {client_id}")
print(f"Client Secret: {client_secret[:10]}...")

# Token request - EXACT format from documentation
print("\n[1] Requesting access token...")
print("-" * 70)

token_url = "https://id.barentswatch.no/connect/token"

token_data = {
    "client_id": client_id,
    "client_secret": client_secret,
    "scope": "api",
    "grant_type": "client_credentials"
}

print(f"POST {token_url}")
print(f"Data: {token_data}")

try:
    response = requests.post(token_url, data=token_data, timeout=10)
    print(f"\nStatus: {response.status_code}")
    print(f"Response: {response.text}")
    
    if response.status_code == 200:
        token_data_resp = response.json()
        access_token = token_data_resp.get("access_token")
        expires_in = token_data_resp.get("expires_in")
        
        print(f"\n✅ SUCCESS!")
        print(f"  Access Token: {access_token[:30]}...")
        print(f"  Expires in: {expires_in} seconds")
        
        # Now try to use the token
        print("\n[2] Testing API call with token...")
        print("-" * 70)
        
        api_url = "https://www.barentswatch.no/bwapi/v1/geodata/fishhealth/localities"
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
        
        print(f"GET {api_url}")
        print(f"Headers: Authorization: Bearer {access_token[:30]}...")
        
        api_response = requests.get(api_url, headers=headers, timeout=10)
        print(f"\nStatus: {api_response.status_code}")
        
        if api_response.status_code == 200:
            data = api_response.json()
            count = len(data) if isinstance(data, list) else 1
            print(f"✅ SUCCESS! Got {count} records!")
            
            if isinstance(data, list) and len(data) > 0:
                print(f"\nFirst facility:")
                print(f"  Name: {data[0].get('name', 'N/A')}")
                print(f"  ID: {data[0].get('localityId', 'N/A')}")
                print(f"  Municipality: {data[0].get('municipality', 'N/A')}")
        else:
            print(f"❌ FAILED")
            print(f"Response: {api_response.text[:500]}")
            
    else:
        print(f"\n❌ FAILED to get token")
        print(f"Error response: {response.text}")
        
except Exception as e:
    print(f"❌ ERROR: {str(e)}")

print("\n" + "="*70)
