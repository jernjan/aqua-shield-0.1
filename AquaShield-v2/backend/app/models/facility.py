"""Facility (fish farm) model"""
from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from ..db.database import Base


class Facility(Base):
    """Fish farm facility model"""
    __tablename__ = "facilities"
    
    id = Column(Integer, primary_key=True, index=True)
    barentswatch_id = Column(String, unique=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    name = Column(String)
    company_name = Column(String, nullable=True)
    latitude = Column(Float)
    longitude = Column(Float)
    municipality = Column(String, nullable=True)
    county = Column(String, nullable=True)
    
    # Latest data
    lice_count = Column(Integer, default=0)
    temperature = Column(Float, nullable=True)
    salinity = Column(Float, nullable=True)
    diseases = Column(String, nullable=True)  # JSON string
    risk_score = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_data_sync = Column(DateTime, nullable=True)
    
    # Relationships
    user = relationship("User", back_populates="facilities")
    alerts = relationship("Alert", back_populates="facility")
