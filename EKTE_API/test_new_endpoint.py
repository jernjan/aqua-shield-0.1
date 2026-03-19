import requests

try:
    # Test the new endpoint
    resp = requests.get('http://127.0.0.1:8000/api/risk/predictions/all', timeout=30)
    data = resp.json()
    
    print('=== OPPDATERT DASHBOARD DATA ===')
    print(f"Critical risiko: {data['summary']['critical']}")
    print(f"Medium risiko: {data['summary']['medium']}")
    print(f"Lav risiko: {data['summary']['low']}")
    print(f"Totalt analysert: {data['summary']['total_facilities']}")
    
    print('\n=== TOP 5 FRISKE ANLEGG I FARE ===')
    for i, fac in enumerate(data['top_20_by_risk'][:5], 1):
        print(f"\n{i}. {fac['facility_name']}")
        print(f"   Risiko: {fac['risk_level']} ({fac['confidence_score']*100:.0f}%)")
        print(f"   Kilder: {', '.join(fac['risk_drivers'])}")
        print(f"   Fra: {fac['source_facility_name']} ({fac['distance_to_source_km']:.1f} km)")
        print(f"   Havstrøm bidrag: {fac['ocean_current_contribution']} av 30 poeng")
        
except Exception as e:
    print(f'Feil: {e}')
    import traceback
    traceback.print_exc()
