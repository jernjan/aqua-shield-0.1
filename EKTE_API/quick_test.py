import requests

r = requests.get('http://127.0.0.1:8000/api/risk/predictions/all', timeout=45)
data = r.json()

print('=== OPPDATERT DASHBOARD ===')
print(f"Critical: {data['summary']['critical']}")
print(f"Medium: {data['summary']['medium']}")
print(f"Low: {data['summary']['low']}")
print(f"Totalt: {data['summary']['total_facilities']}")
print()
print('Top 3 friske anlegg i fare:')
for i, fac in enumerate(data['top_20_by_risk'][:3], 1):
    print(f"{i}. {fac['facility_name']}: {fac['risk_level']} ({fac['outbreak_risk_pct']:.0f}%)")
    print(f"   Fra: {fac.get('source_facility_name', 'Unknown')} ({fac.get('distance_to_nearest_infected_km', 0):.1f} km)")
