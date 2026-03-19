"""Add example disease data for testing."""
import asyncio
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.db.database import SessionLocal
from app.db.models import Farm, User
from app.db.models_disease import DiseaseOccurrence, InfectionZone, RiskPropagation

def add_example_disease_data():
    """Add sample disease occurrences for testing."""
    db = SessionLocal()
    
    try:
        # Get existing user and farms
        user = db.query(User).first()
        if not user:
            print("No user found. Create user first.")
            return
        
        farms = db.query(Farm).all()
        if len(farms) < 2:
            print(f"Need at least 2 farms. Found: {len(farms)}")
            return
        
        # Add disease occurrence at first farm
        disease1 = DiseaseOccurrence(
            farm_id=farms[0].id,
            disease_type="sea_lice",
            severity="HIGH",
            location_lat=farms[0].latitude,
            location_lon=farms[0].longitude,
            detected_at=datetime.utcnow() - timedelta(days=3),
            reported_by="farm_operator",
            lice_count=850,
            mortality_rate=0.12,
            treatment_applied="mechanical_delousing",
            transmission_vector="water_current",
            confidence_score=0.95,
            notes="Confirmed lice outbreak at farm. Treatment applied."
        )
        db.add(disease1)
        db.flush()
        
        print(f"✓ Added disease occurrence at farm {farms[0].name} (sea_lice)")
        
        # Add disease occurrence at second farm
        disease2 = DiseaseOccurrence(
            farm_id=farms[1].id,
            disease_type="amoebic_gill_disease",
            severity="MEDIUM",
            location_lat=farms[1].latitude,
            location_lon=farms[1].longitude,
            detected_at=datetime.utcnow() - timedelta(days=1),
            reported_by="surveillance",
            lice_count=None,
            mortality_rate=0.05,
            transmission_vector="escaped_fish",
            confidence_score=0.75,
            notes="AGD suspected. Monitoring ongoing."
        )
        db.add(disease2)
        db.flush()
        
        print(f"✓ Added disease occurrence at farm {farms[1].name} (amoebic_gill_disease)")
        
        # Add infection zones
        zone1 = InfectionZone(
            disease_type="sea_lice",
            center_lat=farms[0].latitude,
            center_lon=farms[0].longitude,
            radius_km=15.0,
            severity="HIGH",
            water_current_direction="NE",
            water_current_speed_knots=1.2,
            predicted_drift_hours=72,
            is_active=True,
            active_until=datetime.utcnow() + timedelta(days=14),
            source_occurrences=str(disease1.id)
        )
        db.add(zone1)
        
        print(f"✓ Created infection zone for sea_lice around farm {farms[0].name}")
        
        # Add risk propagation
        propagation = RiskPropagation(
            disease_occurrence_id=disease1.id,
            source_type="farm",
            source_farm_id=farms[0].id,
            target_type="farm",
            target_farm_id=farms[1].id,
            propagation_vector="water_current",
            transmission_probability=0.65,
            estimated_arrival_time=datetime.utcnow() + timedelta(hours=48),
            alert_sent=False
        )
        db.add(propagation)
        
        print(f"✓ Created risk propagation from {farms[0].name} to {farms[1].name}")
        
        db.commit()
        print("\n✅ Example disease data added successfully!")
        
    except Exception as e:
        db.rollback()
        print(f"❌ Error adding data: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    add_example_disease_data()
