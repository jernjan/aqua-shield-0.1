"""
Test the actual backend /api/vessels endpoint
"""
import requests
import json
import time

print("="*60)
print("TESTING BACKEND /api/vessels ENDPOINT")
print("="*60)

url = "http://localhost:8000/api/vessels?limit=10000"

print(f"\n📞 Calling: {url}")
print(f"⏱️  Timing the request...\n")

start = time.time()

try:
    response = requests.get(url, timeout=60)
    elapsed = time.time() - start
    
    print(f"✅ Response received in {elapsed:.2f} seconds")
    print(f"   Status: {response.status_code}")
    print(f"   Content-Length: {len(response.content)} bytes")
    
    if response.status_code == 200:
        data = response.json()
        print(f"\n📊 Response data:")
        print(f"   Count: {data.get('count')}")
        print(f"   Total: {data.get('total')}")
        print(f"   Source: {data.get('source')}")
        print(f"   Error: {data.get('error', 'None')}")
        
        if data.get('vessels'):
            vessels = data['vessels']
            print(f"\n   ✅ {len(vessels)} vessels returned")
            if len(vessels) > 0:
                print(f"\n   First vessel:")
                print(f"   {json.dumps(vessels[0], indent=4)}")
            if len(vessels) > 1:
                print(f"\n   Last vessel:")
                print(f"   {json.dumps(vessels[-1], indent=4)}")
        else:
            print(f"   ⚠️  No vessels in response")
            
    else:
        print(f"❌ Error response: {response.text[:500]}")
        
except requests.exceptions.Timeout:
    elapsed = time.time() - start
    print(f"❌ Request timed out after {elapsed:.2f} seconds")
except Exception as e:
    elapsed = time.time() - start
    print(f"❌ Exception after {elapsed:.2f} seconds: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "="*60)
