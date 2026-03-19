import urllib.request
import json

resp = urllib.request.urlopen('http://127.0.0.1:8002/api/risk/assess?limit=500')
data = json.loads(resp.read())

ila = [f for f in data['assessments'] if f['disease_status']['has_ila']]
pd = [f for f in data['assessments'] if f['disease_status']['has_pd']]

print(f'ILA: {len(ila)} facilities')
print(f'PD: {len(pd)} facilities')

if ila:
    print(f'\nFirst ILA facility: {ila[0]["facility_name"]}')
    print(f'  Diseases: {ila[0]["disease_status"]["diseases"]}')
    print(f'  Risk score: {ila[0]["risk_score"]}')
    
if pd:
    print(f'\nFirst PD facility: {pd[0]["facility_name"]}')
    print(f'  Diseases: {pd[0]["disease_status"]["diseases"]}')
    print(f'  Risk score: {pd[0]["risk_score"]}')

