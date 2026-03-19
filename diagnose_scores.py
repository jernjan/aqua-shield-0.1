#!/usr/bin/env python3
import requests
from collections import Counter

r = requests.get('http://127.0.0.1:8000/api/risk/predictions/all', timeout=60)
data = r.json()

scores = [f['outbreak_risk_pct'] for f in data['top_20_by_risk']]
distances = [f['distance_to_source_km'] for f in data['top_20_by_risk']]
ocean_contribs = [f.get('ocean_current_contribution', 0) for f in data['top_20_by_risk']]
dist_contribs = [f.get('distance_contribution', 0) for f in data['top_20_by_risk']]

print("=" * 70)
print("DIAGNOSE: HVORFOR ALLE ANLEGG FÅR SAMME SCORE?")
print("=" * 70)

print(f"\nUnikke risikoscorer (top 20): {Counter(scores)}")
print(f"Min/Max: {min(scores)} - {max(scores)}")

print(f"\nUnikke avstander (km): {sorted(set(distances))}")
print(f"Min/Max avstand: {min(distances):.1f} - {max(distances):.1f}")

print(f"\nOcean current contribution (poeng):")
print(f"  Alle samme? {len(set(ocean_contribs)) == 1}")
print(f"  Verdier: {sorted(set(ocean_contribs))}")

print(f"\nDistance contribution (poeng):")
print(f"  Alle samme? {len(set(dist_contribs)) == 1}")
print(f"  Verdier: {sorted(set(dist_contribs))}")

print("\n" + "=" * 70)
if len(set(scores)) == 1:
    print("🔴 PROBLEM: Alle 20 anlegg har EKSAKT samme score!")
    print("   Dette indikerer at beregningene ikke er individualisert.")
elif max(scores) - min(scores) < 5:
    print("🟡 ADVARSEL: Veldig liten variasjon i score (max diff: {})".format(max(scores) - min(scores)))
else:
    print("✅ OK: Scores varierer rimelig mellom anleggene")

print("\nDETALJER:")
for i, f in enumerate(data['top_20_by_risk'][:5], 1):
    print(f"{i}. {f['facility_name']:30} | Score: {f['outbreak_risk_pct']:2.0f} | Dist: {f['distance_to_source_km']:5.1f}km | Ocean: {f.get('ocean_current_contribution', 0):2.0f}pts | Dist: {f.get('distance_contribution', 0):2.0f}pts")
