"""Alert schemas (request/response)"""
from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from ..models.alert import AlertLevel


class AlertResponse(BaseModel):
    """Alert response"""
    id: int
    user_id: int
    facility_id: Optional[int]
    vessel_id: Optional[int]
    level: AlertLevel
    title: str
    message: str
    alert_type: str
    is_read: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class AlertUpdate(BaseModel):
    """Alert update request"""
    is_read: Optional[bool] = None
    is_acknowledged: Optional[bool] = None
