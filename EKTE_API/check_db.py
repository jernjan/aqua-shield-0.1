#!/usr/bin/env python
import sqlite3
from datetime import datetime, timedelta

db_path = 'src/api/data/exposure_events.db'
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Check table structure
cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = cursor.fetchall()
print("Tabeller i databasen:")
for t in tables:
    table_name = t[0]
    print(f"\n  ✓ {table_name}")
    cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
    count = cursor.fetchone()[0]
    print(f"    -> {count} rader")

# Check if there are any exposure events
print("\n" + "="*60)
print("EXPOSURE EVENTS:")
cursor.execute("""
    SELECT vessel_mmsi, facility_id, timestamp, duration_min FROM vessel_exposure_events LIMIT 5
""")
rows = cursor.fetchall()
if rows:
    print(f"Fant {len(rows)} exposure events:")
    for row in rows:
        print(f"  Vessel {row[0]} -> Facility {row[1]} ({row[3]} min) @ {row[2]}")
else:
    print("❌ Ingen exposure events funnet - database er tom")

conn.close()

# Try to add some test data
print("\n" + "="*60)
print("LEGGER TIL TESTDATA...")

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Insert test exposure events
test_events = [
    ("123456789", "facility_001", "Vessel Alpha", "facility_001", "Facility 1", 5.2, 45, "healthy", 1, "høy"),
    ("234567890", "facility_002", "Vessel Beta", "facility_002", "Facility 2", 8.1, 60, "infected", 1, "ekstrem"),
    ("345678901", "facility_001", "Vessel Gamma", "facility_001", "Facility 1", 4.9, 30, "healthy", 0, "moderat"),
]

for i, event in enumerate(test_events):
    timestamp = (datetime.now() - timedelta(days=i*2)).isoformat()
    cursor.execute("""
        INSERT INTO vessel_exposure_events 
        (timestamp, vessel_mmsi, vessel_name, facility_id, facility_name, 
         distance_km, duration_min, disease_status, risk_triggered, risk_level)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (timestamp,) + event)

conn.commit()

# Verify insertions
cursor.execute("SELECT COUNT(*) FROM vessel_exposure_events")
count = cursor.fetchone()[0]
print(f"✓ Lagt til testdata - nå {count} rader i vessel_exposure_events")

cursor.execute("SELECT vessel_mmsi, facility_id, duration_min FROM vessel_exposure_events")
for row in cursor.fetchall():
    print(f"  - {row[0]} visited {row[1]} for {row[2]} min")

conn.close()
