import requests

url = "http://localhost:8000/api/facilities/disease-spread"
resp = requests.get(url, timeout=120)
print("Status:", resp.status_code)
resp.raise_for_status()

data = resp.json()
print("Facilities at risk:", data.get("facilities_at_disease_risk"))
print("Risk summary:", data.get("risk_summary"))
print("Confirmed diseased:", len(data.get("confirmed_diseased_facilities", [])))
print("All at risk:", len(data.get("all_at_risk_facilities", [])))
