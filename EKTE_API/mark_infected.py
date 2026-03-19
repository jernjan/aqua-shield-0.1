#!/usr/bin/env python
"""Generate test data for facilities with infected status"""
import sqlite3
from datetime import datetime, timedelta

db_path = 'src/api/data/exposure_events.db'
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Get existing facilities from exposure events
cursor.execute("SELECT DISTINCT facility_id FROM vessel_exposure_events LIMIT 3")
facilities = cursor.fetchall()

print("Marking facilities as infected...")
for fac in facilities:
    facility_id = fac[0]
    # Update to mark as infected with a disease
    cursor.execute("""
        UPDATE vessel_exposure_events 
        SET disease_status = 'infected'
        WHERE facility_id = ?
    """, (facility_id,))
    print(f"  ✓ Marked facility {facility_id} as infected")

conn.commit()

# Verify
cursor.execute("""
    SELECT DISTINCT facility_id, disease_status 
    FROM vessel_exposure_events
    WHERE disease_status = 'infected'
""")
infected = cursor.fetchall()
print(f"\n✓ Now {len(infected)} facilities are marked as infected:")
for fac, status in infected:
    print(f"  - {fac} ({status})")

conn.close()

print("\n✅ Restart API to load updated data!")
