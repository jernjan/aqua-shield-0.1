from src.api.clients.barentswatch import BarentsWatchClient

bw = BarentsWatchClient()
lice_data = bw.get_lice_data_v2()

# Find facilities with diseases
with_diseases = [f for f in lice_data if f.get('diseases')]

print(f"Total facilities: {len(lice_data)}")
print(f"Facilities with diseases: {len(with_diseases)}")

if with_diseases:
    print("\nFirst facility with diseases:")
    fac = with_diseases[0]
    print(f"  facility_code: {fac.get('code')}")
    print(f"  localityNo: {fac.get('localityNo')}")
    locality = fac.get('locality')
    if isinstance(locality, dict):
        print(f"  locality.no: {locality.get('no')}")
    print(f"  diseases: {fac.get('diseases')}")
