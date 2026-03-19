#!/usr/bin/env python3
import requests

r = requests.get('http://127.0.0.1:8000/api/risk/predictions/all', timeout=25)
data = r.json()
print('Looking for Blåsenborgneset and Austvika:')
for f in data['top_20_by_risk'][:20]:
    name = f['facility_name']
    if 'Blåsenborgneset' in name or 'Austvika' in name:
        print(f"{name}: {f['outbreak_risk_pct']}% risk, is_infected={f['is_infected']}, source={f['source_facility_name']}")

print('\nAll 20 facilities:')
for i, f in enumerate(data['top_20_by_risk'][:20], 1):
    print(f"{i}. {f['facility_name']}: {f['outbreak_risk_pct']}%")
