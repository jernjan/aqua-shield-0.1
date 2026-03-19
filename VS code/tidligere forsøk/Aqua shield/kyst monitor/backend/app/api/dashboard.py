"""Dashboard API endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.db.database import get_db
from app.db.models import Farm, RiskAssessment, Alert
from app.core.security import get_current_user
from app.schemas.schemas import DashboardFarmData, DashboardResponse
from app.logging.logger import logger

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("", response_model=DashboardResponse)
def get_dashboard(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get dashboard data for current user."""
    user_id = int(current_user["user_id"])
    
    # Get all farms for user
    farms = db.query(Farm).filter(
        Farm.owner_id == user_id,
        Farm.is_active == True
    ).all()
    
    dashboard_farms = []
    
    for farm in farms:
        # Get latest risk assessment
        latest_assessment = db.query(RiskAssessment).filter(
            RiskAssessment.farm_id == farm.id
        ).order_by(desc(RiskAssessment.created_at)).first()
        
        # Build farm data with all required fields
        farm_data = DashboardFarmData(
            id=farm.id,
            name=farm.name,
            latitude=farm.latitude,
            longitude=farm.longitude,
            water_temperature=0.0,
            oxygen_level=0.0,
            ph_level=0.0,
            disease_risk=latest_assessment.disease_risk if latest_assessment else 0.0,
            escape_risk=latest_assessment.escape_risk if latest_assessment else 0.0,
            water_quality_risk=latest_assessment.water_quality_risk if latest_assessment else 0.0,
            sea_lice_risk=latest_assessment.sea_lice_risk if latest_assessment else 0.0,
            risk_level=latest_assessment.risk_level if latest_assessment else 'LOW',
            created_at=farm.created_at
        )
        
        dashboard_farms.append(farm_data)
    
    # Get overall statistics
    critical_alerts = db.query(Alert).filter(
        Alert.user_id == user_id,
        Alert.severity == "CRITICAL",
        Alert.is_read == False
    ).count()
    
    high_alerts = db.query(Alert).filter(
        Alert.user_id == user_id,
        Alert.severity == "HIGH",
        Alert.is_read == False
    ).count()
    
    medium_alerts = db.query(Alert).filter(
        Alert.user_id == user_id,
        Alert.severity == "MEDIUM",
        Alert.is_read == False
    ).count()
    
    low_alerts = db.query(Alert).filter(
        Alert.user_id == user_id,
        Alert.severity == "LOW",
        Alert.is_read == False
    ).count()
    
    # Get all alerts
    all_alerts = db.query(Alert).filter(
        Alert.user_id == user_id,
        Alert.is_read == False
    ).all()
    
    logger.info(f"Dashboard loaded for user {user_id}")
    
    return DashboardResponse(
        farms=dashboard_farms,
        alerts=all_alerts,
        critical_alerts_count=critical_alerts,
        high_alerts_count=high_alerts,
        medium_alerts_count=medium_alerts,
        low_alerts_count=low_alerts
    )
