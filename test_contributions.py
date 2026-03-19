#!/usr/bin/env python3
import requests, json

r = requests.get('http://127.0.0.1:8000/api/risk/predictions/all', timeout=25)
data = r.json()
f = data['top_20_by_risk'][0]
print(f"Test facility: {f['facility_name']}")
print(f"Total risk: {f['outbreak_risk_pct']}%\n")
print("Contribution values:")
print(f"  Distance contribution: {f.get('distance_contribution', 'N/A')}")
print(f"  Ocean current contribution: {f.get('ocean_current_contribution', 'N/A')}")
print(f"  Disease contribution: {f.get('disease_contribution', 'N/A')}")
print(f"  Vessel contribution: {f.get('vessel_contribution', 'N/A')}")
print(f"\nRisk drivers: {f.get('risk_drivers', [])}")
sum_contrib = (f.get('distance_contribution', 0) + f.get('ocean_current_contribution', 0) + 
               f.get('disease_contribution', 0) + f.get('vessel_contribution', 0))
print(f"Total contribution: {sum_contrib} pts (max 100)")
