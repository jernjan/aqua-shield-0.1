#!/usr/bin/env python3
"""Quick test of smittespredning API endpoints"""

import requests
import json
from datetime import datetime

BASE_URL = "http://127.0.0.1:8000"

def test_create_event():
    """Test creating a smittespredning event"""
    data = {
        'vessel_mmsi': '259234000',
        'facility_start_id': 'FRØ',
        'facility_start_disease': 'PD',
        'vessel_name': 'Libridae',
        'facility_start_name': 'Frøy',
        'detected_via': 'AIS',
        'notes': 'Test smittespredning logging'
    }
    
    try:
        resp = requests.post(
            f'{BASE_URL}/api/exposure/smittespredning',
            json=data,
            timeout=5
        )
        if resp.status_code == 200:
            result = resp.json()
            event_id = result.get('event_id')
            print(f'✓ Created event ID: {event_id}')
            print(f'  Status: {result.get("path_risk_status")}')
            print(f'  Vessel: {result.get("vessel_mmsi")}')
            print(f'  Facility: {result.get("facility_start_id")}')
            return event_id
        else:
            print(f'✗ Error {resp.status_code}: {resp.text}')
            return None
    except Exception as e:
        print(f'✗ Failed to create: {e}')
        return None


def test_get_all_events():
    """Test getting all smittespredning events"""
    try:
        resp = requests.get(
            f'{BASE_URL}/api/exposure/smittespredning',
            params={'limit': 10},
            timeout=5
        )
        if resp.status_code == 200:
            result = resp.json()
            count = result.get('count', 0)
            print(f'\n✓ Got {count} events from database')
            if count > 0:
                first = result.get('events', [{}])[0]
                print(f'  Latest: {first.get("vessel_mmsi")} at {first.get("facility_start_id")}')
        else:
            print(f'✗ Error: {resp.status_code}')
    except Exception as e:
        print(f'✗ Failed: {e}')


def test_update_event(event_id):
    """Test updating a smittespredning event"""
    if not event_id:
        print('\nSkipping update test (no event ID)')
        return
        
    update_data = {
        'facility_end_id': 'GJE',
        'facility_end_name': 'Gjermundnes',
        'timestamp_end': datetime.utcnow().isoformat(),
        'path_risk_status': 'CONFIRMED_HEALTHY',
        'notes': 'Health check passed after 48h'
    }
    
    try:
        resp = requests.put(
            f'{BASE_URL}/api/exposure/smittespredning/{event_id}',
            json=update_data,
            timeout=5
        )
        if resp.status_code == 200:
            print(f'\n✓ Updated event {event_id}')
            print(f'  New status: {resp.json().get("path_risk_status")}')
        else:
            print(f'\n✗ Update failed: {resp.status_code}')
    except Exception as e:
        print(f'\n✗ Update error: {e}')


def test_facility_paths():
    """Test getting paths for a facility"""
    try:
        resp = requests.get(
            f'{BASE_URL}/api/exposure/smittespredning/facility/FRØ',
            timeout=5
        )
        if resp.status_code == 200:
            result = resp.json()
            outgoing = result.get('outgoing_paths', {}).get('count', 0)
            incoming = result.get('incoming_paths', {}).get('count', 0)
            print(f'\n✓ Facility FRØ paths:')
            print(f'  Outgoing (detected at this facility): {outgoing}')
            print(f'  Incoming (risk paths toward this facility): {incoming}')
        else:
            print(f'\n✗ Error: {resp.status_code}')
    except Exception as e:
        print(f'\n✗ Failed: {e}')


if __name__ == '__main__':
    print("=== Smittespredning API Test ===\n")
    
    # Test creation
    event_id = test_create_event()
    
    # Test retrieval
    test_get_all_events()
    
    # Test update
    test_update_event(event_id)
    
    # Test facility view
    test_facility_paths()
    
    print("\n✓ All tests completed")
