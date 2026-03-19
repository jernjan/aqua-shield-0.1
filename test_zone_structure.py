#!/usr/bin/env python3
"""Test disease spread endpoint logic"""
import sys
sys.path.insert(0, 'EKTE_API/src')

from api.clients.barentswatch import BarentsWatchClient

bw = BarentsWatchClient()

print('Fetching ILA zones...')
ila = bw.get_ila_zones()

print(f'\nILA Protection zones: {len(ila.get("protection_zones", []))}')
if ila.get("protection_zones"):
    zone = ila["protection_zones"]
    print(f'Type of protection_zones: {type(zone)}')
    print(f'Content: {zone}')

print(f'\nILA Surveillance zones: {len(ila.get("surveillance_zones", []))}')
if ila.get("surveillance_zones"):
    zone = ila["surveillance_zones"]
    print(f'Type of surveillance_zones: {type(zone)}')
    print(f'Content: {zone}')

# Check if it's a FeatureCollection
if isinstance(ila.get("protection_zones"), dict):
    print(f'\nProtection zones is a dict with keys: {ila["protection_zones"].keys()}')
    if "features" in ila["protection_zones"]:
        print(f'  Has features array with {len(ila["protection_zones"]["features"])} items')
