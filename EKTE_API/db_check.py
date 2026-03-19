#!/usr/bin/env python3
import sqlite3

conn = sqlite3.connect('exposure_events.db')
cursor = conn.cursor()

# Get all tables
cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = cursor.fetchall()
print("Tables in exposure_events.db:")
for table in tables:
    print(f"  - {table[0]}")

# Check if vessel_exposure_events exists
cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='vessel_exposure_events'")
if cursor.fetchone():
    cursor.execute("SELECT COUNT(*) FROM vessel_exposure_events")
    count = cursor.fetchone()[0]
    print(f"\nvessel_exposure_events: {count} rows")
    
    # Get schema
    cursor.execute("PRAGMA table_info(vessel_exposure_events)")
    print("Columns:")
    for col in cursor.fetchall():
        print(f"  - {col[1]} ({col[2]})")
else:
    print("\n❌ vessel_exposure_events table NOT FOUND")

conn.close()
