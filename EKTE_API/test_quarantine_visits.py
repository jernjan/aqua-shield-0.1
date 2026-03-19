import requests
import json

# Test the API endpoint
url = "http://localhost:8000/api/vessels/at-risk-facilities"
params = {"include_test_vessels": "true"}

try:
    response = requests.get(url, params=params)
    response.raise_for_status()
    data = response.json()
    
    print("\n=== CHECKING QUARANTINE VESSELS ===\n")
    
    # Find a vessel likely from quarantine (facility_code: null)
    quarantine_vessels = [v for v in data['vessels'] if any(vis.get('facility_code') is None for vis in v.get('visits', []))]
    exposure_vessels = [v for v in data['vessels'] if all(vis.get('facility_code') is not None for vis in v.get('visits', []))]
    
    print(f"Vessels with null facility_code (quarantine): {len(quarantine_vessels)}")
    print(f"Vessels with facility_code (exposure events): {len(exposure_vessels)}")
    
    if quarantine_vessels:
        print("\n=== SAMPLE QUARANTINE VESSEL ===")
        vessel = quarantine_vessels[0]
        print(f"MMSI: {vessel['mmsi']}")
        print(f"Name: {vessel['vessel_name']}")
        print(f"Visits: {vessel['total_visits']}")
        for i, visit in enumerate(vessel['visits'][:2]):
            print(f"\nVisit {i+1}:")
            print(f"  - Facility code: {visit.get('facility_code')}")
            print(f"  - Facility name: {visit['facility_name']}")
            print(f"  - Visit category: {visit.get('visit_category', 'MISSING!')}")
            print(f"  - Infected: {visit['infected']}")
    
    if exposure_vessels:
        print("\n\n=== SAMPLE EXPOSURE EVENT VESSEL ===")
        vessel = exposure_vessels[0]
        print(f"MMSI: {vessel['mmsi']}")
        print(f"Name: {vessel['vessel_name']}")
        print(f"Visits: {vessel['total_visits']}")
        for i, visit in enumerate(vessel['visits'][:2]):
            print(f"\nVisit {i+1}:")
            print(f"  - Facility code: {visit.get('facility_code')}")
            print(f"  - Facility name: {visit['facility_name']}")
            print(f"  - Visit category: {visit.get('visit_category', 'MISSING!')}")
            print(f"  - Infected: {visit['infected']}")
    
except Exception as e:
    print(f"Error: {e}")
