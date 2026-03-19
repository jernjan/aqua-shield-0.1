"""Pydantic schemas for API request/response validation."""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field


# User schemas
class UserBase(BaseModel):
    """Base user schema."""
    username: str = Field(..., min_length=3, max_length=255)
    email: EmailStr


class UserCreate(UserBase):
    """User creation schema."""
    password: str = Field(..., min_length=8)


class UserLogin(BaseModel):
    """User login schema."""
    username: str
    password: str


class UserResponse(UserBase):
    """User response schema."""
    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    """Token response schema."""
    access_token: str
    token_type: str = "bearer"


# Farm schemas
class FarmBase(BaseModel):
    """Base farm schema."""
    name: str = Field(..., min_length=1, max_length=255)
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    description: Optional[str] = None


class FarmCreate(FarmBase):
    """Farm creation schema."""
    pass


class FarmUpdate(BaseModel):
    """Farm update schema."""
    name: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class FarmResponse(FarmBase):
    """Farm response schema."""
    id: int
    owner_id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


# Risk Assessment schemas
class RiskAssessmentBase(BaseModel):
    """Base risk assessment schema."""
    risk_level: str
    disease_risk: float = Field(default=0.0, ge=0, le=1)
    escape_risk: float = Field(default=0.0, ge=0, le=1)
    water_quality_risk: float = Field(default=0.0, ge=0, le=1)
    sea_lice_risk: float = Field(default=0.0, ge=0, le=1)
    details: Optional[str] = None


class RiskAssessmentResponse(RiskAssessmentBase):
    """Risk assessment response schema."""
    id: int
    farm_id: int
    assessed_at: datetime
    created_at: datetime
    
    class Config:
        from_attributes = True


# Alert schemas
class AlertBase(BaseModel):
    """Base alert schema."""
    alert_type: str
    severity: str
    title: str
    message: str


class AlertResponse(AlertBase):
    """Alert response schema."""
    id: int
    user_id: int
    farm_id: int
    is_read: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class AlertUpdate(BaseModel):
    """Alert update schema."""
    is_read: Optional[bool] = None


# Dashboard schemas
class DashboardFarmData(BaseModel):
    """Dashboard farm data schema."""
    id: int
    name: str
    latitude: float
    longitude: float
    water_temperature: float = 0.0
    oxygen_level: float = 0.0
    ph_level: float = 0.0
    disease_risk: float = 0.0
    escape_risk: float = 0.0
    water_quality_risk: float = 0.0
    sea_lice_risk: float = 0.0
    risk_level: str = 'LOW'
    created_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class DashboardResponse(BaseModel):
    """Dashboard response schema."""
    farms: list[DashboardFarmData]
    alerts: list[AlertResponse] = []
    critical_alerts_count: int = 0
    high_alerts_count: int = 0
    medium_alerts_count: int = 0
    low_alerts_count: int = 0
