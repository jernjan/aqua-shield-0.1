#!/usr/bin/env python3
"""Check what visit categories exist in the vessel_visits data"""

import sqlite3
import json

db_path = "src/api/data/exposure_events.db"
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Get all unique facility codes that have visits
cursor.execute("""
    SELECT DISTINCT facility_id FROM vessel_visits
    ORDER BY facility_id
""")

facilities = [row[0] for row in cursor.fetchall()]
print(f"\n✅ Total unique facilities with visits: {len(facilities)}")
print(f"\nFirst 20 facilities with visits:")
for fac in facilities[:20]:
    print(f"  - {fac}")

# Get count of visits per facility
cursor.execute("""
    SELECT facility_id, COUNT(*) as visit_count FROM vessel_visits
    GROUP BY facility_id
    ORDER BY visit_count DESC
    LIMIT 10
""")

print(f"\n📊 Top 10 facilities by visit count:")
for fac_id, count in cursor.fetchall():
    print(f"  - {fac_id}: {count} visits")

# Get some sample visits
cursor.execute("""
    SELECT vessel_mmsi, vessel_name, facility_id, visit_date FROM vessel_visits
    LIMIT 5
""")

print(f"\n🚢 Sample visits:")
for mmsi, name, fac, date in cursor.fetchall():
    print(f"  Vessel {mmsi} ({name}) → Facility {fac} on {date}")

conn.close()
