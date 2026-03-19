import sqlite3
import os

# Connect to database
db_path = os.path.join('EKTE_API', 'src', 'api', 'data', 'exposure_events.db')
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print("=" * 80)
print("CHECKING FOR INVALID VISITS (distance > 1 km)")
print("=" * 80)

# Count invalid visits
cursor.execute('SELECT COUNT(*) FROM vessel_exposure_events WHERE distance_km > 1.0')
invalid_count = cursor.fetchone()[0]
print(f"\nTotal visits with distance > 1 km: {invalid_count}")

if invalid_count > 0:
    print("\n📋 Sample of invalid visits (showing facility names):")
    print("-" * 80)
    cursor.execute('''
        SELECT vessel_mmsi, vessel_name, facility_id, facility_name, distance_km, timestamp
        FROM vessel_exposure_events 
        WHERE distance_km > 1.0 
        ORDER BY timestamp DESC 
        LIMIT 15
    ''')
    
    for row in cursor.fetchall():
        mmsi, vessel_name, fac_id, fac_name, dist, ts = row
        print(f"  {vessel_name or mmsi} -> {fac_name} ({fac_id}): {dist:.2f} km @ {ts}")
    
    # Group by facility name to see patterns
    print("\n📊 Invalid visits grouped by facility:")
    print("-" * 80)
    cursor.execute('''
        SELECT facility_name, COUNT(*) as count, AVG(distance_km) as avg_dist
        FROM vessel_exposure_events 
        WHERE distance_km > 1.0 
        GROUP BY facility_name 
        ORDER BY count DESC
        LIMIT 10
    ''')
    
    for row in cursor.fetchall():
        fac_name, count, avg_dist = row
        print(f"  {fac_name}: {count} visits, avg distance: {avg_dist:.2f} km")

print("\n" + "=" * 80)
print("CHECKING FILLFJORD MMSI 257982500")
print("=" * 80)

cursor.execute('''
    SELECT facility_id, facility_name, distance_km, timestamp, notes
    FROM vessel_exposure_events 
    WHERE vessel_mmsi = '257982500'
    ORDER BY timestamp DESC
    LIMIT 10
''')

fillfjord_visits = cursor.fetchall()
if fillfjord_visits:
    print(f"\nFound {len(fillfjord_visits)} visits for FILLFJORD:")
    for row in fillfjord_visits:
        fac_id, fac_name, dist, ts, notes = row
        status = "❌ INVALID" if dist > 1.0 else "✅ VALID"
        print(f"  {status} {fac_name} ({fac_id}): {dist:.3f} km @ {ts}")
        if notes and '10km' in notes:
            print(f"    Note: {notes}")
else:
    print("\nNo visits found for FILLFJORD (257982500)")

print("\n" + "=" * 80)
print("ALL VISITS (Valid + Invalid)")
print("=" * 80)
cursor.execute('SELECT COUNT(*) FROM vessel_exposure_events')
total_count = cursor.fetchone()[0]
print(f"Total visits in database: {total_count}")
print(f"Valid visits (≤1 km): {total_count - invalid_count}")
print(f"Invalid visits (>1 km): {invalid_count}")
if total_count > 0:
    print(f"Invalid percentage: {(invalid_count/total_count)*100:.1f}%")

conn.close()
print("\n✅ Done!")
