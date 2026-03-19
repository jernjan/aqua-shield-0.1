import requests

print('Testing API...')
resp = requests.get('http://127.0.0.1:8000/api/risk/outbreak-risk-at-healthy-facilities', timeout=30)
data = resp.json()
at_risk = data.get('healthy_at_risk', [])
summary = data.get('summary', {})

critical = sum(1 for f in at_risk if f.get('risk_level') == 'Critical')
medium = sum(1 for f in at_risk if f.get('risk_level') == 'Medium')
low = sum(1 for f in at_risk if f.get('risk_level') == 'Low')

print(f'\nTOTAL AT-RISK: {len(at_risk)}')
print(f'Distribution: Critical={critical}, Medium={medium}, Low={low}')
print(f'\nExpected: ~20 Critical, ~80+ Medium, ~100+ Low')
print(f'Got: {critical} Critical, {medium} Medium, {low} Low')

if len(at_risk) < 100:
    print(f'\n❌ ERROR: Only {len(at_risk)} facilities at risk! Ocean current fix didn\'t work.')
    print('\nFirst 5:')
    for f in at_risk[:5]:
        print(f'  {f.get("facility_name")}: {f.get("risk_score")} pts - {f.get("distance_to_source_km"):.1f}km')
else:
    print(f'\n✓ SUCCESS: {len(at_risk)} facilities at risk as expected!')
