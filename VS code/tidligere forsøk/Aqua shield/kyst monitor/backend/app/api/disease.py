"""API endpoints for disease tracking and risk analysis."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import List, Optional
from app.db.database import get_db
from app.db import models_disease as disease_models
from app.db.models import Farm, Alert
from app.db.models_vessel import Vessel
from app.services.disease_risk_service import disease_risk_service
from pydantic import BaseModel

router = APIRouter(prefix="/api/disease", tags=["disease"])


# ============ Pydantic Schemas ============

class DiseaseOccurrenceCreate(BaseModel):
    farm_id: int
    disease_type: str
    severity: str  # LOW, MEDIUM, HIGH, CRITICAL
    location_lat: float
    location_lon: float
    lice_count: Optional[int] = None
    mortality_rate: Optional[float] = None
    treatment_applied: Optional[str] = None
    source_vessel_mmsi: Optional[str] = None
    transmission_vector: Optional[str] = None
    reported_by: Optional[str] = "manual"
    notes: Optional[str] = None


class DiseaseOccurrenceResponse(BaseModel):
    id: int
    farm_id: int
    disease_type: str
    severity: str
    location_lat: float
    location_lon: float
    detected_at: datetime
    lice_count: Optional[int]
    is_resolved: bool
    created_at: datetime

    class Config:
        from_attributes = True


class InfectionZoneResponse(BaseModel):
    id: int
    disease_type: str
    center_lat: float
    center_lon: float
    radius_km: float
    severity: str
    water_current_direction: Optional[str]
    water_current_speed_knots: Optional[float]
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class VesselExposureResponse(BaseModel):
    vessel_mmsi: str
    disease_type: str
    exposure_date: datetime
    distance_km: Optional[float]
    confidence_score: float
    recommended_action: Optional[str]

    class Config:
        from_attributes = True


class FarmRiskAnalysisResponse(BaseModel):
    farm_id: int
    farm_name: str
    overall_risk_score: float
    risk_level: str  # LOW, MEDIUM, HIGH, CRITICAL
    vessel_risks: List[dict]
    zone_risks: List[dict]


# ============ Disease Occurrences ============

@router.post("/occurrences", response_model=DiseaseOccurrenceResponse)
async def report_disease_occurrence(
    disease: DiseaseOccurrenceCreate,
    db: Session = Depends(get_db)
):
    """Report a new disease occurrence."""
    occurrence = disease_models.DiseaseOccurrence(
        farm_id=disease.farm_id,
        disease_type=disease.disease_type,
        severity=disease.severity,
        location_lat=disease.location_lat,
        location_lon=disease.location_lon,
        lice_count=disease.lice_count,
        mortality_rate=disease.mortality_rate,
        treatment_applied=disease.treatment_applied,
        source_vessel_mmsi=disease.source_vessel_mmsi,
        transmission_vector=disease.transmission_vector,
        reported_by=disease.reported_by,
        notes=disease.notes,
        confidence_score=0.8  # High confidence for manual reports
    )
    
    db.add(occurrence)
    db.commit()
    db.refresh(occurrence)
    
    # Update infection zones with new data
    await disease_risk_service.update_infection_zones(db)
    
    return occurrence


@router.get("/occurrences", response_model=List[DiseaseOccurrenceResponse])
async def get_disease_occurrences(
    farm_id: Optional[int] = Query(None),
    days: int = Query(7, ge=1, le=90),
    active_only: bool = Query(True),
    db: Session = Depends(get_db)
):
    """Get disease occurrences (last N days)."""
    query = db.query(disease_models.DiseaseOccurrence).filter(
        disease_models.DiseaseOccurrence.detected_at >= datetime.utcnow() - timedelta(days=days)
    )
    
    if active_only:
        query = query.filter(disease_models.DiseaseOccurrence.is_resolved == False)
    
    if farm_id:
        query = query.filter(disease_models.DiseaseOccurrence.farm_id == farm_id)
    
    return query.order_by(disease_models.DiseaseOccurrence.detected_at.desc()).all()


@router.get("/occurrences/{occurrence_id}", response_model=DiseaseOccurrenceResponse)
async def get_disease_occurrence(occurrence_id: int, db: Session = Depends(get_db)):
    """Get specific disease occurrence."""
    occurrence = db.query(disease_models.DiseaseOccurrence).filter(
        disease_models.DiseaseOccurrence.id == occurrence_id
    ).first()
    
    if not occurrence:
        raise HTTPException(status_code=404, detail="Occurrence not found")
    
    return occurrence


@router.put("/occurrences/{occurrence_id}/resolve")
async def resolve_disease_occurrence(occurrence_id: int, db: Session = Depends(get_db)):
    """Mark disease occurrence as resolved."""
    occurrence = db.query(disease_models.DiseaseOccurrence).filter(
        disease_models.DiseaseOccurrence.id == occurrence_id
    ).first()
    
    if not occurrence:
        raise HTTPException(status_code=404, detail="Occurrence not found")
    
    occurrence.is_resolved = True
    occurrence.resolved_at = datetime.utcnow()
    db.commit()
    
    # Update infection zones
    await disease_risk_service.update_infection_zones(db)
    
    return {"status": "resolved", "occurrence_id": occurrence_id}


# ============ Infection Zones ============

@router.get("/zones", response_model=List[InfectionZoneResponse])
async def get_infection_zones(
    active_only: bool = Query(True),
    db: Session = Depends(get_db)
):
    """Get all infection zones."""
    query = db.query(disease_models.InfectionZone)
    
    if active_only:
        query = query.filter(disease_models.InfectionZone.is_active == True)
    
    return query.order_by(disease_models.InfectionZone.severity.desc()).all()


@router.get("/zones/{zone_id}", response_model=InfectionZoneResponse)
async def get_infection_zone(zone_id: int, db: Session = Depends(get_db)):
    """Get specific infection zone."""
    zone = db.query(disease_models.InfectionZone).filter(
        disease_models.InfectionZone.id == zone_id
    ).first()
    
    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")
    
    return zone


# ============ Vessel Exposure ============

@router.get("/vessel-exposures", response_model=List[VesselExposureResponse])
async def get_vessel_exposures(
    vessel_mmsi: Optional[str] = Query(None),
    days: int = Query(7, ge=1, le=30),
    db: Session = Depends(get_db)
):
    """Get vessel disease exposures."""
    query = db.query(disease_models.VesselDiseaseExposure).filter(
        disease_models.VesselDiseaseExposure.exposure_date >= datetime.utcnow() - timedelta(days=days)
    )
    
    if vessel_mmsi:
        query = query.filter(disease_models.VesselDiseaseExposure.vessel_mmsi == vessel_mmsi)
    
    return query.order_by(disease_models.VesselDiseaseExposure.exposure_date.desc()).all()


@router.post("/check-vessel-exposures")
async def check_vessel_exposures(db: Session = Depends(get_db)):
    """Check all vessels for disease zone exposure."""
    vessels = db.query(Vessel).filter(Vessel.status == "active").all()
    
    alerts = await disease_risk_service.check_vessel_disease_exposure(db, vessels)
    
    return {
        "vessels_checked": len(vessels),
        "new_exposures": len(alerts),
        "alerts_created": [
            {"id": alert.id, "title": alert.title, "severity": alert.severity}
            for alert in alerts
        ]
    }


# ============ Farm Risk Analysis ============

@router.get("/farm-risk/{farm_id}", response_model=FarmRiskAnalysisResponse)
async def analyze_farm_risk(farm_id: int, db: Session = Depends(get_db)):
    """Get comprehensive disease risk analysis for a farm."""
    farm = db.query(Farm).filter(Farm.id == farm_id).first()
    
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")
    
    risk_analysis = await disease_risk_service.analyze_farm_risk(db, farm)
    
    return risk_analysis


@router.get("/all-farms-risk")
async def analyze_all_farms_risk(db: Session = Depends(get_db)):
    """Get risk analysis for all farms."""
    farms = db.query(Farm).filter(Farm.is_active == True).all()
    
    all_risks = []
    for farm in farms:
        risk = await disease_risk_service.analyze_farm_risk(db, farm)
        all_risks.append(risk)
    
    # Sort by risk level
    risk_order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}
    all_risks.sort(key=lambda x: risk_order.get(x["risk_level"], 4))
    
    return {
        "total_farms": len(farms),
        "farms_by_risk": all_risks,
        "critical_count": len([r for r in all_risks if r["risk_level"] == "CRITICAL"]),
        "high_count": len([r for r in all_risks if r["risk_level"] == "HIGH"]),
        "generated_at": datetime.utcnow().isoformat()
    }


# ============ Update Infection Zones ============

@router.post("/update-zones")
async def update_infection_zones(db: Session = Depends(get_db)):
    """Manually trigger infection zone update."""
    await disease_risk_service.update_infection_zones(db)
    
    zones = db.query(disease_models.InfectionZone).filter(
        disease_models.InfectionZone.is_active == True
    ).all()
    
    return {
        "status": "updated",
        "active_zones": len(zones),
        "timestamp": datetime.utcnow().isoformat()
    }
