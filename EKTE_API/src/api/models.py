"""Pydantic models for API responses"""
from pydantic import BaseModel
from typing import List, Optional, Dict, Any


class Facility(BaseModel):
    """Aquaculture facility record"""
    code: str
    name: str
    municipality: str
    latitude: float
    longitude: float
    production_type: Optional[str] = "Laks"  # Default to Laks, from BarentsWatch data
    

class HealthSummary(BaseModel):
    """Fish health weekly summary from NAIS"""
    year: int
    week: int
    numberOfFilteredLocalities: int
    numberOfReportingLocalities: int
    numberOfLocalitiesWithIla: Dict[str, int]
    numberOfLocalitiesWithPd: Dict[str, int]
    localitiesAboveThreshold: int
    percentageOfLocalitiesAboveThreshold: float


class AISVessel(BaseModel):
    """AIS vessel position record"""
    mmsi: int
    latitude: float
    longitude: float
    speedOverGround: float
    courseOverGround: Optional[int]
    trueHeading: Optional[int]
    navigationalStatus: int
    msgtime: str


class OceanCurrent(BaseModel):
    """Ocean current data point"""
    latitude: float
    longitude: float
    eastward_velocity_ms: float
    northward_velocity_ms: float
    magnitude: float
    direction: float
    timestamp: str


class FacilitiesResponse(BaseModel):
    """Response with multiple facilities"""
    count: int
    total: int
    facilities: List[Facility]


class AISResponse(BaseModel):
    """Response with AIS vessels"""
    count: int
    total: int
    vessels: List[AISVessel]
