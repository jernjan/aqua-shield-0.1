#!/usr/bin/env python3
import sqlite3
import os

db_path = 'exposure_events.db'
print(f"Database path: {os.path.abspath(db_path)}")
print(f"Database exists: {os.path.exists(db_path)}")

try:
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    
    # Check tables
    cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [row[0] for row in cur.fetchall()]
    print(f"\nTables in database: {tables}")
    
    if 'vessel_exposure_events' in tables:
        # Check column names
        cur.execute("PRAGMA table_info(vessel_exposure_events)")
        cols = [row[1] for row in cur.fetchall()]
        print(f"\nColumns: {cols}")
        
        # Count events
        cur.execute('SELECT COUNT(*) FROM vessel_exposure_events')
        total = cur.fetchone()[0]
        print(f"\nTotal events: {total}")
        
        if total > 0:
            # Show one sample
            cur.execute('SELECT vessel_mmsi, facility_id, facility_name, risk_level FROM vessel_exposure_events LIMIT 1')
            row = cur.fetchone()
            print(f"Sample: mmsi={row[0]}, facility_id={row[1]}, name={row[2]}, risk={row[3]}")
    
    conn.close()
except Exception as e:
    print(f"ERROR: {e}")
    import traceback
    traceback.print_exc()
