#!/usr/bin/env python3
"""
Populate exposure_events with sample visits to orange/gule (risk zone) facilities.
This creates realistic test data for validating the risk categorization system.
"""

import json
import sqlite3
from datetime import datetime, timedelta
import random
import sys
import os

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

def load_disease_spread_data():
    """Load at-risk facilities from disease_spread_cache."""
    with open('src/api/data/disease_spread_cache.json', 'r') as f:
        data = json.load(f)
    return data.get('all_at_risk_facilities', [])

def add_sample_visits(num_visits=30):
    """Add sample vessel visits to risk zone facilities."""
    # Initialize database if needed
    from src.api.database import init_database
    init_database()
    
    conn = sqlite3.connect('src/api/data/exposure_events.db')
    cursor = conn.cursor()
    
    # Load orange/gule facilities
    at_risk_facilities = load_disease_spread_data()
    
    if not at_risk_facilities:
        print("ERROR: No at-risk facilities found in disease_spread_cache")
        return
    
    print(f"Found {len(at_risk_facilities)} at-risk facilities")
    
    # Sample test vessel MMSIs and names
    test_vessels = [
        ("258012345", "Havluft"),
        ("259234567", "Brekkesund"),
        ("260345678", "Risøy"),
        ("261456789", "Stokksund"),
        ("262567890", "Ramsvika"),
    ]
    
    # Date range: last 7 days
    now = datetime.utcnow()
    start_date = now - timedelta(days=7)
    
    added = 0
    for i in range(num_visits):
        vessel_mmsi, vessel_name = random.choice(test_vessels)
        facility = random.choice(at_risk_facilities)
        facility_id = str(facility['facility_code'])
        facility_name = facility['facility_name']
        zone_type = facility.get('zone_type', 'SURVEILLANCE')
        
        # Random timestamp within last 7 days
        days_ago = random.uniform(0, 7)
        visit_time = now - timedelta(days=days_ago)
        
        # Risk level based on zone type
        risk_level = 'høy' if zone_type in ['SURVEILLANCE', 'PROTECTION'] else 'moderat'
        
        try:
            cursor.execute("""
                INSERT INTO vessel_exposure_events (
                    timestamp, vessel_mmsi, vessel_name, facility_id, facility_name,
                    distance_km, duration_min, disease_status, quarantine_end_time,
                    risk_triggered, risk_level, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                visit_time.isoformat(),
                vessel_mmsi,
                vessel_name,
                facility_id,
                facility_name,
                0.5,  # distance_km
                random.choice([45, 60, 75, 90, 120]),  # duration_min
                'healthy',  # disease_status
                None,  # quarantine_end_time
                1,  # risk_triggered
                risk_level,
                f"{zone_type} zone visit"
            ))
            added += 1
            print(f"  [+] {vessel_name} ({vessel_mmsi}) -> {facility_name} ({zone_type}) on {visit_time.date()}")
        except Exception as e:
            print(f"  [!] Error adding visit: {e}")
    
    conn.commit()
    conn.close()
    
    print(f"\nAdded {added} sample visits to at-risk facilities")
    return added

if __name__ == '__main__':
    print("Populating exposure_events with risk zone (orange/gule) facility visits...\n")
    add_sample_visits(30)
    print("\nDone!")
