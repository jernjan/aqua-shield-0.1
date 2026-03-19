"""Check infected facilities in facility_master"""
import sys
sys.path.insert(0, r'c:\Users\janin\OneDrive\Skrivebord\Kyst monitor DEMO\EKTE_API')

from src.api import facility_master

# Get infected facilities
infected = facility_master.get_infected_facilities()
print(f'Infected facilities with coordinates: {len(infected)}')

if len(infected) > 0:
    print('\nSample infected facilities:')
    for f in infected[:5]:
        diseases = ', '.join(f.get('diseases', []))
        print(f"  {f['facility_code']}: {f['facility_name']}")
        print(f"    Location: ({f['latitude']}, {f['longitude']})")
        print(f"    Diseases: {diseases}")

# Check all facilities
all_facs = facility_master.load_facility_master()
print(f'\nTotal facilities in master: {len(all_facs)}')
with_coords = len([f for f in all_facs.values() if f.get('latitude') and f.get('longitude')])
print(f'Facilities with coordinates: {with_coords}')
