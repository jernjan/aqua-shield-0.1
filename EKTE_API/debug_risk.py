import requests

resp = requests.get('http://127.0.0.1:8000/api/risk/outbreak-risk-at-healthy-facilities', timeout=30)
data = resp.json()

print('TOP 5 BY RISK SCORE:')
print('=' * 70)
for i, fac in enumerate(data['healthy_at_risk'][:5], 1):
    print(f'\n{i}. {fac["facility_name"]} - {fac["risk_score"]} pts ({fac["risk_level"]})')
    print(f'   From: {fac["source_facility_name"]}')
    print(f'   Avstand: {fac["distance_to_source_km"]}km → {fac["distance_contribution"]} pts')
    print(f'   Havstrom: {fac["ocean_current_contribution"]} pts', end='')
    if fac.get('ocean_current_risk'):
        align = fac['ocean_current_risk'].get('alignment_factor', 0)
        direction = fac['ocean_current_risk'].get('current_direction_deg', 0)
        bearing = fac['ocean_current_risk'].get('bearing_from_infected_deg', 0)
        print(f' [dir={direction}°, bearing={bearing}°, align={align}]', end='')
    print()
    print(f'   Sykdom: {fac["disease_contribution"]} pts')
    print(f'   Båter: {fac["boat_vector_contribution"]} pts')

print('\n' + '=' * 70)
print(f'TOTALT SJEKKET: {data["summary"]["facilities_checked"]}')
print(f'SMITTET: {data["summary"]["infected_facilities_count"]}')
print(f'Kritisk: {data["summary"]["critical_count"]} | Medium: {data["summary"]["medium_count"]} | Low: {data["summary"]["low_count"]}')
