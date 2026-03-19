import requests
import json

# Test the at-risk endpoint directly
print("Testing /api/vessels/at-risk-facilities...")
try:
    resp = requests.get('http://127.0.0.1:8000/api/vessels/at-risk-facilities?min_duration_minutes=20&include_test_vessels=false', timeout=30)
    print(f"Status: {resp.status_code}")
    data = resp.json()
    
    print(f"\nResponse keys: {list(data.keys())}")
    print(f"Vessels: {len(data.get('vessels', []))}")
    print(f"Visit categories: {data.get('visit_category_breakdown', {})}")
    
    # If we have vessels, show one
    if data.get('vessels'):
        v = data['vessels'][0]
        print(f"\nFirst vessel: {v.get('mmsi')} ({v.get('name')})")
        print(f"  Visits: {len(v.get('visits', []))}")
        if v.get('visits'):
            print(f"  First visit: {v['visits'][0]}")
    
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()

# Also check predictions and disease_spread files
print("\n\n=== CHECKING DATA FILES ===")
try:
    with open('src/api/data/predictions_cache.json', 'r') as f:
        pred_data = json.load(f)
    print(f"Predictions cache: {len(pred_data.get('predictions', []))} predictions")
except Exception as e:
    print(f"Predictions cache error: {e}")

try:
    with open('src/api/data/disease_spread_cache.json', 'r') as f:
        disease_data = json.load(f)
    print(f"Disease spread cache: {len(disease_data.get('all_at_risk_facilities', []))} at-risk facilities")
except Exception as e:
    print(f"Disease spread cache error: {e}")
