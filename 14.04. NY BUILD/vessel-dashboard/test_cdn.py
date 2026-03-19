import urllib.request
import urllib.error

urls_to_test = [
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
]

print('Testing CDN Resources:')
for url in urls_to_test:
    try:
        response = urllib.request.urlopen(url, timeout=5)
        size = len(response.read())
        print(f'✓ {url.split("/")[-1]}: {size} bytes')
    except Exception as e:
        print(f'✗ {url.split("/")[-1]}: {str(e)[:60]}')
