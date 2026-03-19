#!/usr/bin/env python
import sqlite3
from datetime import datetime, timedelta
import json

db_path = 'src/api/data/exposure_events.db'
predictions_path = 'src/api/data/predictions_cache.json'

# Load predictions to get real facility codes
with open(predictions_path, 'r', encoding='utf-8') as f:
    preds = json.load(f)

# Get first few facility codes with high risk
at_risk_facilities = []
for pred in preds['predictions'][:5]:
    code = pred.get('facility_code')
    name = pred.get('facility_name')
    risk = pred.get('risk_level', 'Medium').lower()
    disease = pred.get('primary_disease')
    if code:
        at_risk_facilities.append({
            'code': str(code),
            'name': name,
            'risk_level': risk if risk in ['ekstrem', 'høy', 'moderat'] else 'høy',
            'disease_status': 'infected' if disease and disease != 'Unknown' else 'healthy'
        })

print("Facilities med prediktert risiko:")
for f in at_risk_facilities:
    print(f"  - {f['code']} ({f['name']}) - Risk: {f['risk_level']}")

# Add vessel exposure events for these facilities
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Vessel data to link
vessels = [
    ("210012345", "M/V Atlantic"),
    ("210067890", "M/V Beta"),
    ("210098765", "M/V Gamma"),
    ("210054321", "M/V Delta"),
]

print("\nLegger til exposure events...")
for i, fac in enumerate(at_risk_facilities):
    for j, (mmsi, name) in enumerate(vessels):
        timestamp = (datetime.now() - timedelta(days=j*1, hours=i*2)).isoformat()
        duration = 25 + (i * 5)  # 25, 30, 35, 40, 45 minutes
        
        cursor.execute("""
            INSERT INTO vessel_exposure_events 
            (timestamp, vessel_mmsi, vessel_name, facility_id, facility_name, 
             distance_km, duration_min, disease_status, risk_triggered, risk_level)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            timestamp,
            mmsi,
            name,
            fac['code'],  # Use facility code from predictions
            fac['name'],
            5.0 + i,  # Distance 5-9 km
            duration,
            fac['disease_status'],
            1,  # risk_triggered = true
            fac['risk_level']
        ))
        print(f"  ✓ {mmsi} ({name}) visited {fac['code']} ({fac['name']}) for {duration} min")

conn.commit()

# Verify
cursor.execute("SELECT COUNT(*) FROM vessel_exposure_events")
total = cursor.fetchone()[0]
print(f"\n✓ Totalt {total} exposure events i databasen")

cursor.execute("SELECT DISTINCT facility_id FROM vessel_exposure_events")
facilities = cursor.fetchall()
print(f"✓ Facilities: {', '.join([f[0] for f in facilities])}")

conn.close()

print("\n✅ Testdata opprettet - reload API og prøv igjen!")
