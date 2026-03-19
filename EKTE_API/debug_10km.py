import requests
import json

# Check what the API says about facility summary and infected facilities
resp = requests.get('http://127.0.0.1:8000/api/facilities/summary', timeout=30)
summary = resp.json()

print("=== FACILITY STATUS SUMMARY ===")
print(f"Total facilities: {summary.get('total_facilities')}")
print(f"Status summary: {json.dumps(summary.get('status_summary'), indent=2)}")

# Check vessels at risk endpoint for more details
resp2 = requests.get('http://127.0.0.1:8000/api/vessels/at-risk-facilities?hours=96', timeout=30)
data = resp2.json()

print("\n=== INFECTED FACILITIES IN PREDICTIONS ===")
print(f"Total boats: {len(data.get('vessels', []))}")

# Get unique facilities visited
all_facilities_visited = {}
for vessel in data.get('vessels', []):
    for visit in vessel.get('visits', []):
        fac_code = visit.get('facility_code')
        cat = visit.get('visit_category')
        if fac_code:
            if fac_code not in all_facilities_visited:
                all_facilities_visited[fac_code] = {'categories': set(), 'name': visit.get('facility_name')}
            all_facilities_visited[fac_code]['categories'].add(cat)

print(f"\nUnique facilities visited: {len(all_facilities_visited)}")
print("\nFacility breakdown:")
for code, info in sorted(all_facilities_visited.items())[:20]:
    cats = ', '.join(sorted(info['categories']))
    print(f"  {code}: {info['name'][:40]} → {cats}")

print(f"\n... and {max(0, len(all_facilities_visited) - 20)} more facilities")

# Check if there are any facilities with coordinates
print("\n=== CHECKING FOR FACILITY COORDINATES ===")
resp3 = requests.get('http://127.0.0.1:8000/api/facilities/list?limit=100', timeout=30)
if resp3.status_code == 200:
    facilities = resp3.json().get('facilities', [])
    with_coords = sum(1 for f in facilities if f.get('latitude') and f.get('longitude'))
    print(f"Facilities in list: {len(facilities)}")
    print(f"Facilities with coordinates: {with_coords}")
else:
    print(f"Facilities endpoint not available ({resp3.status_code})")
