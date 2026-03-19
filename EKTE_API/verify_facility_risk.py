import requests

resp = requests.get('http://127.0.0.1:8002/api/facilities/disease-spread')
if resp.status_code == 200:
    data = resp.json()
    print('✅ Facility Risk API: OK')
    print(f'Diseased facilities: {data["diseased_facilities_count"]}')
    print(f'Facilities at risk: {data["facilities_at_disease_risk"]}')
    print('Risk breakdown:')
    for level, count in data['risk_summary'].items():
        print(f'  {level}: {count}')
    print(f'\nSample facility (top risk):')
    top = data['all_at_risk_facilities'][0]
    print(f'  {top["facility_name"]} ({top["facility_code"]})')
    print(f'  Risk: {top["risk_level"]} ({top["risk_score"]}/100)')
    print(f'  Threat: {top["highest_risk_neighbor"]["facility_name"]} ({top["highest_risk_neighbor"]["distance_km"]} km)')
else:
    print(f'Error: {resp.status_code}')
