from src.api.clients.ais_client import AISClient

# Get all vessels from AIS
print('Fetching all vessels from AIS...')
ais_client = AISClient()
vessels = ais_client.get_vessels()
print(f'Total vessels in AIS: {len(vessels)}')

# Search for RINGANES
ringanes_vessels = [v for v in vessels if 'RINGANES' in str(v.get('name', '')).upper() or 'RINGANES' in str(v.get('callsign', '')).upper()]
print(f'RINGANES found in AIS: {len(ringanes_vessels)} vessels')

for v in ringanes_vessels[:5]:
    print(f'  - Name: {v.get("name")}, MMSI: {v.get("mmsi")}, Type: {v.get("type")}')
    
# Now test cache
print('\n--- Testing cache ---')
from src.api.main import vessel_assessment_cache, compute_vessel_cache_bg
print('Computing cache...')
compute_vessel_cache_bg()
print(f'Cache size: {len(vessel_assessment_cache)}')

# Check if RINGANES is in cache
for mmsi, v in list(vessel_assessment_cache.items())[:10]:
    if 'RINGANES' in v.get('vessel_name', '').upper():
        print(f'RINGANES in cache: {v}')
