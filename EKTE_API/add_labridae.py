"""Add Labridae with real MMSI to ship names cache"""
import json

CACHE_FILE = "ship_names_cache.json"

# Load existing cache
with open(CACHE_FILE, 'r', encoding='utf-8') as f:
    cache = json.load(f)

# Add Labridae with real MMSI
cache["257051270"] = "LABRIDAE"

# Save cache
with open(CACHE_FILE, 'w', encoding='utf-8') as f:
    json.dump(cache, f, ensure_ascii=False, indent=2)

print(f"✓ Added LABRIDAE (MMSI: 257051270) to cache")
print(f"Total vessels in cache: {len(cache)}")

# Verify it was added
from src.api.ship_cache import get_ship_name
name = get_ship_name("257051270")
print(f"Verification: get_ship_name('257051270') = {name}")
