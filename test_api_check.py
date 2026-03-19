#!/usr/bin/env python3
import requests

r = requests.get('http://127.0.0.1:8000/api/risk/predictions/all', timeout=25)
data = r.json()
print('✓ API Response: OK')
print(f'Summary: {data["summary"]}')
print(f'\nFirst 3 facilities:')
for f in data['top_20_by_risk'][:3]:
    print(f"  {f['facility_name']}: {f['outbreak_risk_pct']}% risk, is_infected={f['is_infected']}, source={f['source_facility_name']}")
