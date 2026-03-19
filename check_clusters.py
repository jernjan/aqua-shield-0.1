"""
Script to check for disease clusters in Barentswatch data.
This helps verify if infected facilities are close enough to form clusters.
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'EKTE_API'))

from src.api.barentswatch_api import BarentswatchAPI
from math import radians, cos, sin, asin, sqrt

def haversine(lon1, lat1, lon2, lat2):
    """Calculate distance between two points on Earth in km"""
    lon1, lat1, lon2, lat2 = map(radians, [lon1, lat1, lon2, lat2])
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * asin(sqrt(a))
    km = 6371 * c
    return km

def main():
    print("=" * 80)
    print("SJEKKER FOR SMITTEKLYNGER I BARENTSWATCH DATA")
    print("=" * 80)
    print()
    
    bw = BarentswatchAPI()
    lice_data = bw.get_lice_data_v2()
    
    # Find all infected facilities
    infected_facilities = {}
    for item in lice_data:
        if item.get('diseases'):
            code = item.get('locality', {}).get('no')
            coords = item.get('geometry', {}).get('coordinates', [])
            if code and len(coords) > 1:
                infected_facilities[code] = {
                    'name': item.get('locality', {}).get('name', code),
                    'lat': coords[1],
                    'lon': coords[0],
                    'diseases': item.get('diseases', [])
                }
    
    print(f"✅ Funnet {len(infected_facilities)} smittede anlegg")
    print()
    
    if len(infected_facilities) < 2:
        print("⚠️  Ingen klynger mulig - trenger minst 2 smittede anlegg")
        return
    
    # Check all pairwise distances
    facilities = list(infected_facilities.items())
    clusters_30km = []
    clusters_50km = []
    
    for i, (code1, data1) in enumerate(facilities):
        nearby_30 = []
        nearby_50 = []
        
        for j, (code2, data2) in enumerate(facilities):
            if i != j:
                dist = haversine(data1['lon'], data1['lat'], data2['lon'], data2['lat'])
                if dist <= 30:
                    nearby_30.append((code2, data2['name'], dist))
                if dist <= 50:
                    nearby_50.append((code2, data2['name'], dist))
        
        if nearby_30:
            clusters_30km.append((code1, data1['name'], nearby_30))
        if nearby_50:
            clusters_50km.append((code1, data1['name'], nearby_50))
    
    print("=" * 80)
    print("KLYNGER INNENFOR 30 KM:")
    print("=" * 80)
    if clusters_30km:
        for code, name, nearby in clusters_30km:
            print(f"\n🔴 {name} ({code})")
            print(f"   Har {len(nearby)} smittede naboer innenfor 30 km:")
            for nb_code, nb_name, dist in sorted(nearby, key=lambda x: x[2]):
                print(f"      - {nb_name} ({nb_code}): {dist:.1f} km")
    else:
        print("\n⚠️  Ingen klynger funnet innenfor 30 km radius")
    
    print()
    print("=" * 80)
    print("KLYNGER INNENFOR 50 KM:")
    print("=" * 80)
    if clusters_50km:
        for code, name, nearby in clusters_50km:
            print(f"\n🟠 {name} ({code})")
            print(f"   Har {len(nearby)} smittede naboer innenfor 50 km:")
            for nb_code, nb_name, dist in sorted(nearby, key=lambda x: x[2]):
                print(f"      - {nb_name} ({nb_code}): {dist:.1f} km")
    else:
        print("\n⚠️  Ingen klynger funnet innenfor 50 km radius")
    
    print()
    print("=" * 80)
    print("OPPSUMMERING:")
    print(f"  - Totalt {len(infected_facilities)} smittede anlegg")
    print(f"  - {len(clusters_30km)} anlegg har naboer innenfor 30 km")
    print(f"  - {len(clusters_50km)} anlegg har naboer innenfor 50 km")
    print("=" * 80)

if __name__ == "__main__":
    main()
