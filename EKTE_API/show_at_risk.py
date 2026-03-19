import requests
import json

try:
    resp = requests.get('http://127.0.0.1:8000/api/risk/outbreak-risk-at-healthy-facilities', timeout=30)
    data = resp.json()
    
    # Summary
    print('=== RISIKOSAMMENDRAG ===')
    print(f"Totalt anlegg analysert: {data['summary']['facilities_analyzed']}")
    print(f"Smittede anlegg: {data['summary']['infected_facilities_count']}")
    print(f"Friske anlegg i fare: {len(data['healthy_at_risk'])}")
    print(f"Kritisk risiko: {data['summary']['critical']}")
    print(f"Medium risiko: {data['summary']['medium']}")
    print(f"Lav risiko: {data['summary']['low']}")
    
    # Top 10 most at-risk
    print('\n=== TOP 10 HØYESTE RISIKO ===')
    top_10 = data['healthy_at_risk'][:10]
    for i, facility in enumerate(top_10, 1):
        print(f"\n{i}. {facility['facility_name']} (Kode: {facility['facility_code']})")
        print(f"   Risikoscore: {facility['risk_score']}/100")
        print(f"   Risikonivå: {facility['risk_level']}")
        print(f"   Nærmeste smittet: {facility['source_facility_name']} ({facility['distance_to_source_km']:.1f} km)")
        print(f"   Havstrøm bidrag: {facility['ocean_current_contribution']} poeng")
        print(f"   Avstand bidrag: {facility['distance_contribution']} poeng")
        
        if facility.get('ocean_current_risk'):
            ocr = facility['ocean_current_risk']
            print(f"   Strømretning: {ocr['current_direction_deg']:.0f} deg, Alignment: {ocr['alignment_factor']*100:.0f}%")
            
except Exception as e:
    print(f'Feil: {e}')
    import traceback
    traceback.print_exc()
