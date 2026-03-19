"""Facility schemas (request/response)"""
from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class FacilityCreate(BaseModel):
    """Facility creation request"""
    barentswatch_id: str
    name: str


class FacilityUpdate(BaseModel):
    """Facility update request"""
    name: Optional[str] = None


class FacilityResponse(BaseModel):
    """Facility response"""
    id: int
    barentswatch_id: str
    name: str
    company_name: Optional[str]
    latitude: float
    longitude: float
    municipality: Optional[str]
    county: Optional[str]
    lice_count: int
    temperature: Optional[float]
    risk_score: int
    created_at: datetime
    updated_at: datetime
    last_data_sync: Optional[datetime]
    
    class Config:
        from_attributes = True
