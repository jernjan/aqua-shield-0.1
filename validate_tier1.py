#!/usr/bin/env python3
"""Validate all Tier 1 features"""

import requests

base = 'http://127.0.0.1:8000'

print('=== TIER 1 FEATURE VALIDATION ===')
print()

# 1. Database - smittespredning events
try:
    resp = requests.get(f'{base}/api/exposure/smittespredning?limit=10', timeout=3)
    if resp.status_code == 200:
        data = resp.json()
        count = data.get('count', 0)
        print(f'✓ Database: {count} smittespredning events')
    else:
        print('✗ Database API error')
except Exception as e:
    print(f'✗ Database connection failed: {e}')

print()

# 2. Timeline endpoint
try:
    resp = requests.get(f'{base}/api/facilities/FRØ/timeline', timeout=3)
    if resp.status_code == 200:
        print('✓ Timeline endpoint: operational')
    else:
        print('✗ Timeline endpoint error')
except Exception as e:
    print(f'✗ Timeline connection failed: {e}')

print()

# 3. Facility smittespredning endpoint
try:
    resp = requests.get(f'{base}/api/exposure/smittespredning/facility/FRØ', timeout=3)
    if resp.status_code == 200:
        data = resp.json()
        outgoing = data.get('outgoing_paths', {}).get('count', 0)
        print(f'✓ Facility smittespredning: {outgoing} paths from FRØ')
    else:
        print('✗ Facility endpoint error')
except Exception as e:
    print(f'✗ Facility connection failed: {e}')

print()
print('=== DASHBOARDS READY ===')
print('Admin:    http://127.0.0.1:8080 -> "Infection Paths" tab')
print('Facility: http://127.0.0.1:8002 -> Select FRØ -> Timeline panel + "Hvorfor?" link')
