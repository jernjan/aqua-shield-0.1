"""Test with URL-encoded client ID"""
import httpx
import asyncio

async def test():
    # Try different client ID formats
    formats = [
        ("janinge88@hotmail.com:janinge88@hotmail.com", "Plain"),
        ("janinge88%40hotmail.com%3Ajaninge88%40hotmail.com", "URL-encoded"),
    ]
    
    client_secret = "cXvin3M3#jqf7GA"
    url = "https://id.barentswatch.no/connect/token"
    
    for client_id, desc in formats:
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    url,
                    auth=(client_id, client_secret),
                    data={"grant_type": "client_credentials", "scope": "api"},
                    timeout=5
                )
                print(f"\n{desc} format:")
                print(f"  Status: {resp.status_code}")
                if resp.status_code == 200:
                    data = resp.json()
                    print(f"  ✓ Token: {data.get('access_token', '')[:40]}...")
                else:
                    print(f"  Error: {resp.text[:150]}")
        except Exception as e:
            print(f"{desc}: Error - {str(e)[:80]}")

asyncio.run(test())
