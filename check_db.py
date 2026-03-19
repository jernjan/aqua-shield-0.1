import sqlite3
import os

db_path = "EKTE_API/src/api/data/exposure_events.db"
if os.path.exists(db_path):
    db = sqlite3.connect(db_path)
    c = db.cursor()
    c.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [row[0] for row in c.fetchall()]
    print("Tables:", tables)
    for table in tables:
        c.execute(f"SELECT COUNT(*) FROM {table}")
        count = c.fetchone()[0]
        print(f"  {table}: {count} rows")
        if count > 0:
            c.execute(f"PRAGMA table_info({table})")
            cols = [row[1] for row in c.fetchall()]
            print(f"    Columns: {cols}")
    db.close()
else:
    print(f"Database not found: {db_path}")
