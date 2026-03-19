import requests
import json

# Get cluster analysis
r = requests.get('http://127.0.0.1:8000/api/risk/clusters?max_distance_km=10&min_cluster_size=2')
data = r.json()

print("="*60)
print("FACILITY CLUSTER ANALYSIS")
print("="*60)

# Clusters summary
clusters = data.get('clusters', [])
print(f"\n📍 CLUSTERS DETECTED: {data.get('total_clusters', 0)}")
print(f"   Facilities in clusters: {data.get('analysis_summary', {}).get('total_facilities_in_clusters', 0)}")

# Show each cluster
for cluster in clusters:
    print(f"\n  Cluster {cluster['cluster_id']} - {cluster['size']} facilities:")
    for fac in cluster['facilities']:
        lat = float(fac['latitude']) if fac['latitude'] else None
        lon = float(fac['longitude']) if fac['longitude'] else None
        print(f"    ✓ {fac['code']:6} ({fac['name'][:30]:30}) - {fac['category']}")
        print(f"      Visited by {fac['vessels_visited']} vessels")

# Transmission vectors
vessel_movements = data.get('vessel_movements_between_clusters', [])
print(f"\n🚢 TRANSMISSION VECTORS: {data.get('vessels_linking_clusters', 0)} vessels")
for vm in vessel_movements:
    clusters_str = ', '.join(map(str, vm['visited_clusters']))
    print(f"  • {vm['mmsi']} ({vm['vessel'][:20]:20}) visits clusters {clusters_str}")

# Analysis summary
summary = data.get('analysis_summary', {})
print(f"\n📊 SUMMARY:")
print(f"   {summary.get('description')}")
print(f"\n⚠️ RECOMMENDATION:")
print(f"   {summary.get('recommendation')}")

print("\n" + "="*60)
