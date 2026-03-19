"""
Detailed AIS test to diagnose the actual issue
"""
import requests
import json

print("="*60)
print("DETAILED AIS CONNECTION TEST")
print("="*60)

# Step 1: Get token
print("\n[STEP 1] Getting AIS token...")
token_endpoint = "https://id.barentswatch.no/connect/token"
client_id = "janinge88@hotmail.com:Kyst-Monitor-AIS"
client_secret = "Test123456789"

try:
    token_response = requests.post(
        token_endpoint,
        data={
            "client_id": client_id,
            "client_secret": client_secret,
            "scope": "ais",
            "grant_type": "client_credentials"
        },
        timeout=15
    )
    
    print(f"Token Response Status: {token_response.status_code}")
    print(f"Token Response Headers: {dict(token_response.headers)}")
    
    if token_response.status_code == 200:
        token_data = token_response.json()
        print(f"✅ Token obtained successfully")
        print(f"   Token length: {len(token_data.get('access_token', ''))}")
        print(f"   Expires in: {token_data.get('expires_in', 'N/A')} seconds")
        token = token_data["access_token"]
    else:
        print(f"❌ Failed to get token")
        print(f"   Response: {token_response.text}")
        exit(1)
        
except Exception as e:
    print(f"❌ Exception getting token: {e}")
    import traceback
    traceback.print_exc()
    exit(1)

# Step 2: Test AIS endpoint
print("\n[STEP 2] Fetching AIS data...")
ais_url = "https://live.ais.barentswatch.no/v1/latest/ais"
headers = {"Authorization": f"Bearer {token}"}

try:
    print(f"URL: {ais_url}")
    print(f"Headers: Authorization: Bearer {token[:20]}...")
    
    ais_response = requests.get(ais_url, headers=headers, timeout=45)
    
    print(f"\nAIS Response Status: {ais_response.status_code}")
    print(f"AIS Response Headers: {dict(ais_response.headers)}")
    print(f"AIS Response Content-Length: {len(ais_response.content)} bytes")
    print(f"AIS Response Text Length: {len(ais_response.text)} chars")
    
    if ais_response.status_code == 200:
        print(f"\n✅ AIS endpoint returned 200 OK")
        
        try:
            data = ais_response.json()
            print(f"\n📊 JSON parsed successfully")
            print(f"   Type: {type(data)}")
            
            if isinstance(data, list):
                print(f"   ✅ It's a list with {len(data)} vessels")
                if len(data) > 0:
                    print(f"\n   Sample vessel (first):")
                    print(f"   {json.dumps(data[0], indent=2)}")
                else:
                    print(f"   ⚠️  List is EMPTY")
            elif isinstance(data, dict):
                print(f"   It's a dict with keys: {list(data.keys())}")
                print(f"   Full response: {json.dumps(data, indent=2)[:500]}")
            else:
                print(f"   Unexpected type: {type(data)}")
                
        except json.JSONDecodeError as je:
            print(f"❌ Failed to parse JSON: {je}")
            print(f"   Raw text (first 500 chars): {ais_response.text[:500]}")
            
    else:
        print(f"\n❌ AIS endpoint returned {ais_response.status_code}")
        print(f"   Response text: {ais_response.text[:500]}")
        
except requests.exceptions.Timeout:
    print(f"❌ Request timed out after 45 seconds")
except Exception as e:
    print(f"❌ Exception: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "="*60)
print("TEST COMPLETE")
print("="*60)
