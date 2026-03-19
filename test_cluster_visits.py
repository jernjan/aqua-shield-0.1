import requests
import json

response = requests.get("http://127.0.0.1:8000/api/vessels/at-risk-facilities?min_duration_minutes=1")
data = response.json()

print("=" * 80)
print("FINDING CLUSTER VISITS")
print("="  * 80)

# Find visits where boat visited a non-infected facility near an infected one
cluster_examples = []

for vessel in data['vessels']:
    for visit in vessel.get('visits', []):
        if visit.get('visit_category') == 'near_infected_10km':
            # Check if the visited facility is NOT infected
            visited_infected = visit.get('infected', False)
            
            nearby = visit.get('nearby_infected_facilities', [])
            if nearby and not visited_infected:
                # This is what we're looking for!
                cluster_examples.append({
                    'vessel': vessel.get('vessel_name'),
                    'mmsi': vessel.get('mmsi'),
                    'visit': visit
                })

if cluster_examples:
    print(f"\n✅ Found {len(cluster_examples)} cluster visits (visited non-infected near infected)")
    print("\nBest examples:\n")
    
    for i, example in enumerate(cluster_examples[:3], 1):
        visit = example['visit']
        print(f"{i}. {example['vessel']} (MMSI: {example['mmsi']})")
        print(f"   Visited: {visit.get('facility_name')} (NOT infected)")
        print(f"   Distance to facility: {visit.get('distance_meters')} m")
        print(f"   Nearby infected facilities:")
        for inf in visit.get('nearby_infected_facilities', []):
            print(f"     - {inf.get('facility_name')}: {inf.get('distance_km')} km away")
        print()
else:
    print("\n⚠️ No cluster visits found (non-infected facility near infected)")

# Also check infected_facility_cluster category
print("\n" + "=" * 80)
print("INFECTED FACILITY IN CLUSTER")
print("=" * 80)

for vessel in data['vessels']:
    for visit in vessel.get('visits', []):
        if visit.get('visit_category') == 'infected_facility_cluster':
            print(f"\n✅ {vessel.get('vessel_name')} visited INFECTED facility in cluster:")
            print(f"   Facility: {visit.get('facility_name')}")
            print(f"   Distance: {visit.get('distance_meters')} m")
            nearby = visit.get('nearby_infected_facilities', [])
            if nearby:
                print(f"   Other nearby infected: {len(nearby)-1}")  # -1 because it includes itself
                for inf in nearby[:3]:
                    if inf.get('facility_name') != visit.get('facility_name'):
                        print(f"     - {inf.get('facility_name')}: {inf.get('distance_km')} km")
            break
    else:
        continue
    break

print("\n" + "=" * 80)
