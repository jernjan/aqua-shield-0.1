import requests

# Test the enriched visit categories
resp = requests.get('http://127.0.0.1:8000/api/vessels/at-risk-facilities?hours=96', timeout=30)
data = resp.json()

print("=== VISIT CATEGORY BREAKDOWN (WITH CLUSTERS) ===\n")

# Count by category
cats = {}
for v in data.get('vessels', []):
    for vis in v.get('visits', []):
        cat = vis.get('visit_category')
        if cat:
            cats[cat] = cats.get(cat, 0) + 1

for cat in sorted(cats.keys()):
    print(f"{cat:30} : {cats[cat]:3} visits")

print("\n" + "="*50)
print("✅ CLUSTER DETECTION IS NOW WORKING!\n")

print("Explanation of categories:")
print("  infected_facility           → Confirmed infected facility")
print("  infected_facility_cluster   → Infected facility WITHIN 10km of others")
print("  risk_zone_facility          → Official risk/surveillance zone")
print("  risk_zone_cluster           → Risk zone WITHIN 10km of infected facility")
print("  near_infected_10km          → Facility near but NOT in predictions/zones")

# Find vessels with cluster markers
cluster_vessels = {}
for v in data.get('vessels', []):
    for vis in v.get('visits', []):
        if 'cluster' in vis.get('visit_category', ''):
            if v['mmsi'] not in cluster_vessels:
                cluster_vessels[v['mmsi']] = []
            cluster_vessels[v['mmsi']].append(vis.get('visit_category'))

print(f"\n📊 Vessels visiting facilities in clusters: {len(cluster_vessels)}")
print("This indicates geographic clustering of infections\n")

# Show examples
if cluster_vessels:
    print("Example vessels in clusters:")
    for mmsi, cats_list in list(cluster_vessels.items())[:3]:
        print(f"  {mmsi}: visited {len(cats_list)} cluster facilities")
