import json

with open('src/api/data/facility_master.json', 'r') as f:
    data = json.load(f)

facilities = data['facilities']
test_codes = ['10086','10300','19977','50001','50002']

for code in test_codes:
    status = 'FOUND' if code in facilities else 'NOT FOUND'
    print(f'{code}: {status}')

# Also check if we have ANY infected facilities
infected = [c for c, f in facilities.items() if f.get('is_infected')]
print(f'\nTotal infected facilities: {len(infected)}')
print(f'Sample infected codes: {infected[:5]}')
