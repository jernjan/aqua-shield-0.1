#!/usr/bin/env python3
"""
Create test facilities and vessel visits to demonstrate all visit_category types.

visit_category types needed:
  - infected_facility: Already exists (test data)
  - risk_zone_facility: Facility in BarentsWatch SURVEILLANCE zone 
  - near_infected_10km: Facility within 10km of infected facility but not in zone
  - exposure_event: Historical exposure event (optional, same as infected)

This script creates:
  1. 2 test facilities in SURVEILLANCE zones → risk_zone_facility
  2. 3 test facilities near (<10km) real infected facilities → near_infected_10km
  3. Vessel visits to these new facilities
"""

import sqlite3
import json
from datetime import datetime, timedelta
from pathlib import Path

# Database path
DB_PATH = Path("src/api/data/exposure_events.db")

# Test vessels already created
TEST_VESSELS = {
    123456789: "Test Vessel Alpha",
    234567890: "Test Vessel Beta",
    345678901: "Test Vessel Gamma",
    456789012: "Test Vessel Delta",
    567890123: "Test Vessel Epsilon",
    678901234: "Test Vessel Zeta",
}

# Real infected facilities from BarentsWatch (to compute "near" locations)
REAL_INFECTED = [
    {"facility_code": 14042, "name": "Kattholmen", "lat": 70.9, "lon": 29.5},
    {"facility_code": 28636, "name": "Rataren", "lat": 71.2, "lon": 30.1},
]

# New test facilities - in BarentsWatch SURVEILLANCE zones
SURVEILLANCE_ZONES = [
    {
        "facility_code": 50001,
        "facility_name": "North Sentinel (Surveillance)",
        "lat": 71.5,
        "lon": 31.2,
        "description": "Test facility in BarentsWatch SURVEILLANCE zone (HØY/Orange)"
    },
    {
        "facility_code": 50002,
        "facility_name": "East Watch (Surveillance)",
        "lat": 70.7,
        "lon": 32.1,
        "description": "Test facility in BarentsWatch SURVEILLANCE zone (HØY/Orange)"
    },
]

# New test facilities - within 10km of infected sites
NEAR_INFECTED = [
    {
        "facility_code": 50011,
        "facility_name": "Close to Kattholmen",
        "lat": 70.915,  # +0.015 deg ≈ 1.7km north of Kattholmen
        "lon": 29.52,   # +0.02 deg ≈ 1.2km east
        "description": "Test facility ~2.5km from infected Kattholmen"
    },
    {
        "facility_code": 50012,
        "facility_name": "Close to Rataren",
        "lat": 71.19,   # +0.01 deg ≈ 1.1km north
        "lon": 30.18,   # +0.08 deg ≈ 4.8km east
        "description": "Test facility ~5km from infected Rataren"
    },
    {
        "facility_code": 50013,
        "facility_name": "Proximity Zone Alpha",
        "lat": 71.03,   # Between two infected sites
        "lon": 29.78,
        "description": "Test facility in proximity to multiple infected sites"
    },
]

ALL_NEW_FACILITIES = SURVEILLANCE_ZONES + NEAR_INFECTED

def create_test_visits():
    """Create vessel visits to new test facilities"""
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Check that the table exists
    cursor.execute("""
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='vessel_exposure_events'
    """)
    
    if not cursor.fetchone():
        print("❌ Table vessel_exposure_events does not exist!")
        conn.close()
        return False
    
    now = datetime.now()
    visits_created = 0
    
    # Create visits from test vessels to new facilities
    for facility in ALL_NEW_FACILITIES:
        # Get 2-3 random test vessels and create visits
        vessel_ids = list(TEST_VESSELS.keys())
        
        for i, vessel_id in enumerate(vessel_ids[:3]):
            # Stagger visits over past 30 days
            visit_date = now - timedelta(days=30 - i*10)
            duration_minutes = 15 + i*5  # Vary duration: 15, 20, 25 min
            distance_km = (i + 0.5) * 0.3  # Vary distance: 0.15, 0.45, 0.75 km
            
            cursor.execute("""
                INSERT INTO vessel_exposure_events 
                (vessel_id, facility_id, visit_date, duration_minutes, distance_km, visit_order)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                vessel_id,
                facility["facility_code"],
                visit_date.isoformat(),
                duration_minutes,
                distance_km,
                i + 1
            ))
            visits_created += 1
    

    
    conn.close()
    return True

def verify_visits():
    """Verify the new visits and show categories"""
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    print("\n📈 New Facility Visits Summary:")
    print("=" * 70)
    
    cursor.execute("""
        SELECT facility_id, vessel_id, count(*) as visit_count
        FROM vessel_exposure_events
        WHERE facility_id IN (50001, 50002, 50011, 50012, 50013)
        GROUP BY facility_id, vessel_id
        ORDER BY facility_id
    """)
    
    for fac_id, ves_id, count in cursor.fetchall():
        facility_name = next((f['facility_name'] for f in ALL_NEW_FACILITIES if f['facility_code'] == fac_id), f"Unknown ({fac_id})")
        vessel_name = TEST_VESSELS.get(ves_id, f"Unknown ({ves_id})")
        print(f"  {facility_name:30} ← {vessel_name:25} × {count} visits")
    
    conn.close()

if __name__ == "__main__":
    print("\n" + "="*70)
    print("🧪 Creating Test Data for visit_category Filtering")
    print("="*70)
    
    if create_test_visits():
        verify_visits()
        print("\n✅ Test data created successfully!")
        print("\nNow the 'Boats at Risk' tab will show:")
        print("  🦠 Smittede besøkt: Visits to infected_facility (existing 4 facilities)")
        print("  ⚠️  Risk Zone: Visits to risk_zone_facility (new 2 SURVEILLANCE facilities)")
        print("  📍 <10km: Visits to near_infected_10km (new 3 proximity facilities)")
    else:
        print("\n❌ Failed to create test data")
