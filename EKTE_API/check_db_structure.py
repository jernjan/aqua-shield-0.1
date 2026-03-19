import sqlite3

db_path = "src/api/data/exposure_events.db"
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Get all tables
cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = [row[0] for row in cursor.fetchall()]

print("Tables in database:")
for table in tables:
    print(f"  - {table}")
    cursor.execute(f"PRAGMA table_info({table})")
    cols = cursor.fetchall()
    for col in cols:
        print(f"      {col[1]} ({col[2]})")

conn.close()
