#!/usr/bin/env python3
"""Test with BOTH protection and surveillance zones"""
import sys
sys.path.insert(0, 'EKTE_API/src')

from api.clients.barentswatch import BarentsWatchClient
from shapely.geometry import Point, shape
from shapely.prepared import prep

bw = BarentsWatchClient()

print('Fetching zones...')
ila_zones = bw.get_ila_zones()
pd_zones = bw.get_pd_zones()

def extract_geo_features(zone_payload):
    if isinstance(zone_payload, dict):
        features = zone_payload.get('features')
        if isinstance(features, list):
            return features
        return []
    if isinstance(zone_payload, list):
        return [item for item in zone_payload if isinstance(item, dict)]
    return []

# Extract ALL zone types
ila_protection = extract_geo_features(ila_zones.get('protection_zones', {}))
ila_surveillance = extract_geo_features(ila_zones.get('surveillance_zones', {}))
pd_protection = extract_geo_features(pd_zones.get('protection_zones', {}))
pd_surveillance = extract_geo_features(pd_zones.get('surveillance_zones', {}))

print(f'\nZone counts:')
print(f'  ILA protection: {len(ila_protection)}')
print(f'  ILA surveillance: {len(ila_surveillance)}')
print(f'  PD protection: {len(pd_protection)}')
print(f'  PD surveillance: {len(pd_surveillance)}')
print(f'  TOTAL: {len(ila_protection) + len(ila_surveillance) + len(pd_protection) + len(pd_surveillance)}')

# Create shapes for ALL zones
all_shapes = []

for zone in ila_protection:
    if zone.get('geometry'):
        all_shapes.append({
            'prepared': prep(shape(zone['geometry'])),
            'disease': 'ILA',
            'type': 'PROTECTION',
            'severity': 'Ekstrem'
        })

for zone in ila_surveillance:
    if zone.get('geometry'):
        all_shapes.append({
            'prepared': prep(shape(zone['geometry'])),
            'disease': 'ILA',
            'type': 'SURVEILLANCE',
            'severity': 'Høy'
        })

for zone in pd_protection:
    if zone.get('geometry'):
        all_shapes.append({
            'prepared': prep(shape(zone['geometry'])),
            'disease': 'PD',
            'type': 'PROTECTION',
            'severity': 'Ekstrem'
        })

for zone in pd_surveillance:
    if zone.get('geometry'):
        all_shapes.append({
            'prepared': prep(shape(zone['geometry'])),
            'disease': 'PD',
            'type': 'SURVEILLANCE',
            'severity': 'Høy'
        })

print(f'\nCreated {len(all_shapes)} Shapely geometries')

# Get facilities
facilities = bw.get_facilities(limit=3000)
print(f'\nTesting {len(facilities)} facilities...')

# Test all facilities
ekstrem_count = 0
hoy_count = 0
affected_facilities = []

for facility in facilities:
    loc = facility.get('locality', {})
    lat = loc.get('location', {}).get('latitude')
    lon = loc.get('location', {}).get('longitude')
    
    if lat and lon:
        point = Point(lon, lat)
        
        for shape_data in all_shapes:
            try:
                if shape_data['prepared'].covers(point):
                    if shape_data['severity'] == 'Ekstrem':
                        ekstrem_count += 1
                    elif shape_data['severity'] == 'Høy':
                        hoy_count += 1
                    
                    affected_facilities.append({
                        'name': loc.get('name'),
                        'localityNo': facility.get('localityNo'),
                        'severity': shape_data['severity'],
                        'disease': shape_data['disease'],
                        'type': shape_data['type']
                    })
                    break  # Stop at first match
            except Exception as e:
                print(f'Error checking facility: {e}')
                pass

print(f'\n✅ RESULTS:')
print(f'  Ekstrem (RED) facilities: {ekstrem_count}')
print(f'  Høy (ORANGE) facilities: {hoy_count}')
print(f'  Total at risk: {len(affected_facilities)}')

if affected_facilities:
    print(f'\nFirst 5 affected facilities:')
    for fac in affected_facilities[:5]:
        print(f'  - {fac["name"]} ({fac["localityNo"]}): {fac["severity"]} - {fac["disease"]} {fac["type"]}')
