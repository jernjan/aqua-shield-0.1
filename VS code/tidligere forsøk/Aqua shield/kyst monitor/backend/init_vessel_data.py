#!/usr/bin/env python
"""Initialize demo vessel data."""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app.db.database import SessionLocal, engine, Base
from app.db.models_vessel import Vessel
from datetime import datetime, timedelta

def init_vessel_data():
    """Initialize database with demo vessel data."""
    
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    
    try:
        # Check if vessels already exist
        existing = db.query(Vessel).first()
        if existing:
            print("✓ Vessel data already initialized")
            return
        
        # Create demo vessels
        vessels = [
            Vessel(
                mmsi="123456789",
                name="Nordic Fishing",
                callsign="NFISH",
                vessel_type="Fishing",
                length=24.5,
                width=6.2,
                latitude=60.4,
                longitude=5.3,
                speed=8.5,
                course=45.0,
                heading=45.0,
                status="active",
                source="ais",
                is_fishing=True,
                last_position_update=datetime.utcnow()
            ),
            Vessel(
                mmsi="234567890",
                name="Arctic Explorer",
                callsign="ARCEXP",
                vessel_type="Fishing",
                length=18.2,
                width=5.1,
                latitude=60.6,
                longitude=5.1,
                speed=6.2,
                course=270.0,
                heading=270.0,
                status="active",
                source="ais",
                is_fishing=True,
                last_position_update=datetime.utcnow() - timedelta(minutes=3)
            ),
            Vessel(
                mmsi="345678901",
                name="Coast Guard Patrol",
                callsign="CGPAT01",
                vessel_type="Patrol",
                length=32.0,
                width=7.5,
                latitude=60.3,
                longitude=5.8,
                speed=15.0,
                course=180.0,
                heading=180.0,
                status="active",
                source="ais",
                is_fishing=False,
                last_position_update=datetime.utcnow() - timedelta(minutes=1)
            ),
            Vessel(
                mmsi="456789012",
                name="Supply Boat Oslo",
                callsign="SUPP01",
                vessel_type="Supply",
                length=28.0,
                width=6.8,
                latitude=59.9,
                longitude=4.5,
                speed=10.5,
                course=90.0,
                heading=90.0,
                status="active",
                source="ais",
                is_fishing=False,
                last_position_update=datetime.utcnow() - timedelta(minutes=5)
            ),
            Vessel(
                mmsi="567890123",
                name="Salmon Runner",
                callsign="SRUN",
                vessel_type="Fishing",
                length=22.0,
                width=5.8,
                latitude=61.0,
                longitude=5.5,
                speed=7.8,
                course=225.0,
                heading=225.0,
                status="active",
                source="ais",
                is_fishing=True,
                last_position_update=datetime.utcnow() - timedelta(minutes=2)
            ),
        ]
        
        for vessel in vessels:
            db.add(vessel)
        
        db.commit()
        print(f"✓ Created {len(vessels)} demo vessels")
        
        print("\n✅ Vessel data initialized successfully!")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    init_vessel_data()
