"""
Direkte test av BarentsWatch AIS API med dagens nøkler.
Kjør dette isolert for å bekrefte om nøklene faktisk fungerer.
"""
import requests
import json

# Samme nøkler som i barentswatch.py
AIS_CLIENT_ID = "janinge88@hotmail.com:Kyst-Monitor-AIS"
AIS_CLIENT_SECRET = "Test123456789"

TOKEN_ENDPOINT = "https://id.barentswatch.no/connect/token"
AIS_ENDPOINT = "https://live.ais.barentswatch.no/v1/latest/ais"

print("=" * 70)
print("BARENTWATCH AIS DIRECT TEST")
print("=" * 70)
print()

# Steg 1: Hent token
print("STEG 1: Henter OAuth2 token...")
print(f"  Client ID: {AIS_CLIENT_ID}")
print(f"  Token endpoint: {TOKEN_ENDPOINT}")
print()

try:
    token_response = requests.post(
        TOKEN_ENDPOINT,
        data={
            "client_id": AIS_CLIENT_ID,
            "client_secret": AIS_CLIENT_SECRET,
            "scope": "ais",
            "grant_type": "client_credentials"
        },
        timeout=10
    )
    
    print(f"  Status: {token_response.status_code}")
    
    if token_response.status_code == 200:
        token_data = token_response.json()
        access_token = token_data.get("access_token")
        print(f"  ✓ Token hentet OK")
        print(f"  Token lengde: {len(access_token)} tegn")
        print(f"  Token start: {access_token[:50]}...")
        print()
    else:
        print(f"  ✗ FEIL ved token-henting:")
        print(f"  Response: {token_response.text}")
        exit(1)
        
except Exception as e:
    print(f"  ✗ Exception ved token-henting: {e}")
    exit(1)

# Steg 2: Kall AIS-endepunkt
print("STEG 2: Kaller AIS-endepunkt...")
print(f"  Endpoint: {AIS_ENDPOINT}")
print()

try:
    ais_response = requests.get(
        AIS_ENDPOINT,
        headers={
            "Authorization": f"Bearer {access_token}"
        },
        timeout=30
    )
    
    print(f"  Status: {ais_response.status_code}")
    print(f"  Content-Length: {len(ais_response.content)} bytes")
    print()
    
    if ais_response.status_code == 200:
        print("  ✓ AIS-data hentet OK!")
        vessels = ais_response.json()
        print(f"  Antall fartøy: {len(vessels) if isinstance(vessels, list) else 'unknown'}")
        
        if isinstance(vessels, list) and len(vessels) > 0:
            print()
            print("  Eksempel på første fartøy:")
            first = vessels[0]
            print(f"    MMSI: {first.get('mmsi')}")
            print(f"    Latitude: {first.get('latitude')}")
            print(f"    Longitude: {first.get('longitude')}")
            print(f"    Speed: {first.get('speedOverGround')}")
            
        print()
        print("=" * 70)
        print("RESULTAT: AIS-nøklene fungerer perfekt! ✓")
        print("=" * 70)
        
    elif ais_response.status_code == 401:
        print("  ✗ HTTP 401 - Unauthorized")
        print()
        print("  Response body:")
        print(f"  {ais_response.text[:500]}")
        print()
        print("=" * 70)
        print("RESULTAT: Token avvist av AIS-tjenesten")
        print("Dette betyr:")
        print("  - Client ID/Secret fungerer (vi fikk token)")
        print("  - Men AIS-endepunktet aksepterer ikke tokenet")
        print("  - Sannsynlig årsak: Manglende 'ais' scope eller tilgang")
        print("=" * 70)
        
    else:
        print(f"  ✗ Uventet HTTP-status: {ais_response.status_code}")
        print(f"  Response: {ais_response.text[:500]}")
        print()
        print("=" * 70)
        print(f"RESULTAT: Ukjent feil (HTTP {ais_response.status_code})")
        print("=" * 70)
        
except Exception as e:
    print(f"  ✗ Exception ved AIS-kall: {e}")
    import traceback
    traceback.print_exc()
    print()
    print("=" * 70)
    print("RESULTAT: Teknisk feil ved AIS-kall")
    print("=" * 70)
