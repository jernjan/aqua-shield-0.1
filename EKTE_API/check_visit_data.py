import sqlite3

db_path = "src/api/data/exposure_events.db"
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Get all unique facilities with visits
cursor.execute("""
    SELECT DISTINCT facility_id, facility_name 
    FROM vessel_exposure_events 
    ORDER BY facility_id
""")

facilities = cursor.fetchall()
print(f"\n✅ Total unique facilities with visits: {len(facilities)}")
print(f"\nFacilities with visits:")
for fac_id, fac_name in facilities:
    print(f"  - {fac_id}: {fac_name}")

# Get visit counts by facility
print(f"\n📊 Visit count by facility:")
cursor.execute("""
    SELECT facility_id, facility_name, COUNT(*) as visit_count 
    FROM vessel_exposure_events 
    GROUP BY facility_id 
    ORDER BY visit_count DESC
""")

for fac_id, fac_name, count in cursor.fetchall():
    print(f"  - {fac_id} ({fac_name}): {count} visits")

# Get sample visits
print(f"\n🚢 Sample visits (first 10):")
cursor.execute("""
    SELECT vessel_mmsi, vessel_name, facility_id, facility_name, duration_min, distance_km
    FROM vessel_exposure_events 
    LIMIT 10
""")

for mmsi, vname, fid, fname, dur, dist in cursor.fetchall():
    print(f"  Vessel {mmsi} ({vname}) → {fid} ({fname}) - {dur}min, {dist}km")

conn.close()
