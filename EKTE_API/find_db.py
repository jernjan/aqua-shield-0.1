#!/usr/bin/env python3
import sqlite3
import os

print("Current directory:", os.getcwd())
print("Files in current directory:")
for f in os.listdir('.'):
    if f.endswith('.db') or 'exposure' in f.lower():
        print(f"  {f}")

# Try to find the database
possible_paths = [
    'exposure_events.db',
    '../exposure_events.db',
    '../../exposure_events.db',
    'src/api/exposure_events.db',
]

for path in possible_paths:
    if os.path.exists(path):
        print(f"\n✅ Found database: {path}")
        conn = sqlite3.connect(path)
        cursor = conn.cursor()
        
        # Get all tables
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [t[0] for t in cursor.fetchall()]
        print(f"Tables: {tables}")
        
        # Get vessel_exposure_events details
        if 'vessel_exposure_events' in tables:
            cursor.execute("SELECT COUNT(*) FROM vessel_exposure_events")
            count = cursor.fetchone()[0]
            print(f"vessel_exposure_events has {count} rows")
        
        conn.close()
        break
else:
    print("\n❌ Database file not found in any expected location")
