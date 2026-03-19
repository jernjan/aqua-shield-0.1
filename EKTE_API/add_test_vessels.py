"""Manually add Labridae to ship names cache for testing"""
import json

CACHE_FILE = "ship_names_cache.json"

# Load existing cache
with open(CACHE_FILE, 'r', encoding='utf-8') as f:
    cache = json.load(f)

# Add some test vessels including Labridae
# Using a fake MMSI for testing - in reality, we'd need the real MMSI
test_vessels = {
    "999888777": "LABRIDAE",  # Test entry
    "999888778": "LABRIDAE II",  # Another test entry
}

# Add to cache
cache.update(test_vessels)

# Save cache
with open(CACHE_FILE, 'w', encoding='utf-8') as f:
    json.dump(cache, f, ensure_ascii=False, indent=2)

print(f"Added {len(test_vessels)} test vessels to cache")
print("Test vessels added:")
for mmsi, name in test_vessels.items():
    print(f"  • {name} (MMSI: {mmsi})")
