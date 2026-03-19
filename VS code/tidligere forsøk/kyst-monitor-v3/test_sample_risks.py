"""Test sample risk calculations for a few facilities"""

from src.database.connection import SessionLocal
from src.database.models import Facility, RiskAssessment
from src.risk_engine.calculator import RiskCalculator
from datetime import datetime

# Get 5 facilities
session = SessionLocal()
facilities = session.query(Facility).limit(5).all()

print(f"Calculating risk for {len(facilities)} sample facilities...")

calc = RiskCalculator()

for f in facilities:
    # Generate risk with mock data
    risk = calc.calculate_facility_risk(
        facility_id=str(f.id),
        facility_name=f.name,
        current_lice_count=5 + f.id % 100,  # Mock lice count
        current_temperature=10.0 + (f.id % 5),  # Mock temp
        vessel_visits_recent=[],
        downstream_facilities=[],
        wild_fish_risk_factor=0.3,
    )
    
    # Save risk assessment
    assessment = RiskAssessment(
        facility_id=f.id,
        assessment_date=datetime.utcnow(),
        total_risk_score=risk['total_score'],
        risk_level=risk['alert_level'],
        ocean_current_risk=risk['factors']['ocean_current']['score'],
        vessel_movement_risk=risk['factors']['vessel_movement']['score'],
        genetic_disease_risk=risk['factors']['genetic_disease']['score'],
        temperature_risk=risk['factors']['temperature']['score'],
    )
    session.add(assessment)
    print(f"  ✓ {f.name}: {risk['alert_level']} ({risk['total_score']})")

session.commit()
session.close()

print("✓ Risk calculations complete")
