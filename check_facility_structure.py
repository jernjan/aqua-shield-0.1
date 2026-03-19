#!/usr/bin/env python3
"""Check facility data structure"""
import sys
import json
sys.path.insert(0, 'EKTE_API/src')

from api.clients.barentswatch import BarentsWatchClient

bw = BarentsWatchClient()

facilities = bw.get_facilities(limit=5)
print(f'Fetched {len(facilities)} facilities\n')

if facilities:
    print('=== FIRST FACILITY STRUCTURE ===')
    fac = facilities[0]
    print(json.dumps(fac, indent=2, ensure_ascii=False)[:2000])  # First 2000 chars
    
    print('\n\n=== LOCATION CHECK ===')
    for i, fac in enumerate(facilities):
        print(f'\nFacility {i+1}:')
        print(f'  Top-level keys: {list(fac.keys())}')
        
        if 'locality' in fac:
            locality = fac['locality']
            print(f'  locality keys: {list(locality.keys())}')
            
            if 'location' in locality:
                location = locality['location']
                print(f'  location keys: {list(location.keys()) if isinstance(location, dict) else type(location)}')
                print(f'  location value: {location}')
            else:
                print(f'  ❌ NO "location" in locality')
        else:
            print(f'  ❌ NO "locality" key')
