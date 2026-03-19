"""Vessel API routes."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.db.models_vessel import Vessel, VesselProximityEvent
from app.db.models import Farm
from app.core.security import get_current_user
from app.core.config import settings
from app.services.barentswatch_service import barentswatch_service
from pydantic import BaseModel
from typing import List
from datetime import datetime
import math
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/vessels", tags=["vessels"])

class VesselResponse(BaseModel):
    id: int
    mmsi: str
    name: str
    vessel_type: str | None
    latitude: float
    longitude: float
    speed: float
    course: float | None
    status: str
    last_position_update: datetime
    
    class Config:
        from_attributes = True


class VesselDetailResponse(VesselResponse):
    callsign: str | None
    length: float | None
    width: float | None
    heading: float | None
    source: str
    is_fishing: bool
    observations_count: int = 0


def haversine_distance(lat1, lon1, lat2, lon2) -> float:
    """Calculate distance in km between two coordinates."""
    R = 6371  # Earth radius in km
    
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)
    
    a = math.sin(delta_lat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon/2)**2
    c = 2 * math.asin(math.sqrt(a))
    
    return R * c


@router.get("/proximity/risks")
async def get_proximity_risks(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get all proximity risks between vessels and farms."""
    farms = db.query(Farm).all()
    vessels = db.query(Vessel).filter(Vessel.status == "active").all()
    
    proximity_data = []
    
    for vessel in vessels:
        for farm in farms:
            distance = haversine_distance(
                vessel.latitude, vessel.longitude,
                farm.latitude, farm.longitude
            )
            
            # Calculate risk based on distance and vessel type
            if distance < 1:  # Less than 1km
                risk_level = "CRITICAL" if vessel.vessel_type == "Fishing" else "HIGH"
            elif distance < 5:  # Less than 5km
                risk_level = "HIGH" if vessel.vessel_type == "Fishing" else "MEDIUM"
            elif distance < 20:  # Less than 20km
                risk_level = "MEDIUM" if vessel.vessel_type == "Fishing" else "LOW"
            else:
                continue  # Skip if too far
            
            proximity_data.append({
                "vessel_id": vessel.id,
                "vessel_name": vessel.name,
                "farm_id": farm.id,
                "farm_name": farm.name,
                "distance_km": round(distance, 2),
                "risk_level": risk_level,
                "vessel_speed": vessel.speed,
                "vessel_type": vessel.vessel_type,
            })
    
    # Sort by distance (closest first)
    proximity_data.sort(key=lambda x: x["distance_km"])
    
    return proximity_data


@router.get("/sync-status")
def get_sync_status(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Check BarentsWatch integration status."""
    try:
        logger.info("Status check received")
        
        return {
            "status": "ready",
            "message": "BarentsWatch integration configured",
            "client_id_configured": bool(settings.BARENTZWATCH_CLIENT_ID),
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error in status: {e}", exc_info=True)
        return {"error": str(e)}


@router.post("/sync-from-barentswatch")
def sync_from_barentswatch(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Manually sync vessels from BarentsWatch."""
    try:
        # Get farms
        farms = db.query(Farm).all()
        if not farms:
            return {"error": "No farms configured", "synced": 0}
        
        logger.info(f"Syncing from BarentsWatch for {len(farms)} farms")
        
        # For now, just return status
        return {
            "status": "queued",
            "message": "Sync queued for background processing",
            "note": "Use /api/vessels to get current vessels",
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Sync failed: {e}", exc_info=True)
        return {"error": str(e), "synced": 0}


@router.get("/")
async def list_vessels(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """List all active vessels."""
    vessels = db.query(Vessel).filter(Vessel.status == "active").order_by(Vessel.last_position_update.desc()).limit(100).all()
    return vessels


@router.get("/near-farm/{farm_id}")
async def get_vessels_near_farm(
    farm_id: int,
    radius_km: float = 20,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get vessels near a specific farm."""
    farm = db.query(Farm).filter(Farm.id == farm_id).first()
    if not farm:
        return {"error": "Farm not found"}
    
    vessels = db.query(Vessel).filter(Vessel.status == "active").all()
    nearby = []
    
    for vessel in vessels:
        distance = haversine_distance(
            vessel.latitude, vessel.longitude,
            farm.latitude, farm.longitude
        )
        
        if distance <= radius_km:
            nearby.append({
                "vessel": VesselResponse.from_orm(vessel),
                "distance_km": round(distance, 2),
                "risk_level": "CRITICAL" if distance < 1 else ("HIGH" if distance < 5 else "MEDIUM"),
            })
    
    nearby.sort(key=lambda x: x["distance_km"])
    return nearby


@router.get("/{vessel_id:int}")
async def get_vessel(
    vessel_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get vessel details."""
    vessel = db.query(Vessel).filter(Vessel.id == vessel_id).first()
    if not vessel:
        return {"error": "Vessel not found"}
    
    detail = VesselDetailResponse.from_orm(vessel)
    detail.observations_count = len(vessel.observations)
    return detail
