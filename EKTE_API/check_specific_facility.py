import urllib.request
import json

resp = urllib.request.urlopen('http://127.0.0.1:8002/api/risk/assess?limit=100')
data = json.loads(resp.read())

# Find facilities with diseases in their disease_status
with_diseases = [f for f in data.get('assessments', []) if f.get('disease_status', {}).get('diseases')]

print(f"Facilities with diseases in response: {len(with_diseases)}")

if with_diseases:
    print("\nFirst facility with diseases:")
    fac = with_diseases[0]
    print(json.dumps(fac, indent=2))
else:
    # Look for facility 45159 specifically
    fac45159 = [f for f in data.get('assessments', []) if f['facility_code'] == '45159']
    if fac45159:
        print("\nFacility 45159 (known to have diseases):")
        print(json.dumps(fac45159[0], indent=2))
    else:
        print("\nFacility 45159 not in first 100 results")
        print("Looking for any ILA/PD...")
        ila_pd = [f for f in data.get('assessments', []) if f['disease_status']['has_ila'] or f['disease_status']['has_pd']]
        print(f"Facilities with has_ila/has_pd: {len(ila_pd)}")
        if ila_pd:
            print(json.dumps(ila_pd[0], indent=2))
