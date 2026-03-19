"""Facility routes with advanced risk calculation"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from app.schemas.facility import FacilityCreate, FacilityResponse, FacilityUpdate
from app.models.facility import Facility
from app.db.database import get_db
from app.utils.logger import logger
from app.services.risk import RiskCalculationService
from app.services.barentswatch import BarentsWatchService
from app.services.ocean_currents import OceanCurrentService

router = APIRouter(prefix="/api/facilities", tags=["facilities"])
risk_service = RiskCalculationService()
barentswatch_service = BarentsWatchService()
ocean_current_service = OceanCurrentService()


@router.get("", response_model=List[dict])
async def get_facilities(db: Session = Depends(get_db)):
    """Get all facilities with calculated risk scores from BarentsWatch API"""
    
    try:
        # Fetch real data from BarentsWatch API
        logger.info("Fetching facilities from BarentsWatch API...")
        bw_facilities = await barentswatch_service.get_facilities()
        
        if not bw_facilities:
            logger.warning("No facilities returned from BarentsWatch API")
            return []
        
        logger.info(f"Retrieved {len(bw_facilities)} facilities from BarentsWatch")
        
        # Get real vessel data
        logger.info("Fetching vessel tracking data...")
        vessels = await barentswatch_service.get_vessels()
        
        # Calculate risk for each facility with real data
        result = []
        for facility in bw_facilities:
            # Get current ocean data for this location
            ocean_current = await ocean_current_service.get_current_data(
                facility.get('latitude'),
                facility.get('longitude')
            )
            
            # Calculate risk with real data
            risk = risk_service.calculate_facility_risk(
                facility,
                bw_facilities,
                vessels or [],
                ocean_current
            )
            
            result.append({
                'id': facility.get('id'),
                'name': facility.get('name'),
                'barentswatch_id': facility.get('barentswatch_id'),
                'latitude': facility.get('latitude'),
                'longitude': facility.get('longitude'),
                'lice_count': facility.get('lice_count'),
                'temperature': facility.get('temperature'),
                'diseases': facility.get('diseases'),
                'risk_score': risk['score'],
                'risk_level': risk['level'],
                'risk_factors': risk['factors'],
                'data_source': 'BarentsWatch API'
            })
        
        logger.info(f"Returned {len(result)} facilities with real-time risk calculations from BarentsWatch")
        return result
        
    except Exception as e:
        logger.error(f"Error fetching facilities from BarentsWatch: {e}")
        # If API fails, return empty instead of mock data
        return []


@router.post("", response_model=dict)
def add_facility(
    facility: FacilityCreate,
    db: Session = Depends(get_db),
):
    """Add a facility to user's watchlist"""
    db_facility = (
        db.query(Facility)
        .filter(Facility.barentswatch_id == facility.barentswatch_id)
        .first()
    )

    if db_facility:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Facility already added",
        )

    new_facility = Facility(
        barentswatch_id=facility.barentswatch_id,
        name=facility.name,
        latitude=0.0,
        longitude=0.0,
    )

    db.add(new_facility)
    db.commit()
    db.refresh(new_facility)

    logger.info(f"Facility added: {facility.barentswatch_id}")
    return {
        'id': new_facility.id,
        'name': new_facility.name,
        'barentswatch_id': new_facility.barentswatch_id
    }


@router.get("/{facility_id}", response_model=dict)
def get_facility(facility_id: int, db: Session = Depends(get_db)):
    """Get facility details with risk calculation"""
    facility = db.query(Facility).filter(Facility.id == facility_id).first()

    if not facility:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Facility not found",
        )

    facility_dict = {
        'id': facility.id,
        'name': facility.name,
        'barentswatch_id': facility.barentswatch_id,
        'latitude': facility.latitude,
        'longitude': facility.longitude,
        'lice_count': facility.lice_count or 0,
        'temperature': facility.temperature or 12.0,
        'diseases': facility.diseases or []
    }

    risk = risk_service.calculate_facility_risk(
        facility_dict,
        MOCK_FACILITIES,
        MOCK_VESSELS,
        MOCK_OCEAN_CURRENT
    )

    return {
        **facility_dict,
        'risk_score': risk['score'],
        'risk_level': risk['level'],
        'risk_factors': risk['factors']
    }


@router.put("/{facility_id}", response_model=dict)
def update_facility(
    facility_id: int,
    facility_update: FacilityUpdate,
    db: Session = Depends(get_db),
):
    """Update facility"""
    facility = db.query(Facility).filter(Facility.id == facility_id).first()

    if not facility:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Facility not found",
        )

    if facility_update.name:
        facility.name = facility_update.name

    db.commit()
    db.refresh(facility)

    return {
        'id': facility.id,
        'name': facility.name,
        'barentswatch_id': facility.barentswatch_id
    }
