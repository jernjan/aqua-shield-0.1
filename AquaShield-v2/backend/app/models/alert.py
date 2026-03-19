"""Alert model"""
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean, Enum as SQLEnum
from sqlalchemy.orm import relationship
from datetime import datetime
from enum import Enum
from ..db.database import Base


class AlertLevel(str, Enum):
    """Alert severity levels"""
    GREEN = "green"      # Safe
    YELLOW = "yellow"    # Warning
    RED = "red"          # Critical


class Alert(Base):
    """Alert/notification model"""
    __tablename__ = "alerts"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    facility_id = Column(Integer, ForeignKey("facilities.id"), nullable=True)
    vessel_id = Column(Integer, ForeignKey("vessels.id"), nullable=True)
    
    level = Column(SQLEnum(AlertLevel), default=AlertLevel.YELLOW)
    title = Column(String)
    message = Column(String)
    alert_type = Column(String)  # "disease", "lice", "temperature", etc.
    
    is_read = Column(Boolean, default=False)
    is_acknowledged = Column(Boolean, default=False)
    
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    acknowledged_at = Column(DateTime, nullable=True)
    
    # Relationships
    user = relationship("User", back_populates="alerts")
    facility = relationship("Facility", back_populates="alerts")
    vessel = relationship("Vessel", back_populates="alerts")
