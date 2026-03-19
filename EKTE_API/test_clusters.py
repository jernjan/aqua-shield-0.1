import requests
import json

# Test the new clusters endpoint
print("Testing /api/risk/clusters endpoint...\n")

try:
    resp = requests.get('http://127.0.0.1:8000/api/risk/clusters?max_distance_km=10&min_cluster_size=2', timeout=30)
    data = resp.json()
    
    print(f"✅ Endpoint working!\n")
    print(f"=== FACILITY CLUSTER ANALYSIS ===\n")
    print(f"Total clusters found: {data.get('total_clusters')}")
    print(f"Total facilities in clusters: {data.get('analysis_summary', {}).get('total_facilities_in_clusters')}")
    print(f"Vessels linking multiple clusters: {data.get('vessels_linking_clusters')}\n")
    
    print("=== CLUSTERS ===")
    for cluster in data.get('clusters', [])[:5]:  # Show first 5
        print(f"\nCluster {cluster['cluster_id']} ({cluster['size']} facilities):")
        for fac in cluster['facilities']:
            print(f"  - {fac['code']}: {fac['name']} (category: {fac['category']}, visited by {fac['vessels_visited']} vessels)")
    
    print(f"\n\n=== VESSEL MOVEMENTS BETWEEN CLUSTERS ===")
    for vessel in data.get('vessel_movements_between_clusters', [])[:5]:  # Show first 5
        print(f"{vessel['mmsi']} ({vessel['vessel']}): visits clusters {vessel['visited_clusters']}")
    
    print(f"\n\n=== ANALYSIS ===")
    print(data.get('analysis_summary', {}).get('description'))
    print(f"\nRecommendation:")
    print(data.get('analysis_summary', {}).get('recommendation'))
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
