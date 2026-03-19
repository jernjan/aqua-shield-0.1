import requests
import json

# Test the API endpoint
url = "http://localhost:8000/api/vessels/at-risk-facilities"
params = {"include_test_vessels": "true"}

try:
    response = requests.get(url, params=params)
    response.raise_for_status()
    data = response.json()
    
    print("\n=== VESSEL CATEGORIZATION TEST ===\n")
    print(f"Total vessels: {data['total_vessels']}")
    print(f"Quarantine vessels added: {data['quarantine_vessels_added']}")
    print(f"Risk facilities count: {data['risk_facilities_count']}")
    print("\nVisit Category Breakdown:")
    print(f"  - Infected facilities: {data['visit_category_breakdown']['infected_facilities']}")
    print(f"  - Risk zone facilities: {data['visit_category_breakdown']['risk_zone_facilities']}")
    print(f"  - Near infected 10km: {data['visit_category_breakdown']['near_infected_10km']}")
    
    # Show a sample vessel with visits
    if data['vessels']:
        print("\n=== SAMPLE VESSEL ===")
        vessel = data['vessels'][0]
        print(f"MMSI: {vessel['mmsi']}")
        print(f"Name: {vessel['vessel_name']}")
        print(f"Visits: {vessel['total_visits']}")
        if vessel['visits']:
            visit = vessel['visits'][0]
            print(f"First visit:")
            print(f"  - Facility: {visit['facility_name']}")
            print(f"  - Category: {visit.get('visit_category', 'MISSING')}")
            print(f"  - Infected: {visit['infected']}")
    
except Exception as e:
    print(f"Error: {e}")
