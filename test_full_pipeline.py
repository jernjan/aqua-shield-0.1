#!/usr/bin/env python3
"""Test full disease spread pipeline"""
import sys
sys.path.insert(0, 'EKTE_API/src')

from api.clients.barentswatch import BarentsWatchClient
from shapely.geometry import Point, shape
from shapely.prepared import prep

bw = BarentsWatchClient()

print('Step 1: Fetch zones from BarentsWatch')
ila_zones = bw.get_ila_zones()
print(f'  ILA protection_zones type: {type(ila_zones.get("protection_zones"))}')
print(f'  ILA protection_zones keys: {ila_zones.get("protection_zones", {}).keys() if isinstance(ila_zones.get("protection_zones"), dict) else "Not a dict"}')

print('\nStep 2: Extract features')
def extract_geo_features(zone_payload):
    if isinstance(zone_payload, dict):
        features = zone_payload.get('features')
        if isinstance(features, list):
            return features
        return []
    if isinstance(zone_payload, list):
        return [item for item in zone_payload if isinstance(item, dict)]
    return []

ila_protection_features = extract_geo_features(ila_zones.get('protection_zones', {}))
print(f'  Extracted {len(ila_protection_features)} ILA protection features')

print('\nStep 3: Check feature structure')
if ila_protection_features:
    feature = ila_protection_features[0]
    print(f'  First feature keys: {feature.keys()}')
    print(f'  Has geometry: {"geometry" in feature}')
    print(f'  Geometry type: {feature.get("geometry", {}).get("type")}')

print('\nStep 4: Create Shapely geometries')
protection_shapes = []
for zone in ila_protection_features:
    if isinstance(zone, dict) and zone.get('geometry'):
        try:
            shapely_geom = shape(zone['geometry'])
            prepared = prep(shapely_geom)
            protection_shapes.append({
                'geometry': zone['geometry'],
                'prepared': prepared,
                'disease': 'ILA',
                'type': 'PROTECTION'
            })
        except Exception as e:
            print(f'  Error creating shape: {e}')

print(f'  Created {len(protection_shapes)} Shapely protection shapes')

print('\nStep 5: Get facilities and test spatial check')
# Get a few facilities
facilities_raw = bw.get_facilities(limit=100)
print(f'  Fetched {len(facilities_raw)} facilities')

# Count how many facilities are in protection zones
in_zone_count = 0
for facility in facilities_raw[:50]:  # Test first 50
    loc = facility.get('locality', {})
    lat = loc.get('location', {}).get('latitude')
    lon = loc.get('location', {}).get('longitude')
    
    if lat and lon:
        point = Point(lon, lat)
        for shape_data in protection_shapes:
            if shape_data['prepared'].covers(point):
                in_zone_count += 1
                print(f'  ✓ Facility {facility.get("localityNo")} is in ILA protection zone')
                break  # Don't count same facility multiple times

print(f'\nResult: {in_zone_count} out of first 50 facilities are in ILA protection zones')
