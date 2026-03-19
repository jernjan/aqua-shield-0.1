import requests

resp = requests.get('http://127.0.0.1:8002/api/facilities/disease-spread')
data = resp.json()

print('=== RISK SUMMARY ===')
print(f'Ekstrem: {data["risk_summary"]["ekstrem"]}')
print(f'Høy: {data["risk_summary"]["høy"]}')
print(f'Moderat: {data["risk_summary"]["moderat"]}')
print(f'Lav: {data["risk_summary"]["lav"]}')
print(f'Total at risk: {data["facilities_at_disease_risk"]}')

# Find ekstrem facilities and check distances
ekstrem = [x for x in data['all_at_risk_facilities'] if x['risk_level']=='Ekstrem']
print(f'\n=== EKSTREM FACILITIES (First 5) ===')
for f in ekstrem[:5]:
    dist = f['highest_risk_neighbor']['distance_km']
    diseases = f['highest_risk_neighbor']['diseases']
    print(f'{f["facility_name"]}: {dist}km from {diseases}')
