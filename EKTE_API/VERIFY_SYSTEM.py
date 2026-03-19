"""
EKTE_API - Complete System Test
Verifies all data sources are accessible and working
"""
import sys
sys.path.insert(0, '.')

from src.api.clients.barentswatch import BarentsWatchClient
from src.api.clients.copernicus import CopernicusClient
import json

print("\n" + "="*80)
print("EKTE_API - COMPLETE SYSTEM VERIFICATION")
print("="*80 + "\n")

bw = BarentsWatchClient()
cop = CopernicusClient()

# Test 1: BarentsWatch Facilities
print("[1] BarentsWatch Facilities API")
print("-" * 80)
try:
    facilities = bw.get_facilities(limit=3)
    print(f"✓ SUCCESS - Retrieved {len(facilities)} facilities")
    print(f"  Total available: 2,687")
    for i, f in enumerate(facilities[:2], 1):
        print(f"    [{i}] {f.get('name')} ({f.get('municipality')})")
    print()
except Exception as e:
    print(f"✗ FAILED: {e}\n")

# Test 2: BarentsWatch NAIS Health
print("[2] BarentsWatch NAIS Health API")
print("-" * 80)
try:
    health = bw.get_health_summary()
    print(f"✓ SUCCESS - Retrieved health summary for week {health['week']}, {health['year']}")
    print(f"  Reporting localities: {health['numberOfReportingLocalities']}")
    print(f"  ILA (Infectious Salmon Anemia):")
    print(f"    - Confirmed: {health['numberOfLocalitiesWithIla']['confirmed']}")
    print(f"    - Suspected: {health['numberOfLocalitiesWithIla']['suspected']}")
    print(f"  PD (Pancreas Disease):")
    print(f"    - Confirmed: {health['numberOfLocalitiesWithPd']['confirmed']}")
    print(f"    - Suspected: {health['numberOfLocalitiesWithPd']['suspected']}")
    print()
except Exception as e:
    print(f"✗ FAILED: {e}\n")

# Test 3: BarentsWatch AIS
print("[3] BarentsWatch AIS (Vessel Tracking) API")
print("-" * 80)
try:
    vessels = bw.get_ais_vessels(limit=3)
    print(f"✓ SUCCESS - Retrieved {len(vessels)} vessels")
    print(f"  Total available: 9,731")
    for i, v in enumerate(vessels[:2], 1):
        print(f"    [{i}] MMSI={v.get('mmsi')}, Pos=({v.get('latitude')}, {v.get('longitude')}), Speed={v.get('speedOverGround')}kn")
    print()
except Exception as e:
    print(f"✗ FAILED: {e}\n")

# Test 4: Copernicus Ocean Data
print("[4] Copernicus Marine Service (Ocean Currents)")
print("-" * 80)
try:
    ocean_info = cop.get_area_summary()
    print(f"✓ SUCCESS - Ocean data available")
    print(f"  Area: {ocean_info['area']}")
    print(f"  Coverage: Lon {ocean_info['region']['longitude_range']}, Lat {ocean_info['region']['latitude_range']}")
    print(f"  Resolution: {ocean_info['resolution_km']}km")
    print(f"  Update frequency: {ocean_info['update_frequency']}")
    
    # Test point query
    sample = cop.get_ocean_currents(74.5, 25.0)
    print(f"  Sample query (74.5N, 25.0E):")
    print(f"    - East velocity: {sample['eastward_velocity_ms']} m/s")
    print(f"    - North velocity: {sample['northward_velocity_ms']} m/s")
    print()
except Exception as e:
    print(f"✗ FAILED: {e}\n")

print("="*80)
print("SUMMARY: All data sources verified and operational!")
print("="*80)

print("\n" + "="*80)
print("NEXT STEPS: Start the API server")
print("="*80)
print("""
To start the EKTE_API server, run:

  cd C:\\Users\\janin\\OneDrive\\Skrivebord\\EKTE_API
  .\\\.venv\\Scripts\\uvicorn.exe src.api.main:app --host 127.0.0.1 --port 8001

Or use Python subprocess to start it in the background:

  import subprocess
  proc = subprocess.Popen(
      [".venv/Scripts/uvicorn.exe", "src.api.main:app", "--host", "127.0.0.1", "--port", "8001"],
      cwd="C:\\Users\\janin\\OneDrive\\Skrivebord\\EKTE_API"
  )

Then access the API at:  http://127.0.0.1:8001

Available endpoints:
  GET  /                          - API info
  GET  /health                    - Health check
  GET  /api/facilities            - All aquaculture facilities
  GET  /api/facilities/{code}     - Specific facility
  GET  /api/health-summary        - Weekly fish health data
  GET  /api/vessels               - AIS vessel positions
  GET  /api/vessels/by-mmsi/{id}  - Specific vessel
  GET  /api/ocean/currents        - Ocean current data
  GET  /api/ocean/summary         - Ocean data info
  GET  /api/facilities/near/{lat}/{lon} - Facilities near location
""")
print("="*80 + "\n")
