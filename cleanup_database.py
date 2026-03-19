import sqlite3
import os
from datetime import datetime

# Connect to database
db_path = os.path.join('EKTE_API', 'src', 'api', 'data', 'exposure_events.db')
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print("=" * 80)
print("DATABASE CLEANUP - REMOVING INVALID VISITS")
print("=" * 80)

# Check current state
cursor.execute('SELECT COUNT(*) FROM vessel_exposure_events WHERE distance_km > 1.0')
invalid_count = cursor.fetchone()[0]

cursor.execute('SELECT COUNT(*) FROM vessel_exposure_events WHERE distance_km <= 1.0')
valid_count = cursor.fetchone()[0]

total_count = invalid_count + valid_count

print(f"\n📊 Current database state:")
print(f"  Total visits: {total_count}")
print(f"  Valid visits (≤1 km): {valid_count}")
print(f"  Invalid visits (>1 km): {invalid_count} ({(invalid_count/total_count)*100:.1f}%)")

print(f"\n⚠️  ABOUT TO DELETE {invalid_count} invalid visits...")
print("These are visits logged by old buggy code that stored wrong facility names.")
print("\nPress Enter to continue or Ctrl+C to cancel...")
input()

# Backup first
backup_path = db_path.replace('.db', f'_backup_{datetime.now().strftime("%Y%m%d_%H%M%S")}.db')
print(f"\n💾 Creating backup at: {backup_path}")
import shutil
shutil.copy2(db_path, backup_path)
print("✅ Backup created")

# Delete invalid visits
print(f"\n🗑️  Deleting {invalid_count} invalid visits...")
cursor.execute('DELETE FROM vessel_exposure_events WHERE distance_km > 1.0')
deleted = cursor.rowcount
conn.commit()

print(f"✅ Deleted {deleted} invalid visits")

# Verify new state
cursor.execute('SELECT COUNT(*) FROM vessel_exposure_events')
remaining = cursor.fetchone()[0]
print(f"\n✅ Database cleaned!")
print(f"  Remaining visits: {remaining} (all valid, ≤1 km)")

# Show sample of remaining visits
print(f"\n📋 Sample of remaining VALID visits:")
print("-" * 80)
cursor.execute('''
    SELECT vessel_name, facility_name, distance_km, timestamp
    FROM vessel_exposure_events 
    ORDER BY timestamp DESC 
    LIMIT 10
''')

for row in cursor.fetchall():
    vessel, facility, dist, ts = row
    print(f"  {vessel} -> {facility}: {dist:.3f} km @ {ts}")

# Check FILLFJORD specifically
print(f"\n📋 FILLFJORD (257982500) visits after cleanup:")
cursor.execute('''
    SELECT facility_name, distance_km, timestamp
    FROM vessel_exposure_events 
    WHERE vessel_mmsi = '257982500'
    ORDER BY timestamp DESC
''')

fillfjord_visits = cursor.fetchall()
if fillfjord_visits:
    print(f"  Found {len(fillfjord_visits)} VALID visits:")
    for row in fillfjord_visits:
        facility, dist, ts = row
        print(f"    {facility}: {dist:.3f} km @ {ts}")
else:
    print("  No visits remaining (all previous visits were invalid)")

conn.close()
print("\n" + "=" * 80)
print("✅ CLEANUP COMPLETE!")
print("=" * 80)
