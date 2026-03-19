#!/usr/bin/env python3
"""Create test smittespredning events"""

import requests
from datetime import datetime

base = 'http://127.0.0.1:8000'

test_cases = [
    {
        'vessel_mmsi': '259234001',
        'facility_start_id': 'FRØ',
        'facility_start_disease': 'PD',
        'vessel_name': 'Libridae I',
        'facility_start_name': 'Frøy',
        'detected_via': 'AIS',
        'notes': 'Detected via AIS near infected facility'
    },
    {
        'vessel_mmsi': '259234002',
        'facility_start_id': 'SMØRU',
        'facility_start_disease': 'ILA',
        'vessel_name': 'Salmon Master',
        'facility_start_name': 'Smørolova',
        'detected_via': 'planned_route',
        'notes': 'Planned route shows intended visit'
    },
    {
        'vessel_mmsi': '259234003',
        'facility_start_id': 'HJØRNEVIK',
        'facility_start_disease': 'PD',
        'vessel_name': 'Fish Feeder 5',
        'facility_start_name': 'Hjørnevik',
        'detected_via': 'AIS',
        'notes': 'High-risk movement detected'
    },
    {
        'vessel_mmsi': '259234001',
        'facility_start_id': 'SMØRU',
        'facility_start_disease': 'ILA',
        'vessel_name': 'Libridae I',
        'facility_start_name': 'Smørolova',
        'detected_via': 'AIS',
        'notes': 'Secondary infection source'
    }
]

print("Creating test smittespredning events...\n")

for tc in test_cases:
    try:
        resp = requests.post(
            f'{base}/api/exposure/smittespredning',
            json=tc,
            timeout=3
        )
        if resp.status_code == 200:
            eid = resp.json().get('event_id')
            print(f"✓ Event {eid}: {tc['vessel_name']} at {tc['facility_start_id']} ({tc['facility_start_disease']})")
        else:
            print(f"✗ Failed: {resp.status_code}")
    except Exception as e:
        print(f"✗ Error: {e}")

print("\n✓ Test data created. Check admin dashboard 'Infection Paths' tab.")
