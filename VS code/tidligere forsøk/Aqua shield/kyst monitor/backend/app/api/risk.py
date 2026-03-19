"""Risk assessment API endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.db.models import Farm, RiskAssessment
from app.core.security import get_current_user
from app.schemas.schemas import RiskAssessmentResponse
from app.services.risk_assessment_service import RiskAssessmentService
from app.logging.logger import logger

router = APIRouter(prefix="/api/risk", tags=["risk-assessment"])
risk_service = RiskAssessmentService()


@router.post("/assess/{farm_id}", response_model=RiskAssessmentResponse)
async def assess_farm_risk(
    farm_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Assess risk for a specific farm."""
    user_id = int(current_user["user_id"])
    
    # Verify farm exists and belongs to user
    farm = db.query(Farm).filter(
        Farm.id == farm_id,
        Farm.owner_id == user_id
    ).first()
    
    if not farm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Farm not found"
        )
    
    # Perform assessment
    risk_level, scores = await risk_service.assess_farm_risk(db, farm)
    
    # Save assessment
    assessment = await risk_service.save_assessment(
        db, farm, risk_level, scores
    )
    
    logger.info(f"Risk assessment completed for farm {farm_id}")
    return assessment


@router.get("/history/{farm_id}", response_model=list[RiskAssessmentResponse])
def get_risk_history(
    farm_id: int,
    limit: int = 30,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get risk assessment history for a farm."""
    user_id = int(current_user["user_id"])
    
    # Verify farm exists and belongs to user
    farm = db.query(Farm).filter(
        Farm.id == farm_id,
        Farm.owner_id == user_id
    ).first()
    
    if not farm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Farm not found"
        )
    
    assessments = db.query(RiskAssessment).filter(
        RiskAssessment.farm_id == farm_id
    ).order_by(
        RiskAssessment.created_at.desc()
    ).limit(limit).all()
    
    return assessments


@router.get("/latest/{farm_id}", response_model=RiskAssessmentResponse)
def get_latest_assessment(
    farm_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get latest risk assessment for a farm."""
    user_id = int(current_user["user_id"])
    
    # Verify farm exists and belongs to user
    farm = db.query(Farm).filter(
        Farm.id == farm_id,
        Farm.owner_id == user_id
    ).first()
    
    if not farm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Farm not found"
        )
    
    assessment = db.query(RiskAssessment).filter(
        RiskAssessment.farm_id == farm_id
    ).order_by(
        RiskAssessment.created_at.desc()
    ).first()
    
    if not assessment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No assessments found for this farm"
        )
    
    return assessment
