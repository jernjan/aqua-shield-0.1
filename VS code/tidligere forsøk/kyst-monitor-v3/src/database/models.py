"""
Database Models for Kyst Monitor
Using SQLAlchemy ORM with SQLite (easily upgradeable to PostgreSQL)

Tables:
- Facilities (Anlegg)
- Vessels (Båter)
- Health Status (Lus/sykdom)
- Weather Data
- Risk Assessments
- Alerts
"""

from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, ForeignKey, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship

Base = declarative_base()


class Facility(Base):
    """Aquaculture facility/anlegg"""
    __tablename__ = "facilities"
    
    id = Column(Integer, primary_key=True, index=True)
    locality_no = Column(Integer, unique=True, index=True)
    name = Column(String, index=True)
    municipality_no = Column(String, index=True)
    municipality = Column(String, index=True)
    
    # Location
    latitude = Column(Float)
    longitude = Column(Float)
    
    # Details from BarentsWatch
    species = Column(String)  # salmon, trout, etc
    capacity_kg = Column(Float)
    production_status = Column(String)  # active, fallowing, etc
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    health_records = relationship("HealthStatus", back_populates="facility", cascade="all, delete-orphan")
    risk_assessments = relationship("RiskAssessment", back_populates="facility", cascade="all, delete-orphan")
    alerts = relationship("Alert", back_populates="facility", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Facility {self.name} ({self.locality_no})>"


class HealthStatus(Base):
    """Fish health status - lice, diseases, etc"""
    __tablename__ = "health_status"
    
    id = Column(Integer, primary_key=True, index=True)
    facility_id = Column(Integer, ForeignKey("facilities.id"), index=True)
    
    # Weekly data
    year = Column(Integer, index=True)
    week = Column(Integer, index=True)
    
    # Salmon lice
    salmon_lice_count = Column(Integer)
    lice_treatment_applied = Column(Boolean, default=False)
    
    # Diseases
    pd_status = Column(String)  # infected, clean, unknown
    isa_status = Column(String)  # infected, clean, unknown
    
    # Data source
    reported_date = Column(DateTime)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    facility = relationship("Facility", back_populates="health_records")
    
    def __repr__(self):
        return f"<HealthStatus week {self.week}/{self.year}>"


class Vessel(Base):
    """Fishing vessel / wellboat from AIS"""
    __tablename__ = "vessels"
    
    id = Column(Integer, primary_key=True, index=True)
    mmsi = Column(String, unique=True, index=True)  # Maritime identifier
    name = Column(String, index=True)
    ship_type = Column(String)  # wellboat, slaughter boat, service vessel, etc
    
    # Latest position
    latitude = Column(Float)
    longitude = Column(Float)
    course = Column(Float)  # degrees
    speed = Column(Float)   # knots
    
    # Last update
    last_position_update = Column(DateTime, default=datetime.utcnow)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    visits = relationship("VesselVisit", back_populates="vessel", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Vessel {self.name} ({self.mmsi})>"


class VesselVisit(Base):
    """Record of vessel visiting a facility"""
    __tablename__ = "vessel_visits"
    
    id = Column(Integer, primary_key=True, index=True)
    vessel_id = Column(Integer, ForeignKey("vessels.id"), index=True)
    facility_id = Column(Integer, ForeignKey("facilities.id"), index=True)
    
    # When did it visit
    visit_date = Column(DateTime, index=True)
    duration_hours = Column(Float)
    
    # Purpose
    visit_type = Column(String)  # wellboat, slaughter, service, etc
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    vessel = relationship("Vessel", back_populates="visits")
    facility = relationship("Facility")
    
    def __repr__(self):
        return f"<VesselVisit {self.vessel.name} -> {self.facility.name}>"


class WeatherData(Base):
    """Weather forecast for a location"""
    __tablename__ = "weather_data"
    
    id = Column(Integer, primary_key=True, index=True)
    latitude = Column(Float, index=True)
    longitude = Column(Float, index=True)
    
    # Forecast time
    forecast_date = Column(DateTime, index=True)
    
    # Weather metrics
    temperature_c = Column(Float)
    wind_speed_ms = Column(Float)
    wind_direction = Column(Float)
    precipitation_mm = Column(Float)
    
    # Raw data (backup)
    raw_data = Column(JSON)
    
    # Metadata
    fetched_at = Column(DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f"<WeatherData {self.latitude},{self.longitude} on {self.forecast_date}>"


class RiskAssessment(Base):
    """Risk assessment for a facility"""
    __tablename__ = "risk_assessments"
    
    id = Column(Integer, primary_key=True, index=True)
    facility_id = Column(Integer, ForeignKey("facilities.id"), index=True)
    
    # Assessment date
    assessment_date = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Risk factors (0-100 points each)
    ocean_current_risk = Column(Integer)      # 0-40
    vessel_movement_risk = Column(Integer)    # 0-30
    genetic_disease_risk = Column(Integer)    # 0-20
    temperature_risk = Column(Integer)        # 0-10
    
    # Total risk
    total_risk_score = Column(Integer)  # 0-100
    risk_level = Column(String)  # green, yellow, red
    
    # Explanation
    risk_factors_json = Column(JSON)  # detailed breakdown
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    facility = relationship("Facility", back_populates="risk_assessments")
    
    def __repr__(self):
        return f"<RiskAssessment {self.facility.name} score={self.total_risk_score}>"


class Alert(Base):
    """Alert for high-risk situation"""
    __tablename__ = "alerts"
    
    id = Column(Integer, primary_key=True, index=True)
    facility_id = Column(Integer, ForeignKey("facilities.id"), index=True)
    
    # Alert details
    alert_type = Column(String)  # lice_risk, disease_risk, vessel_risk, etc
    severity = Column(String, index=True)  # low, medium, high, critical
    
    # Message
    title = Column(String)
    description = Column(String)
    recommendation = Column(String)
    
    # Status
    is_active = Column(Boolean, default=True, index=True)
    acknowledged = Column(Boolean, default=False)
    resolved = Column(Boolean, default=False)
    
    # Timeline
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    acknowledged_at = Column(DateTime)
    resolved_at = Column(DateTime)
    
    # Relationships
    facility = relationship("Facility", back_populates="alerts")
    
    def __repr__(self):
        return f"<Alert {self.severity}: {self.title}>"


# Statistics/summary tables for performance

class DailyFacilityStats(Base):
    """Daily aggregated statistics per facility"""
    __tablename__ = "daily_facility_stats"
    
    id = Column(Integer, primary_key=True, index=True)
    facility_id = Column(Integer, ForeignKey("facilities.id"), index=True)
    
    stats_date = Column(DateTime, index=True)
    
    # Aggregates
    avg_risk_score = Column(Float)
    active_alerts_count = Column(Integer)
    vessel_visits_count = Column(Integer)
    
    # Metadata
    calculated_at = Column(DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f"<DailyStats {self.stats_date}>"


class User(Base):
    """User accounts for dashboard"""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    full_name = Column(String)
    
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    
    # Preferences
    notification_preferences = Column(JSON)
    watched_facilities = Column(JSON)  # list of facility IDs
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f"<User {self.email}>"
