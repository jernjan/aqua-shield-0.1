"""Vessel model"""
from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from ..db.database import Base


class Vessel(Base):
    """Vessel (boat) model"""
    __tablename__ = "vessels"
    
    id = Column(Integer, primary_key=True, index=True)
    ais_mmsi = Column(String, unique=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    name = Column(String)
    vessel_type = Column(String, nullable=True)
    call_sign = Column(String, nullable=True)
    flag = Column(String, nullable=True)
    
    # Current position
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    speed = Column(Float, nullable=True)
    heading = Column(Float, nullable=True)
    
    risk_score = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_position_update = Column(DateTime, nullable=True)
    
    # Relationships
    user = relationship("User", back_populates="vessels")
    alerts = relationship("Alert", back_populates="vessel")
