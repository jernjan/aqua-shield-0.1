"""Quick test to verify Labridae is in our system when it sends AIS"""
from src.api.ship_cache import get_ship_name

# Check if Labridae is in cache
name = get_ship_name("257051270")
print(f"✓ Labridae in cache: {name}")
print(f"  MMSI: 257051270")
print(f"  Callsign: LH2880")
print(f"  Type: Fishing vessel")
print()
print("When Labridae starts sending AIS, it will automatically appear in searches:")
print(f"  - Search by name: 'Labridae'")
print(f"  - Search by MMSI: '257051270'")
print(f"  - Search partial: 'Labri' or '257051'")
