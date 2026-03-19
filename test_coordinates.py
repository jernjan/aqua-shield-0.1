#!/usr/bin/env python3
"""Debug coordinate ranges"""
import sys
sys.path.insert(0, 'EKTE_API/src')

from api.clients.barentswatch import BarentsWatchClient
from shapely.geometry import Point, shape

bw = BarentsWatchClient()

print('=== ZONE COORDINATES ===')
ila_zones = bw.get_ila_zones()
protection_zones = ila_zones.get('protection_zones', {}).get('features', [])

if protection_zones:
    zone = protection_zones[0]
    geom = zone.get('geometry', {})
    coords = geom.get('coordinates', [])
    
    print(f'First ILA protection zone:')
    print(f'  Geometry type: {geom.get("type")}')
    print(f'  Number of polygons: {len(coords) if coords else 0}')
    
    # Get first polygon's first ring's first point
    if coords and len(coords) > 0:
        first_polygon = coords[0]
        if first_polygon and len(first_polygon) > 0:
            first_ring = first_polygon[0]
            if first_ring and len(first_ring) > 0:
                first_point = first_ring[0]
                print(f'  First coordinate: {first_point}')
                print(f'  Format: [{first_point[0]}, {first_point[1]}]')
                if len(first_point) == 2:
                    print(f'  → Longitude: {first_point[0]}, Latitude: {first_point[1]}')

print('\n=== FACILITY COORDINATES ===')
facilities = bw.get_facilities(limit=10)
for i, fac in enumerate(facilities[:5]):
    loc = fac.get('locality', {})
    location = loc.get('location', {})
    lat = location.get('latitude')
    lon = location.get('longitude')
    name = loc.get('name', 'Unknown')
    
    print(f'Facility {i+1}: {name}')
    print(f'  Latitude: {lat}, Longitude: {lon}')
    if lat and lon:
        print(f'  Point(lon, lat): Point({lon}, {lat})')

print('\n=== COORDINATE SYSTEM CHECK ===')
print('Norway is approximately:')
print('  Latitude: 58° N to 71° N')
print('  Longitude: 4° E to 31° E')
print('\nIf zone coordinates are [lon, lat], they should be [4-31, 58-71]')
print('If facility coordinates work correctly, they should also be in this range')

# Test manual point-in-polygon
print('\n=== MANUAL TEST ===')
if protection_zones:
    test_zone = shape(protection_zones[0]['geometry'])
    print(f'Created Shapely shape from zone')
    print(f'  Bounds: {test_zone.bounds}')  # (minx, miny, maxx, maxy)
    print(f'  Format: (min_lon, min_lat, max_lon, max_lat)')
    
    # Test with a facility
    if facilities:
        test_fac = facilities[0]
        test_loc = test_fac.get('locality', {}).get('location', {})
        test_lat = test_loc.get('latitude')
        test_lon = test_loc.get('longitude')
        
        if test_lat and test_lon:
            test_point = Point(test_lon, test_lat)
            print(f'\nTest point: {test_point}')
            print(f'  Is in zone bounds? {test_zone.bounds[0] <= test_point.x <= test_zone.bounds[2] and test_zone.bounds[1] <= test_point.y <= test_zone.bounds[3]}')
            print(f'  Is covered by zone? {test_zone.covers(test_point)}')
