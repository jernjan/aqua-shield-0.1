import requests
import json

# Get 1 facility with disease data
resp = requests.get('http://127.0.0.1:8002/api/facilities?limit=1')
data = resp.json()
fac = data['facilities'][0]

print('First facility:')
print(json.dumps(fac, indent=2)[:1500])
print('...')

# Get one infected facility
resp = requests.get('http://127.0.0.1:8002/api/facilities?limit=500')
data = resp.json()
infected = [f for f in data['facilities'] if f.get('diseases')]

if infected:
    print('\n\nFirst infected facility:')
    print(json.dumps(infected[0], indent=2)[:1500])
