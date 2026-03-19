import sqlite3

db = sqlite3.connect("EKTE_API/src/api/data/exposure_events.db")
c = db.cursor()

# Check vessel_exposure_events
print("=== VESSEL EXPOSURE EVENTS ===")
c.execute("SELECT vessel_mmsi, vessel_name, facility_id, facility_name, risk_level, distance_km FROM vessel_exposure_events LIMIT 10")
for row in c.fetchall():
    print(f"  {row[1]} ({row[0]}) visited {row[3]} ({row[2]}): risk={row[4]}, dist={row[5]}km")

print(f"\nTotal exposure events: ", end="")
c.execute("SELECT COUNT(DISTINCT vessel_mmsi) as vessels FROM vessel_exposure_events")
print(f"{c.fetchone()[0]} unique vessels")

c.execute("SELECT COUNT(DISTINCT facility_id) as facilities FROM vessel_exposure_events")
print(f"Total facilities visited: {c.fetchone()[0]} unique facilities")

# Check what facilities we have
print("\n=== FACILITIES IN EXPOSURE EVENTS ===")
c.execute("SELECT DISTINCT facility_id, facility_name FROM vessel_exposure_events ORDER BY facility_name")
for fac_id, fac_name in c.fetchall():
    c.execute("SELECT COUNT(*) FROM vessel_exposure_events WHERE facility_id = ?", (fac_id,))
    count = c.fetchone()[0]
    print(f"  {fac_id}: {fac_name} ({count} visits)")

# Check if we have coordinates
print("\n=== CHECKING FOR COORDINATES ===")
c.execute("PRAGMA table_info(vessel_exposure_events)")
cols = [row for row in c.fetchall()]
has_lat_lon = any('lat' in str(col).lower() or 'lon' in str(col).lower() for col in cols)
print(f"Has lat/lon columns: {has_lat_lon}")
if not has_lat_lon:
    print("⚠️  NO COORDINATES in vessel_exposure_events! Can't calculate distances.")

# Check smittespredning
print("\n=== SMITTESPREDNING EVENTS ===")
c.execute("SELECT COUNT(*) FROM smittespredning_events")
print(f"Total smittespredning events: {c.fetchone()[0]}")

db.close()
