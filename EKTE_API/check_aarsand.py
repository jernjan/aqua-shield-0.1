"""Check if Aarsand is within 10km of infected facilities"""
import sys
sys.path.insert(0, r'c:\Users\janin\OneDrive\Skrivebord\Kyst monitor DEMO\EKTE_API')

from src.api import facility_master
from math import radians, sin, cos, sqrt, atan2

def haversine_distance(lat1, lon1, lat2, lon2):
    """Calculate distance between two coordinates in km"""
    R = 6371
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * atan2(sqrt(a), sqrt(1-a))
    return R * c

# Get Aarsand
aarsand = facility_master.get_facility('14746')
print(f"Aarsand: {aarsand['facility_code']} - {aarsand['facility_name']}")
print(f"  Location: ({aarsand['latitude']}, {aarsand['longitude']})")
print(f"  Is infected: {aarsand['has_disease']}")

# Get all infected facilities
infected = facility_master.get_infected_facilities()
print(f"\nChecking distance to {len(infected)} infected facilities...")

# Find nearest infected facilities
nearest = []
for inf_fac in infected:
    distance = haversine_distance(
        aarsand['latitude'], aarsand['longitude'],
        inf_fac['latitude'], inf_fac['longitude']
    )
    nearest.append((inf_fac['facility_code'], inf_fac['facility_name'], distance))

# Sort by distance
nearest.sort(key=lambda x: x[2])

print("\nNearest 10 infected facilities:")
for code, name, dist in nearest[:10]:
    within_10km = "WITHIN 10KM" if dist <= 10 else ""
    print(f"  {code}: {name} - {dist:.2f} km {within_10km}")

within_10km_count = sum(1 for _, _, dist in nearest if dist <= 10)
print(f"\nTotal infected facilities within 10km of Aarsand: {within_10km_count}")
