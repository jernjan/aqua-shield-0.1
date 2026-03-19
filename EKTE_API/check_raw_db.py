import sqlite3
from datetime import datetime, timedelta

db_path = 'src/api/data/exposure_events.db'
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Check what's in the database
cursor.execute("SELECT COUNT(*) FROM vessel_exposure_events")
total = cursor.fetchone()[0]
print(f"Total vessel_exposure_events: {total}")

# Get recent events (last 7 days)
cutoff = (datetime.now() - timedelta(days=7)).isoformat()
cursor.execute(f"SELECT COUNT(*) FROM vessel_exposure_events WHERE timestamp > '{cutoff}'")
recent = cursor.fetchone()[0]
print(f"Recent events (last 7 days): {recent}")

# Sample data
cursor.execute("""
    SELECT vessel_mmsi, vessel_name, facility_id, timestamp, duration_min
    FROM vessel_exposure_events
    ORDER BY timestamp DESC
    LIMIT 5
""")
print("\nSample events:")
for row in cursor.fetchall():
    print(f"  {row[0]} ({row[1]}) -> {row[2]} @ {row[3]}, duration {row[4]} min")

# Check facility_master
cursor.execute("SELECT COUNT(*) FROM facility_master")
fac_count = cursor.fetchone()[0]
print(f"\nTotal facility_master records: {fac_count}")

# Check infected facilities
cursor.execute("SELECT COUNT(*) FROM facility_master WHERE is_infected = 1")
infected_count = cursor.fetchone()[0]
print(f"Infected facilities in master: {infected_count}")

# Check for coordinates
cursor.execute("""
    SELECT COUNT(*) FROM facility_master 
    WHERE latitude IS NOT NULL AND longitude IS NOT NULL
""")
coord_count = cursor.fetchone()[0]
print(f"Facilities with coordinates: {coord_count}")

conn.close()
