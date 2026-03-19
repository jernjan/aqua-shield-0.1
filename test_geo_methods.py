#!/usr/bin/env python3
"""Test get_localities_with_geo vs get_facilities"""
import sys
import json
sys.path.insert(0, 'EKTE_API/src')

from api.clients.barentswatch import BarentsWatchClient

bw = BarentsWatchClient()

print('=== get_facilities() ===')
facilities_old = bw.get_facilities(limit=3)
print(f'Returned {len(facilities_old)} items')
if facilities_old:
    print('\nFirst item structure:')
    print(json.dumps(facilities_old[0], indent=2, ensure_ascii=False))

print('\n\n=== get_localities_with_geo() ===')
facilities_new = bw.get_localities_with_geo(limit=3)
print(f'Returned {len(facilities_new)} items')
if facilities_new:
    print('\nFirst item structure:')
    print(json.dumps(facilities_new[0], indent=2, ensure_ascii=False))
    
    print('\n\nCoordinate check:')
    item = facilities_new[0]
    print(f'  Has "latitude": {"latitude" in item}')
    print(f'  Has "longitude": {"longitude" in item}')
    print(f'  Has "geometry": {"geometry" in item}')
    if 'latitude' in item:
        print(f'  latitude value: {item["latitude"]}')
        print(f'  longitude value: {item["longitude"]}')
