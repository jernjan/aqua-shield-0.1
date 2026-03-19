#!/usr/bin/env python3
import requests

r = requests.get('http://127.0.0.1:8000/api/risk/predictions/all', timeout=60)
data = r.json()

print("=" * 80)
print("HAVSTRØM-ANALYSE: Hvordan hver faktor bidrar til smitterisikoen")
print("=" * 80)

for i, f in enumerate(data['top_20_by_risk'][:5], 1):
    dist = f.get('distance_contribution', 0)
    ocean = f.get('ocean_current_contribution', 0)
    disease = f.get('disease_contribution', 0)
    vessel = f.get('vessel_contribution', 0)
    total = f['outbreak_risk_pct']
    
    print(f"\n{i}. {f['facility_name']} ({f['source_facility_name']}) - TOTALT {total}% RISIKO")
    print(f"   📏 Avstand:     {dist:2.0f} pts ({dist/total*100:5.1f}%)")
    print(f"   🌊 Havstrøm:    {ocean:2.0f} pts ({ocean/total*100:5.1f}%)")  
    print(f"   🦠 Sykdomstype: {disease:2.0f} pts ({disease/total*100:5.1f}%)")
    print(f"   🚢 Båttrafikk:  {vessel:2.0f} pts ({vessel/total*100:5.1f}%)")
    print(f"   {'─' * 50}")
    if ocean > dist:
        print(f"   ⭐ HAVSTRØM er hovedårsaken til risikoen!")
    if dist > ocean:
        print(f"   ⭐ AVSTAND er hovedårsaken til risikoen!")
