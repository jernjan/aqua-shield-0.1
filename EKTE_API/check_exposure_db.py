#!/usr/bin/env python3
import sqlite3

conn = sqlite3.connect('exposure_events.db')
cur = conn.cursor()

# Total events
cur.execute('SELECT COUNT(*) FROM vessel_exposure_events')
total = cur.fetchone()[0]
print(f"Total exposure events: {total}")

# Unique facilities
cur.execute('SELECT COUNT(DISTINCT facility_id) FROM vessel_exposure_events')
unique_fac = cur.fetchone()[0]
print(f"Unique facilities with events: {unique_fac}")

# Facilities with NULL
cur.execute('SELECT COUNT(*) FROM vessel_exposure_events WHERE facility_id IS NULL')
null_count = cur.fetchone()[0]
print(f"Events with NULL facility_id: {null_count}")

# Sample non-NULL facilities
print("\nSample non-NULL facility_id entries (first 5):")
cur.execute('SELECT facility_id, facility_name, COUNT(*) as cnt FROM vessel_exposure_events WHERE facility_id IS NOT NULL GROUP BY facility_id LIMIT 5')
for row in cur.fetchall():
    print(f"  {row[0]}: {row[1]} ({row[2]} events)")

# Check if we have any risk_level data
print("\nRisk level distribution:")
cur.execute('SELECT risk_level, COUNT(*) as cnt FROM vessel_exposure_events GROUP BY risk_level')
for row in cur.fetchall():
    print(f"  {row[0]}: {row[1]}")

conn.close()
