#!/usr/bin/env python3
import sqlite3

db_path = "src/api/data/exposure_events.db"
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Get all tables
cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = [t[0] for t in cursor.fetchall()]
print("Tables:", tables)

# Get schema of vessel_exposure_events
cursor.execute("PRAGMA table_info(vessel_exposure_events)")
columns = cursor.fetchall()
print("\nvessel_exposure_events schema:")
for col in columns:
    print(f"  {col[1]} ({col[2]})")

# Sample data
cursor.execute("SELECT * FROM vessel_exposure_events LIMIT 3")
print("\nSample data:")
for row in cursor.fetchall():
    print(f"  {row}")

conn.close()
