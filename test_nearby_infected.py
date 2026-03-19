import requests
import json

response = requests.get("http://127.0.0.1:8000/api/vessels/at-risk-facilities?min_duration_minutes=1")
data = response.json()

print("=" * 80)
print(f"Total vessels: {len(data['vessels'])}")
print("=" * 80)

# Find vessels with cluster visits  
for vessel in data['vessels']:
    if vessel.get('visits'):
        for visit in vessel['visits']:
            if 'near_infected' in visit.get('visit_category', ''):
                print(f"\n✅ CLUSTER VISIT FOUND!")
                print(f"Vessel: {vessel.get('vessel_name')} (MMSI: {vessel.get('mmsi')})")
                print(f"Visited facility: {visit.get('facility_name')}")
                print(f"Distance: {visit.get('distance_meters')} m")
                print(f"Category: {visit.get('visit_category')}")
                print(f"Has nearby_infected_facilities? {'nearby_infected_facilities' in visit}")
                
                if 'nearby_infected_facilities' in visit:
                    print(f"Nearby infected facilities:")
                    for inf in visit['nearby_infected_facilities']:
                        print(f"  - {inf.get('facility_name')}: {inf.get('distance_km')} km")
                
                print(json.dumps(visit, indent=2))
                break
        else:
            continue
        break
else:
    print("\n❌ No cluster visits found in first 10 vessels")
    print("\nShowing all visit categories:")
    categories = set()
    for vessel in data['vessels']:
        for visit in vessel.get('visits', []):
            cat = visit.get('visit_category')
            if cat:
                categories.add(cat)
    
    print(f"Categories found: {categories}")
