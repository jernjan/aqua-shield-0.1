#!/usr/bin/env python
"""Initialize demo data for AquaShield."""
import sys
import os
import hashlib
sys.path.insert(0, os.path.dirname(__file__))

from app.db.database import SessionLocal, engine, Base
from app.db.models import User, Farm, RiskAssessment, Alert
from datetime import datetime, timedelta

def hash_password_simple(password: str) -> str:
    """Simple hash for demo purposes."""
    return hashlib.sha256(password.encode()).hexdigest()

def init_demo_data():
    """Initialize database with demo data."""
    
    # Create tables
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    
    try:
        # Check if demo user exists
        demo_user = db.query(User).filter(User.username == "demo_user").first()
        if demo_user:
            print("✓ Demo data already initialized")
            return
        
        # Create demo user
        demo_user = User(
            username="demo_user",
            email="demo@aquashield.local",
            hashed_password=hash_password_simple("demo123"),
            is_active=True
        )
        db.add(demo_user)
        db.commit()
        db.refresh(demo_user)
        print(f"✓ Created demo user: {demo_user.username}")
        
        # Create demo farms
        farms = [
            Farm(
                owner_id=demo_user.id,
                name="Fjord Farm North",
                latitude=60.5,
                longitude=5.5,
                description="Salmon farm in northern fjord"
            ),
            Farm(
                owner_id=demo_user.id,
                name="Coastal Aqua West",
                latitude=59.8,
                longitude=4.2,
                description="Coastal farming operation"
            ),
            Farm(
                owner_id=demo_user.id,
                name="Mountain Valley Farm",
                latitude=61.2,
                longitude=6.8,
                description="Mountain valley fish farm"
            ),
        ]
        for farm in farms:
            db.add(farm)
        db.commit()
        print(f"✓ Created {len(farms)} demo farms")
        
        # Create risk assessments for each farm
        risk_levels = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
        for i, farm in enumerate(farms):
            db.refresh(farm)
            risk_level = risk_levels[i % len(risk_levels)]
            assessment = RiskAssessment(
                farm_id=farm.id,
                risk_level=risk_level,
                disease_risk=0.3 + (i * 0.2),
                sea_lice_risk=0.2 + (i * 0.15),
                water_quality_risk=0.1 + (i * 0.1),
                escape_risk=0.05 + (i * 0.15),
                details=f"Risk assessment for {farm.name}",
                assessed_at=datetime.utcnow() - timedelta(hours=i)
            )
            db.add(assessment)
        db.commit()
        print("✓ Created risk assessments")
        
        # Create alerts for farms with high/critical risk
        alert_data = [
            {
                "farm_id": farms[1].id if len(farms) > 1 else farms[0].id,
                "alert_type": "sea_lice_warning",
                "severity": "HIGH",
                "title": "Sea Lice Detected",
                "message": "Elevated sea lice levels detected in farm sensors"
            },
            {
                "farm_id": farms[2].id if len(farms) > 2 else farms[0].id,
                "alert_type": "disease_outbreak",
                "severity": "CRITICAL",
                "title": "Disease Outbreak Risk",
                "message": "High disease outbreak risk from nearby farms"
            },
        ]
        
        for alert_info in alert_data:
            alert = Alert(
                user_id=demo_user.id,
                farm_id=alert_info["farm_id"],
                alert_type=alert_info["alert_type"],
                severity=alert_info["severity"],
                title=alert_info["title"],
                message=alert_info["message"],
                is_read=False
            )
            db.add(alert)
        db.commit()
        print(f"✓ Created {len(alert_data)} demo alerts")
        
        print("\n✅ Demo data initialized successfully!")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    init_demo_data()
