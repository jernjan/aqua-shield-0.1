#!/usr/bin/env python3
"""Test BarentsWatch API to check disease data."""

from src.api.clients.barentswatch import BarentsWatchClient
import json

client = BarentsWatchClient()
print("Fetching facilities from BarentsWatch v2 API...")
facilities = client.get_lice_data_v2()
print(f"Total facilities: {len(facilities)}")
print()

# Find facilities with diseases
diseased = [f for f in facilities if f.get('diseases') and len(f['diseases']) > 0]
print(f"Facilities with disease: {len(diseased)}")
print()

if diseased:
    print("First 5 diseased facilities:")
    for f in diseased[:5]:
        coords = f.get("geometry", {}).get("coordinates", [0, 0])
        print(f"  Name: {f['locality']['name']} ({f['locality']['no']})")
        print(f"  Diseases: {f['diseases']}")
        print(f"  Coordinates: {coords}")
        print()
else:
    print("No facilities with disease detected!")
    print("\nChecking first facility structure:")
    if facilities:
        print(json.dumps(facilities[0], indent=2, default=str)[:500])
