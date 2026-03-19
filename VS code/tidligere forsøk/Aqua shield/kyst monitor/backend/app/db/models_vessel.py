"""Vessel models for AquaShield."""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.db.database import Base


class Vessel(Base):
    """Fishing vessel or ship model."""
    
    __tablename__ = "vessels"
    
    id = Column(Integer, primary_key=True, index=True)
    mmsi = Column(String(50), unique=True, index=True, nullable=False)  # Maritime Mobile Service Identity
    name = Column(String(255), nullable=False)
    callsign = Column(String(50), nullable=True)
    vessel_type = Column(String(100), nullable=True)  # Fishing, Transport, Tanker, etc
    length = Column(Float, nullable=True)
    width = Column(Float, nullable=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    speed = Column(Float, default=0.0)  # knots
    course = Column(Float, nullable=True)  # degrees
    heading = Column(Float, nullable=True)  # degrees
    status = Column(String(50), default="active")  # active, inactive, moored
    last_position_update = Column(DateTime, default=datetime.utcnow)
    source = Column(String(50), default="ais")  # ais, manual, gps
    is_fishing = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    observations = relationship("VesselObservation", back_populates="vessel")
    proximity_events = relationship("VesselProximityEvent", back_populates="vessel")


class VesselObservation(Base):
    """Observation from fishing vessel about fish health, escapes, etc."""
    
    __tablename__ = "vessel_observations"
    
    id = Column(Integer, primary_key=True, index=True)
    vessel_id = Column(Integer, ForeignKey("vessels.id"), nullable=False)
    farm_id = Column(Integer, ForeignKey("farms.id"), nullable=True)
    observation_type = Column(String(100), nullable=False)  # escaped_fish, fish_health, water_quality, disease, etc
    severity = Column(String(50), nullable=False)  # LOW, MEDIUM, HIGH, CRITICAL
    location_lat = Column(Float, nullable=False)
    location_lon = Column(Float, nullable=False)
    description = Column(Text, nullable=False)
    image_url = Column(String(255), nullable=True)
    reward_points = Column(Integer, default=0)
    reward_status = Column(String(50), default="pending")  # pending, paid, rejected
    verified = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    vessel = relationship("Vessel", back_populates="observations")


class VesselProximityEvent(Base):
    """Track when vessels come near farms (escape risk detection)."""
    
    __tablename__ = "vessel_proximity_events"
    
    id = Column(Integer, primary_key=True, index=True)
    vessel_id = Column(Integer, ForeignKey("vessels.id"), nullable=False)
    farm_id = Column(Integer, ForeignKey("farms.id"), nullable=False)
    distance_km = Column(Float, nullable=False)
    risk_level = Column(String(50), nullable=False)  # LOW, MEDIUM, HIGH, CRITICAL
    vessel_speed = Column(Float, nullable=True)
    vessel_course = Column(Float, nullable=True)
    alert_triggered = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    vessel = relationship("Vessel", back_populates="proximity_events")
