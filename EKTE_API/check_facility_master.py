import json

with open('src/api/data/facility_master.json', 'r') as f:
    data = json.load(f)

print(f"Keys in root: {list(data.keys())}")

facilities = data.get('facilities', {})
print(f"Type of facilities: {type(facilities)}")
print(f"Number of facilities: {len(facilities)}")

# Get first facility code
first_code = list(facilities.keys())[0] if isinstance(facilities, dict) else None
if first_code:
    fac = facilities[first_code]
    print(f"\nFirst facility: {first_code}")
    print(f"  Name: {fac.get('facility_name')}")
    print(f"  Infected: {fac.get('is_infected')}")
    print(f"  Latitude: {fac.get('latitude')}")
    print(f"  Longitude: {fac.get('longitude')}")

# Check for specific facilities we inserted
test_codes = ['10086', '10300', '19977', '50001']
print(f"\nLooking for test facilities...")
for code in test_codes:
    if code in facilities:
        f = facilities[code]
        print(f"✓ Found {code}: {f.get('facility_name')} (Infected: {f.get('is_infected')})")
    else:
        print(f"✗ NOT found: {code}")
