import requests

# Check current visit categories
resp = requests.get('http://127.0.0.1:8000/api/vessels/at-risk-facilities?hours=96', timeout=30)
data = resp.json()

cats = {}
vessel_count_by_cat = {}

for v in data.get('vessels', []):
    has_cats = set()
    for vis in v.get('visits', []):
        cat = vis.get('visit_category')
        if cat:
            cats[cat] = cats.get(cat, 0) + 1
            has_cats.add(cat)
    
    # Track vessels by their categories
    cat_key = ','.join(sorted(has_cats))
    vessel_count_by_cat[cat_key] = vessel_count_by_cat.get(cat_key, 0) + 1

print("=== VISIT CATEGORIES ===")
for cat in sorted(cats.keys()):
    print(f"{cat}: {cats[cat]}")

print("\n=== VESSELS BY CATEGORY COMBINATION ===")
for combo in sorted(vessel_count_by_cat.keys()):
    print(f"{combo or 'none'}: {vessel_count_by_cat[combo]} vessels")

# Check if there are any infected facilities
print("\n=== CHECKING FOR NEAR_INFECTED_10KM ===")
near_infect = sum([vis.get('visit_category') == 'near_infected_10km' for v in data.get('vessels', []) for vis in v.get('visits', [])])
print(f"near_infected_10km visits: {near_infect}")

if near_infect == 0:
    print("⚠️ NO BOATS WITH near_infected_10km CATEGORY FOUND!")
    print("This is the issue the user mentioned.")
