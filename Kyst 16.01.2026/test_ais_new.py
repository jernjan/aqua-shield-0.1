import requests
import json

# AIS credentials - from BarentsWatch MyPage
ais_client_id = 'janinge88@hotmail.com:Kyst-Monitor-AIS'
ais_client_secret = 'Test123456789'

print('=' * 60)
print('BARENTSWATCH AIS API TEST - NEW CREDENTIALS')
print('=' * 60)

print(f'\nClient ID: {ais_client_id}')

# [1] Request token with scope=ais
print('\n[1] Requesting AIS access token (scope=ais)...')
print('-' * 60)

token_response = requests.post(
    'https://id.barentswatch.no/connect/token',
    data={
        'client_id': ais_client_id,
        'client_secret': ais_client_secret,
        'scope': 'ais',
        'grant_type': 'client_credentials'
    }
)

print(f'Status: {token_response.status_code}')

if token_response.status_code == 200:
    token_data = token_response.json()
    access_token = token_data['access_token']
    expires_in = token_data.get('expires_in', 'unknown')
    print(f'✅ SUCCESS!')
    print(f'Access Token: {access_token[:50]}...')
    print(f'Expires in: {expires_in} seconds')
    
    # [2] Test AIS endpoint
    print('\n[2] Testing /v1/latest/ais endpoint...')
    print('-' * 60)
    
    headers = {'Authorization': f'Bearer {access_token}'}
    ais_response = requests.get(
        'https://live.ais.barentswatch.no/v1/latest/ais',
        headers=headers,
        timeout=10
    )
    
    print(f'Status: {ais_response.status_code}')
    
    if ais_response.status_code == 200:
        data = ais_response.json()
        
        if isinstance(data, list):
            print(f'✅ SUCCESS! Got {len(data)} AIS records!')
            
            if len(data) > 0:
                print('\nFirst 3 records:')
                for i, record in enumerate(data[:3], 1):
                    print(f'\n  [{i}] MMSI: {record.get("MMSI", "?")}')
                    print(f'      Name: {record.get("Name", "?")}')
                    print(f'      Type: {record.get("Type", "?")}')
                    print(f'      Lat/Lon: {record.get("Latitude", "?")}, {record.get("Longitude", "?")}')
        else:
            print(f'Response type: {type(data)}')
            print(f'Response (first 300 chars): {str(data)[:300]}')
    else:
        print(f'❌ Failed to get AIS data')
        print(f'Response: {ais_response.text[:500]}')

else:
    error_data = token_response.json()
    print(f'❌ Failed to get token')
    print(f'Error: {error_data}')

print('\n' + '=' * 60)
