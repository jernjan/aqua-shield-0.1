import urllib.request
import json
from src.api.clients.barentswatch import BarentsWatchClient

bw = BarentsWatchClient()
lice_data = bw.get_lice_data_v2()

print("Facility structure from v2 API:")
for fac in lice_data[:2]:
    print(f"\nFacility:")
    print(f"  code: {fac.get('code')}")
    print(f"  localityNo: {fac.get('localityNo')}")
    locality = fac.get('locality')
    if isinstance(locality, dict):
        print(f"  locality.no: {locality.get('no')}")
    print(f"  diseases: {fac.get('diseases')}")
