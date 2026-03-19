#!/usr/bin/env python3
"""Simple test of disease-spread API"""
import requests
import json

try:
    print('Calling API...')
    response = requests.get('http://127.0.0.1:8000/api/facilities/disease-spread', timeout=90)
    data = response.json()
    
    print('\n=== RESULTS ===')
    print(f'Status code: {response.status_code}')
    
    if 'all_at_risk_facilities' in data:
        all_facilities = data['all_at_risk_facilities']
        ekstrem = [f for f in all_facilities if f.get('risk_level') == 'Ekstrem']
        hoy = [f for f in all_facilities if f.get('risk_level') == 'Høy']
        
        print(f'Ekstrem (RED): {len(ekstrem)}')
        print(f'Høy (ORANGE): {len(hoy)}')
        print(f'Total at risk: {len(all_facilities)}')
        
        if all_facilities:
            print(f'\nFirst affected facility:')
            print(json.dumps(all_facilities[0], indent=2, ensure_ascii=False))
    
    print(f'\nILA protection zones: {data.get("ila_protection_zones")}')
    print(f'ILA surveillance zones: {data.get("ila_surveillance_zones")}')
    
except Exception as e:
    print(f'ERROR: {e}')
    import traceback
    traceback.print_exc()
