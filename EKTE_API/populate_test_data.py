import sqlite3
from datetime import datetime, timedelta

DB_PATH = "src/api/data/exposure_events.db"

TEST_VESSELS = {
    123456789: "Test Vessel Alpha",
    234567890: "Test Vessel Beta",
    345678901: "Test Vessel Gamma",
}

ALL_NEW_FACILITIES = [
    {"code": "50001", "name": "North Sentinel (Surveillance)"},
    {"code": "50002", "name": "East Watch (Surveillance)"},
    {"code": "50011", "name": "Close to Kattholmen"},
    {"code": "50012", "name": "Close to Rataren"},
    {"code": "50013", "name": "Proximity Zone Alpha"},
]

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

now = datetime.now()
visits_created = 0

for facility in ALL_NEW_FACILITIES:
    for i, vessel_mmsi in enumerate(list(TEST_VESSELS.keys())):
        visit_date = now - timedelta(days=28 - i*10)
        cursor.execute("""
            INSERT INTO vessel_exposure_events 
            (timestamp, vessel_mmsi, vessel_name, facility_id, facility_name, 
             distance_km, duration_min, disease_status, risk_level, notes, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            visit_date.isoformat(),
            str(vessel_mmsi),
            TEST_VESSELS[vessel_mmsi],
            facility["code"],
            facility["name"],
            0.5 + i*0.3,
            15 + i*10,
            'healthy',
            'Low',
            f"Test visit to {facility['name']}",
            now.isoformat()
        ))
        visits_created += 1

conn.commit()

print(f"✅ Created {visits_created} test visits")
print(f"   5 new facilities × 3 vessels = 15 visits")

cursor.execute("SELECT COUNT(*) FROM vessel_exposure_events")
total = cursor.fetchone()[0]
print(f"   Total events in database: {total}")

conn.close()
