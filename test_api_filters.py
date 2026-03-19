import requests
import json
from datetime import datetime

BASE_URL = "http://127.0.0.1:8000"

print("=" * 80)
print("API TESTING - Filter Functions, Times, Distances")
print("=" * 80)

# Test 1: Get all at-risk vessels with default parameters
print("\n📋 TEST 1: All at-risk vessels (default)")
print("-" * 80)
response = requests.get(f"{BASE_URL}/api/vessels/at-risk-facilities")
if response.status_code == 200:
    data = response.json()
    print(f"✅ Status: {response.status_code}")
    print(f"Total vessels: {len(data.get('vessels', []))}")
    print(f"Summary:")
    for key, value in data.get('summary', {}).items():
        print(f"  {key}: {value}")
else:
    print(f"❌ Error: {response.status_code}")

# Test 2: Filter by minimum duration
print("\n📋 TEST 2: Filter by min_duration_minutes=20")
print("-" * 80)
response = requests.get(f"{BASE_URL}/api/vessels/at-risk-facilities?min_duration_minutes=20")
if response.status_code == 200:
    data = response.json()
    print(f"✅ Status: {response.status_code}")
    print(f"Total vessels: {len(data.get('vessels', []))}")
    
    # Check first few vessels
    if data.get('vessels'):
        print("\nSample vessels (checking visit durations):")
        for vessel in data['vessels'][:3]:
            print(f"\n  {vessel.get('vessel_name', 'Unknown')} (MMSI: {vessel.get('mmsi')})")
            print(f"  Status: {vessel.get('risk_status')}")
            if vessel.get('visits'):
                print(f"  Visits: {len(vessel['visits'])}")
                for visit in vessel['visits'][:2]:
                    duration = visit.get('duration_minutes', 0)
                    print(f"    - {visit.get('facility_name')}: {duration} min, {visit.get('distance_meters')} m")
else:
    print(f"❌ Error: {response.status_code}")

# Test 3: Exclude test vessels
print("\n📋 TEST 3: Exclude test vessels")
print("-" * 80)
response_all = requests.get(f"{BASE_URL}/api/vessels/at-risk-facilities?include_test_vessels=true")
response_real = requests.get(f"{BASE_URL}/api/vessels/at-risk-facilities?include_test_vessels=false")

if response_all.status_code == 200 and response_real.status_code == 200:
    all_data = response_all.json()
    real_data = response_real.json()
    all_count = len(all_data.get('vessels', []))
    real_count = len(real_data.get('vessels', []))
    print(f"✅ With test vessels: {all_count}")
    print(f"✅ Without test vessels: {real_count}")
    print(f"Test vessels filtered: {all_count - real_count}")
else:
    print(f"❌ Error")

# Test 4: Lookback days filter
print("\n📋 TEST 4: Lookback days filter")
print("-" * 80)
for days in [1, 3, 7]:
    response = requests.get(f"{BASE_URL}/api/vessels/at-risk-facilities?lookback_days={days}")
    if response.status_code == 200:
        data = response.json()
        count = len(data.get('vessels', []))
        print(f"✅ lookback_days={days}: {count} vessels")
    else:
        print(f"❌ Error for lookback_days={days}")

# Test 5: Check for nearby_infected_facilities field
print("\n📋 TEST 5: Check nearby_infected_facilities field (NEW)")
print("-" * 80)
response = requests.get(f"{BASE_URL}/api/vessels/at-risk-facilities")
if response.status_code == 200:
    data = response.json()
    
    # Find vessels with cluster visits
    cluster_visits = []
    for vessel in data.get('vessels', []):
        for visit in vessel.get('visits', []):
            if 'near_infected' in visit.get('visit_category', ''):
                cluster_visits.append({
                    'vessel': vessel.get('vessel_name'),
                    'visit': visit
                })
    
    if cluster_visits:
        print(f"✅ Found {len(cluster_visits)} cluster visits")
        print("\nSample cluster visit:")
        sample = cluster_visits[0]
        print(f"  Vessel: {sample['vessel']}")
        print(f"  Visited facility: {sample['visit'].get('facility_name')}")
        print(f"  Distance: {sample['visit'].get('distance_meters')} m")
        print(f"  Category: {sample['visit'].get('visit_category')}")
        
        if 'nearby_infected_facilities' in sample['visit']:
            nearby = sample['visit']['nearby_infected_facilities']
            print(f"  ✅ nearby_infected_facilities field exists!")
            print(f"  Nearby infected facilities: {len(nearby)}")
            for inf in nearby[:3]:
                print(f"    - {inf.get('facility_name')}: {inf.get('distance_km')} km away")
        else:
            print(f"  ❌ nearby_infected_facilities field MISSING!")
    else:
        print("No cluster visits found to test")
else:
    print(f"❌ Error: {response.status_code}")

# Test 6: Validate distances
print("\n📋 TEST 6: Validate all distances ≤ 1 km")
print("-" * 80)
response = requests.get(f"{BASE_URL}/api/vessels/at-risk-facilities")
if response.status_code == 200:
    data = response.json()
    
    invalid_distances = []
    for vessel in data.get('vessels', []):
        for visit in vessel.get('visits', []):
            dist_m = visit.get('distance_meters', 0)
            if dist_m > 1000:
                invalid_distances.append({
                    'vessel': vessel.get('vessel_name'),
                    'facility': visit.get('facility_name'),
                    'distance': dist_m
                })
    
    if invalid_distances:
        print(f"❌ Found {len(invalid_distances)} visits with distance > 1 km!")
        for inv in invalid_distances[:5]:
            print(f"  {inv['vessel']} -> {inv['facility']}: {inv['distance']} m")
    else:
        print(f"✅ All visits have distance ≤ 1000 m (valid!)")
else:
    print(f"❌ Error: {response.status_code}")

# Test 7: Check timestamp formatting
print("\n📋 TEST 7: Timestamp formatting")
print("-" * 80)
response = requests.get(f"{BASE_URL}/api/vessels/at-risk-facilities")
if response.status_code == 200:
    data = response.json()
    
    if data.get('vessels'):
        vessel = data['vessels'][0]
        if vessel.get('visits'):
            visit = vessel['visits'][0]
            timestamp = visit.get('timestamp')
            print(f"✅ Sample timestamp: {timestamp}")
            
            # Try to parse it
            try:
                dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                print(f"✅ Timestamp is valid ISO format")
                print(f"   Parsed: {dt}")
            except Exception as e:
                print(f"❌ Timestamp parsing error: {e}")
else:
    print(f"❌ Error: {response.status_code}")

print("\n" + "=" * 80)
print("✅ API TESTING COMPLETE")
print("=" * 80)
