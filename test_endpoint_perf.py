#!/usr/bin/env python3
import requests
import time
import json

def test_endpoint(url, timeout=120):
    print(f'[TEST] Starting endpoint test...')
    print(f'[URL] {url}')
    start = time.time()
    try:
        r = requests.get(url, timeout=timeout)
        elapsed = time.time() - start
        print(f'[RESPONSE] Status: {r.status_code}, Time: {elapsed:.2f}s')
        
        if r.status_code == 200:
            data = r.json()
            print(f'[DATA] Top-level keys: {list(data.keys())}')
            
            if 'vessels' in data:
                print(f'[DATA] Vessels: {len(data.get("vessels", []))}')
                vessels = data.get('vessels', [])
                if vessels:
                    print(f'[SAMPLE_VESSEL] ID={vessels[0].get("mmsi")}, Visits={vessels[0].get("total_visits")}')
            
            # Check for facilities with actual risk_level (these should show as orange if høy in disease_spread
            if 'parameters' in data:
                print(f'[PARAMS] {data["parameters"]}')
            
            if 'risk_facilities_count' in data:
                print(f'[RISK_FACILITIES] Total at-risk: {data["risk_facilities_count"]}')
            
            # NEW: check quarantine breakdown
            if 'quarantine_breakdown' in data:
                print(f'[QUARANTINE_BREAKDOWN] {data["quarantine_breakdown"]}')
            
            if 'visit_category_breakdown' in data:
                print(f'[VISIT_CATEGORY_BREAKDOWN]')
                for cat, count in data['visit_category_breakdown'].items():
                    if count > 0:
                        print(f'  {cat}: {count}')
                        
        else:
            print(f'[ERROR] Response body: {r.text[:500]}')
            
    except requests.exceptions.Timeout:
        elapsed = time.time() - start
        print(f'[TIMEOUT] Request exceeded {timeout}s (elapsed: {elapsed:.2f}s)')
    except Exception as e:
        elapsed = time.time() - start
        print(f'[EXCEPTION] {type(e).__name__}: {str(e)[:200]} (elapsed: {elapsed:.2f}s)')

# Test the main endpoint
test_endpoint('http://127.0.0.1:8000/api/vessels/at-risk-facilities?min_duration_minutes=20&include_test_vessels=false&lookback_days=7')
