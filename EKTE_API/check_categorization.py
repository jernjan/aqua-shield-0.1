"""Check exposure events and categorization"""
import sys
sys.path.insert(0, r'c:\Users\janin\OneDrive\Skrivebord\Kyst monitor DEMO\EKTE_API')

import sqlite3
from src.api import facility_master
from math import radians, sin, cos, sqrt, atan2

def haversine_distance(lat1, lon1, lat2, lon2):
    """Calculate distance between two coordinates in km"""
    R = 6371  # Earth radius in km
    
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * atan2(sqrt(a), sqrt(1-a))
    return R * c

# Get infected facilities
infected = facility_master.get_infected_facilities()
print(f'Infected facilities: {len(infected)}')

# Get exposure events
db_path = r'c:\Users\janin\OneDrive\Skrivebord\Kyst monitor DEMO\EKTE_API\src\api\data\exposure_events.db'
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

cursor.execute("SELECT DISTINCT facility_id, facility_name FROM vessel_exposure_events")
visited_facilities = cursor.fetchall()

print(f'\nFacilities visited by vessels: {len(visited_facilities)}')

# Check each visited facility
near_10km_count = 0
infected_visited_count = 0

for fac_id, fac_name in visited_facilities:
    # Get coordinates from facility_master
    fac_data = facility_master.get_facility(fac_id)
    
    if fac_data:
        is_infected = fac_data.get('has_disease', False)
        if is_infected:
            infected_visited_count += 1
            print(f'  INFECTED: {fac_id} - {fac_name}')
        
        fac_lat = fac_data.get('latitude')
        fac_lon = fac_data.get('longitude')
        
        if fac_lat and fac_lon:
            # Check distance to each infected facility
            for inf_fac in infected:
                if inf_fac['facility_code'] == fac_id:
                    continue  # Skip self
                
                distance = haversine_distance(
                    fac_lat, fac_lon,
                    inf_fac['latitude'], inf_fac['longitude']
                )
                if distance <= 10:
                    near_10km_count += 1
                    print(f'  NEAR 10KM: {fac_id} - {fac_name} is {distance:.2f} km from infected facility {inf_fac["facility_code"]}')
                    break

print(f'\nSummary:')
print(f'  Infected facilities visited: {infected_visited_count}')
print(f'  Facilities within 10 km of infected: {near_10km_count}')

conn.close()
