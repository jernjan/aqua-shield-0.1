import requests
import json

# Check at-risk vessels
r = requests.get('http://localhost:8000/api/vessels-at-risk-facilities')
data = r.json()

print(f'Total at-risk vessels: {len(data.get("at_risk_vessels", []))}')
print(f'Visit category breakdown: {data.get("visit_category_breakdown", {})}')

# Check cluster endpoint
rc = requests.get('http://localhost:8000/api/risk/clusters?max_distance_km=10&min_cluster_size=2')
cluster_data = rc.json()

print(f'\nCluster endpoint status: {rc.status_code}')
print(f'Total clusters found: {cluster_data.get("total_clusters", 0)}')
print(f'Vessel movements between clusters: {len(cluster_data.get("vessel_movements_between_clusters", []))}')

# Sample a few vessels to see data structure
vessels = data.get("at_risk_vessels", [])
if vessels:
    print(f'\nFirst vessel sample:')
    print(json.dumps(vessels[0], indent=2, default=str)[:500])
