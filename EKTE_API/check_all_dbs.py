#!/usr/bin/env python3
import sqlite3
import os

for db_file in ['exposure_events.db', 'kyst_monitor.db']:
    if not os.path.exists(db_file):
        continue
        
    print(f"\n=== {db_file} ===")
    try:
        conn = sqlite3.connect(db_file)
        cursor = conn.cursor()
        
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [t[0] for t in cursor.fetchall()]
        
        if not tables:
            print("(no tables)")
            conn.close()
            continue
            
        print(f"Tables: {tables}")
        
        for table_name in tables:
            cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
            count = cursor.fetchone()[0]
            print(f"  {table_name}: {count} rows")
        
        conn.close()
    except Exception as e:
        print(f"Error: {e}")
