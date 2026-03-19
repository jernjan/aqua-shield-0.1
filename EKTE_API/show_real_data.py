import urllib.request
import json

resp = urllib.request.urlopen('http://127.0.0.1:8002/api/risk/assess?limit=500')
data = json.loads(resp.read())

# Find high-risk facility (ILA or PD with disease proximity)
high_risk = [f for f in data['assessments'] if f['disease_status']['has_ila'] or f['disease_status']['has_pd']]
high_risk.sort(key=lambda x: -x['risk_score'])

print("Facilities with actual ILA/PD diseases - sorted by risk:\n")
for f in high_risk[:5]:
    print(f"{f['facility_name']:30s} Code: {f['facility_code']:6s}  Risk: {f['risk_score']:5.1f}  Level: {f['risk_level']}")
    print(f"  Disease: {', '.join(d['name'] for d in f['disease_status']['diseases'])}")
    print(f"  Factors: proximity={f['factors'].get('disease_proximity', '-')}, density={f['factors'].get('farm_density', '-')}, lice={f['factors'].get('lice_level', '-')}")
    disease_sources = f['disease_status']['disease_sources']
    if isinstance(disease_sources, list) and disease_sources:
        print(f"  Disease sources: {len(disease_sources)} nearby farm(s)")
    print()
