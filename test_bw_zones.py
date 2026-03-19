#!/usr/bin/env python3
"""Test BarentsWatch zone fetching"""
import sys
sys.path.insert(0, 'EKTE_API/src')

from datetime import datetime
from api.clients.barentswatch import BarentsWatchClient

# Get current week
today = datetime.now()
year = today.year
week = today.isocalendar()[1]
print(f'Current: Year={year}, Week={week}')
print(f'Date: {today.strftime("%Y-%m-%d")}')

# Try to fetch zones
bw = BarentsWatchClient()

print('\n📡 Testing ILA zones (current week)...')
try:
    ila = bw.get_ila_zones()
    print(f'  Protection zones: {len(ila.get("protection_zones", []))}')
    print(f'  Surveillance zones: {len(ila.get("surveillance_zones", []))}')
    if ila.get("protection_zones"):
        print(f'  First protection zone keys: {list(ila["protection_zones"][0].keys())[:5]}')
except Exception as e:
    print(f'  Error: {e}')
    import traceback
    traceback.print_exc()

print('\n📡 Testing PD zones (current week)...')
try:
    pd = bw.get_pd_zones()
    print(f'  Protection zones: {len(pd.get("protection_zones", []))}')
    print(f'  Surveillance zones: {len(pd.get("surveillance_zones", []))}')
except Exception as e:
    print(f'  Error: {e}')

# Try older week (when cache was created - 2026-03-08 = week 10)
print('\n📡 Testing week 10 (when cache was created on 2026-03-08)...')
try:
    ila_old = bw.get_ila_zones(year=2026, week=10)
    print(f'  ILA Protection: {len(ila_old.get("protection_zones", []))}')
    print(f'  ILA Surveillance: {len(ila_old.get("surveillance_zones", []))}')
except Exception as e:
    print(f'  Error: {e}')

# Try a few recent weeks
print('\n📡 Testing recent weeks...')
for test_week in [9, 10, 11]:
    try:
        test_ila = bw.get_ila_zones(year=2026, week=test_week)
        count = len(test_ila.get("protection_zones", [])) + len(test_ila.get("surveillance_zones", []))
        print(f'  Week {test_week}: {count} zones')
    except Exception as e:
        print(f'  Week {test_week}: Error - {e}')
