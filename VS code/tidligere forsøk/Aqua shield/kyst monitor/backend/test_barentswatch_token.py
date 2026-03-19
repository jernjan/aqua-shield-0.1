"""Test BarentsWatch token endpoints"""
import httpx
import asyncio

async def test_token():
    client_id = "janinge88@hotmail.com:janinge88@hotmail.com"
    client_secret = "cXvin3M3#jqf7GA"
    
    # Test different possible token URLs
    urls = [
        "https://id.barentswatch.no/oauth/token",
        "https://www.barentswatch.no/oauth/token",
        "https://www.barentswatch.no/bwapi/v1/oauth/token",
        "https://id.barentswatch.no/connect/token",
        "https://www.barentswatch.no/connect/token",
        "https://www.barentswatch.no/api/authorize",
    ]
    
    for url in urls:
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    url,
                    auth=(client_id, client_secret),
                    data={"grant_type": "client_credentials", "scope": "api"},
                    timeout=5
                )
                status = resp.status_code
                print(f"✓ {url}: {status}")
                if status == 200:
                    data = resp.json()
                    token = data.get("access_token", "")[:30]
                    print(f"  SUCCESS! Token: {token}...")
                    return True
                elif status in [400, 401, 403]:
                    print(f"  Error: {resp.text[:100]}")
        except Exception as e:
            err = str(e)[:60]
            print(f"✗ {url}: {err}")
    
    print("\nNo working endpoint found!")

if __name__ == "__main__":
    asyncio.run(test_token())
