from src.api.clients.barentswatch import BarentsWatchClient

bw = BarentsWatchClient()
lice_data = bw.get_lice_data_v2()

# Group by disease name
disease_counts = {}
for fac in lice_data:
    diseases = fac.get('diseases', []) or []
    for disease in diseases:
        d_name = disease if isinstance(disease, str) else disease.get('name', '?')
        disease_counts[d_name] = disease_counts.get(d_name, 0) + 1

print("Disease counts in v2 API data:")
for name, count in sorted(disease_counts.items(), key=lambda x: -x[1]):
    print(f"  {name}: {count} facilities")

# Find which disease corresponds to ILA and PD
print("\nLooking for ILA/PD aliases...")
print("Norwegian disease names suggested: INFEKSIOES_LAKSEANEMI = ILA, PANKREASSYKDOM = PD")
