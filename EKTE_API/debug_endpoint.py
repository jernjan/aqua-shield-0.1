import requests
import json

try:
    # Test the new endpoint
    resp = requests.get('http://127.0.0.1:8000/api/risk/predictions/all', timeout=30)
    data = resp.json()
    
    print('=== RAW RESPONSE ===')
    print(json.dumps(data, indent=2, default=str))
        
except Exception as e:
    print(f'Feil: {e}')
    import traceback
    traceback.print_exc()
