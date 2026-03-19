import sqlite3

conn = sqlite3.connect('vessel_exposure_events.db')
c = conn.cursor()

# List tables
tables = c.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
print("\n=== TABELLER I DATABASE ===")
for t in tables:
    print(f"  {t[0]}")

# Get schema for first table
if tables:
    table_name = tables[0][0]
    print(f"\n=== KOLONNER I {table_name} ===")
    schema = c.execute(f"PRAGMA table_info({table_name})").fetchall()
    for col in schema:
        print(f"  {col[1]} ({col[2]})")
    
    # Count rows
    count = c.execute(f"SELECT COUNT(*) FROM {table_name}").fetchone()[0]
    print(f"\nAntall rader: {count}")
    
    # Sample data
    print(f"\n=== SAMPLE DATA ===")
    sample = c.execute(f"SELECT * FROM {table_name} LIMIT 3").fetchall()
    col_names = [col[1] for col in schema]
    for row in sample:
        print(f"\n{dict(zip(col_names, row))}")

conn.close()
