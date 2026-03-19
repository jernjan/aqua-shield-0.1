#!/usr/bin/env python3
"""Test FULL pipeline with get_lice_data_v2()"""
import sys
sys.path.insert(0, 'EKTE_API/src')

from api.clients.barentswatch import BarentsWatchClient
from shapely.geometry import Point, shape
from shapely.prepared import prep

bw = BarentsWatchClient()

print('Step 1: Fetch zones')
ila_zones = bw.get_ila_zones()

def extract_geo_features(zone_payload):
    if isinstance(zone_payload, dict):
        features = zone_payload.get('features')
        if isinstance(features, list):
            return features
        return []
    return []

ila_protection = extract_geo_features(ila_zones.get('protection_zones', {}))
ila_surveillance = extract_geo_features(ila_zones.get('surveillance_zones', {}))
print(f'  Protection zones: {len(ila_protection)}')
print(f'  Surveillance zones: {len(ila_surveillance)}')

print('\nStep 2: Create Shapely geometries')
all_shapes = []
for zone in ila_protection:
    if zone.get('geometry'):
        all_shapes.append({
            'prepared': prep(shape(zone['geometry'])),
            'severity': 'Ekstrem',
            'type': 'PROTECTION'
        })
for zone in ila_surveillance:
    if zone.get('geometry'):
        all_shapes.append({
            'prepared': prep(shape(zone['geometry'])),
            'severity': 'Høy',
            'type': 'SURVEILLANCE'
        })
print(f'  Created {len(all_shapes)} geometries')

print('\nStep 3: Fetch facilities using get_lice_data_v2()')
facilities = bw.get_lice_data_v2()
print(f'  Got {len(facilities)} facilities')

print('\nStep 4: Normalize facilities')
def normalize_facility(raw_facility):
    if not isinstance(raw_facility, dict):
        return None

    locality = raw_facility.get('locality')
    coordinates = raw_facility.get('geometry', {}).get('coordinates') if isinstance(raw_facility.get('geometry'), dict) else None

    if isinstance(locality, dict):
        facility_code = locality.get('no')
        facility_name = locality.get('name')
    else:
        facility_code = raw_facility.get('localityNo')
        facility_name = raw_facility.get('name')

    if isinstance(coordinates, (list, tuple)) and len(coordinates) >= 2:
        longitude = coordinates[0]
        latitude = coordinates[1]
    else:
        latitude = raw_facility.get('latitude')
        longitude = raw_facility.get('longitude')

    if latitude is None or longitude is None:
        return None

    return {
        'facility_code': facility_code,
        'facility_name': facility_name,
        'latitude': latitude,
        'longitude': longitude,
        'diseases': raw_facility.get('diseases', []) or [],
    }

normalized_count = 0
for fac in facilities:
    if normalize_facility(fac):
        normalized_count += 1

print(f'  Successfully normalized {normalized_count}/{len(facilities)} facilities')

print('\nStep 5: Spatial check')
ekstrem_count = 0
hoy_count = 0

for facility in facilities:
    norm = normalize_facility(facility)
    if not norm:
        continue
    
    point = Point(norm['longitude'], norm['latitude'])
    
    for shape_data in all_shapes:
        try:
            if shape_data['prepared'].covers(point):
                if shape_data['severity'] == 'Ekstrem':
                    ekstrem_count += 1
                elif shape_data['severity'] == 'Høy':
                    hoy_count += 1
                break
        except Exception as e:
            print(f'Error: {e}')

print(f'\n✅ FINAL RESULTS:')
print(f'  Ekstrem facilities: {ekstrem_count}')
print(f'  Høy facilities: {hoy_count}')
print(f'  Total at risk: {ekstrem_count + hoy_count}')
