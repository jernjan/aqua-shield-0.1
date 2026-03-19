"""Disease and lice tracking models for AquaShield."""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.db.database import Base


class DiseaseOccurrence(Base):
    """Track disease and lice outbreaks."""
    
    __tablename__ = "disease_occurrences"
    
    id = Column(Integer, primary_key=True, index=True)
    farm_id = Column(Integer, ForeignKey("farms.id"), nullable=False)
    disease_type = Column(String(100), nullable=False)  # sea_lice, amoebic_gill_disease, pancreas_disease, etc
    severity = Column(String(50), nullable=False)  # LOW, MEDIUM, HIGH, CRITICAL
    location_lat = Column(Float, nullable=False)
    location_lon = Column(Float, nullable=False)
    detected_at = Column(DateTime, default=datetime.utcnow)
    reported_by = Column(String(100), nullable=True)  # farm_operator, surveillance, vessel, etc
    lice_count = Column(Integer, nullable=True)
    mortality_rate = Column(Float, nullable=True)  # percentage
    treatment_applied = Column(String(255), nullable=True)
    source_vessel_mmsi = Column(String(50), nullable=True)  # ForeignKey if from boat
    source_farm_id = Column(Integer, ForeignKey("farms.id"), nullable=True)  # if from another farm
    transmission_vector = Column(String(100), nullable=True)  # water_current, vessel_contact, escaped_fish, etc
    confidence_score = Column(Float, default=0.5)  # 0-1, how confident about source
    is_resolved = Column(Boolean, default=False)
    resolved_at = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    farm = relationship("Farm", foreign_keys=[farm_id])
    source_farm = relationship("Farm", foreign_keys=[source_farm_id])
    risk_propagations = relationship("RiskPropagation", back_populates="disease_occurrence")


class InfectionZone(Base):
    """Geographic zones with confirmed disease/lice presence."""
    
    __tablename__ = "infection_zones"
    
    id = Column(Integer, primary_key=True, index=True)
    disease_type = Column(String(100), nullable=False)
    center_lat = Column(Float, nullable=False)
    center_lon = Column(Float, nullable=False)
    radius_km = Column(Float, nullable=False)  # radius of infected area
    severity = Column(String(50), nullable=False)  # LOW, MEDIUM, HIGH, CRITICAL
    source_occurrences = Column(String(500), nullable=True)  # JSON list of disease_occurrence IDs
    water_current_direction = Column(String(50), nullable=True)  # N, NE, E, SE, S, SW, W, NW
    water_current_speed_knots = Column(Float, nullable=True)
    predicted_drift_hours = Column(Integer, nullable=True)  # how long disease will drift
    is_active = Column(Boolean, default=True)
    active_until = Column(DateTime, nullable=True)  # expiration date
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class RiskPropagation(Base):
    """Track how risk/disease spreads from source to affected targets."""
    
    __tablename__ = "risk_propagations"
    
    id = Column(Integer, primary_key=True, index=True)
    disease_occurrence_id = Column(Integer, ForeignKey("disease_occurrences.id"), nullable=False)
    source_type = Column(String(50), nullable=False)  # farm, vessel, unknown
    source_farm_id = Column(Integer, ForeignKey("farms.id"), nullable=True)
    source_vessel_mmsi = Column(String(50), nullable=True)
    target_type = Column(String(50), nullable=False)  # farm, vessel
    target_farm_id = Column(Integer, ForeignKey("farms.id"), nullable=True)
    target_vessel_mmsi = Column(String(50), nullable=True)
    propagation_vector = Column(String(100), nullable=False)  # water_current, vessel_movement, escaped_fish
    transmission_probability = Column(Float, default=0.5)  # 0-1
    estimated_arrival_time = Column(DateTime, nullable=True)
    alert_sent = Column(Boolean, default=False)
    alert_sent_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    disease_occurrence = relationship("DiseaseOccurrence", back_populates="risk_propagations")


class VesselDiseaseExposure(Base):
    """Track when vessels have been exposed to disease zones."""
    
    __tablename__ = "vessel_disease_exposures"
    
    id = Column(Integer, primary_key=True, index=True)
    vessel_mmsi = Column(String(50), nullable=False, index=True)
    infection_zone_id = Column(Integer, ForeignKey("infection_zones.id"), nullable=False)
    disease_type = Column(String(100), nullable=False)
    exposure_date = Column(DateTime, nullable=False)
    exposure_duration_minutes = Column(Integer, nullable=True)
    confidence_score = Column(Float, default=0.5)  # 0-1
    alert_sent = Column(Boolean, default=False)
    recommended_action = Column(Text, nullable=True)  # desinfeksjon, karantene, inspeksjon
    created_at = Column(DateTime, default=datetime.utcnow)


class MLTrainingData(Base):
    """Store training data for disease spread prediction model."""
    
    __tablename__ = "ml_training_data"
    
    id = Column(Integer, primary_key=True, index=True)
    feature_vector = Column(JSON, nullable=False)  # all features as JSON
    # Features include:
    # - source_disease_type, source_severity
    # - distance_to_target, water_current_speed, water_current_direction
    # - target_farm_fish_biomass, target_farm_defense_level
    # - vessel_type, vessel_speed, vessel_proximity
    # - historical_transmission_rate
    
    outcome = Column(String(50), nullable=False)  # transmitted, not_transmitted
    outcome_date = Column(DateTime, nullable=False)
    confidence = Column(Float, default=1.0)  # 0-1, how sure we are about outcome
    created_at = Column(DateTime, default=datetime.utcnow)


class ModelPrediction(Base):
    """Store ML model predictions for monitoring."""
    
    __tablename__ = "model_predictions"
    
    id = Column(Integer, primary_key=True, index=True)
    source_farm_id = Column(Integer, ForeignKey("farms.id"), nullable=True)
    source_vessel_mmsi = Column(String(50), nullable=True)
    target_farm_id = Column(Integer, ForeignKey("farms.id"), nullable=True)
    target_vessel_mmsi = Column(String(50), nullable=True)
    disease_type = Column(String(100), nullable=False)
    transmission_probability = Column(Float, nullable=False)  # 0-1
    predicted_arrival = Column(DateTime, nullable=False)
    model_version = Column(String(50), nullable=False)
    model_accuracy = Column(Float, nullable=True)  # 0-1
    prediction_active = Column(Boolean, default=True)
    verified = Column(Boolean, default=False)  # once outcome is known
    verified_outcome = Column(String(50), nullable=True)  # transmitted, not_transmitted
    verified_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
