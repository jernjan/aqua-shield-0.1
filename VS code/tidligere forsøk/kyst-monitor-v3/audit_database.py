"""Check what actual data we have in the database"""
from src.database.connection import SessionLocal
from src.database.models import Facility, HealthStatus, Vessel, RiskAssessment, WeatherData

session = SessionLocal()

# Check what we have
facilities_count = session.query(Facility).count()
health_count = session.query(HealthStatus).count()
vessel_count = session.query(Vessel).count()
risk_count = session.query(RiskAssessment).count()
weather_count = session.query(WeatherData).count()

print("=" * 60)
print("DATABASE CONTENT AUDIT")
print("=" * 60)
print(f"Facilities:        {facilities_count:,}")
print(f"Health records:    {health_count:,}")
print(f"Vessels:           {vessel_count:,}")
print(f"Risk assessments:  {risk_count:,}")
print(f"Weather records:   {weather_count:,}")
print("=" * 60)

# Check a sample facility
if facilities_count > 0:
    fac = session.query(Facility).first()
    print(f"\nSample facility:")
    print(f"  Name: {fac.name}")
    print(f"  Lat/Long: {fac.latitude}, {fac.longitude}")
    print(f"  Species: {fac.species}")
    print(f"  Production status: {fac.production_status}")
    
    # Check if this facility has health data
    health = session.query(HealthStatus).filter_by(facility_id=fac.id).first()
    print(f"  Has health data: {health is not None}")
    
    # Check if facility has risk assessment
    risk = session.query(RiskAssessment).filter_by(facility_id=fac.id).first()
    print(f"  Has risk assessment: {risk is not None}")

print("\n" + "=" * 60)
print("VERDICT:")
print("=" * 60)
if health_count == 0:
    print("❌ NO HEALTH DATA - API syncing failed")
if vessel_count == 0:
    print("❌ NO VESSEL DATA - AIS not working")
if weather_count == 0:
    print("❌ NO WEATHER DATA - Weather API not syncing")
if risk_count < 10:
    print(f"❌ MINIMAL RISK DATA - only {risk_count} records (should be 2,687)")

session.close()
