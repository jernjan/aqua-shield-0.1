import urllib.request
import os

print("Downloading Leaflet files locally...")

# Create lib directory
os.makedirs("lib/leaflet", exist_ok=True)

files = [
    ("https://unpkg.com/leaflet@1.9.4/dist/leaflet.js", "lib/leaflet/leaflet.js"),
    ("https://unpkg.com/leaflet@1.9.4/dist/leaflet.css", "lib/leaflet/leaflet.css"),
]

for url, local_path in files:
    try:
        print(f"Downloading {url}...")
        urllib.request.urlretrieve(url, local_path)
        size = os.path.getsize(local_path)
        print(f"✓ {local_path}: {size} bytes")
    except Exception as e:
        print(f"✗ Failed to download {url}: {e}")

print("\nDownload complete!")
