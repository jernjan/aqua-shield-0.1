#!/usr/bin/env python
import requests
import json

# Check facility risk
resp = requests.get('http://127.0.0.1:8002/api/facilities/disease-spread')
data = resp.json()

print('=== FACILITY RISK DATA ===')
print(f'Total facilities: {data["total_facilities"]}')
print(f'Diseased facilities: {data["diseased_facilities_count"]}')
print(f'\nRisk breakdown:')
for level, count in data['risk_summary'].items():
    print(f'  {level}: {count}')

# Get top 10 facilities by risk
sorted_facilities = sorted(data['all_at_risk_facilities'], key=lambda x: x['risk_score'], reverse=True)
print(f'\nTop 10 highest risk facilities:')
for i, f in enumerate(sorted_facilities[:10], 1):
    disease_str = ', '.join(f['highest_risk_neighbor'].get('diseases', []))
    print(f'{i}. {f["facility_name"]} ({f["facility_code"]}): {f["risk_level"]} ({f["risk_score"]}/100) via {disease_str}')

# Check vessel risk
print('\n=== VESSEL RISK DATA ===')
resp2 = requests.get('http://127.0.0.1:8002/api/vessels/disease-risk')
vessel_data = resp2.json()
print(f'Total vessels: {vessel_data["total_vessels"]}')
print(f'Infected vessels: {vessel_data["infected_vessels"]}')
print(f'At-risk vessels: {vessel_data["at_risk_vessels"]}')
print(f'\nRisk breakdown:')
for level, count in vessel_data['risk_summary'].items():
    print(f'  {level}: {count}')
