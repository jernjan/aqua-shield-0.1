#!/usr/bin/env python3
"""Test get_lice_data_v2 for coordinates"""
import sys
import json
sys.path.insert(0, 'EKTE_API/src')

from api.clients.barentswatch import BarentsWatchClient

bw = BarentsWatchClient()

print('=== get_lice_data_v2() ===')
try:
    lice_data = bw.get_lice_data_v2()
    print(f'Returned {len(lice_data)} items')
    
    if lice_data:
        print('\nFirst item structure:')
        print(json.dumps(lice_data[0], indent=2, ensure_ascii=False)[:1500])
        
        print('\n\nCoordinate check on first item:')
        item = lice_data[0]
        print(f'  Top-level keys: {list(item.keys())}')
        
        if 'locality' in item:
            locality = item['locality']
            print(f'  locality keys: {list(locality.keys()) if isinstance(locality, dict) else type(locality)}')
            
            if isinstance(locality, dict) and 'location' in locality:
                location = locality['location']
                print(f'  location: {location}')
        
        if 'geometry' in item:
            geom = item['geometry']
            print(f'  geometry type: {geom.get("type") if isinstance(geom, dict) else type(geom)}')
            if isinstance(geom, dict) and 'coordinates' in geom:
                coords = geom['coordinates']
                print(f'  coordinates: {coords}')
                
except Exception as e:
    print(f'ERROR: {e}')
