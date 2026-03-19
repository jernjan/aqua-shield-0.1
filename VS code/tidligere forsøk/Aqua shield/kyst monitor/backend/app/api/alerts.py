"""Alert management API endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.db.models import Alert, Farm
from app.core.security import get_current_user
from app.schemas.schemas import AlertResponse, AlertUpdate
from app.logging.logger import logger

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


@router.get("", response_model=list[AlertResponse])
def get_alerts(
    unread_only: bool = False,
    farm_id: int = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get alerts for current user."""
    user_id = int(current_user["user_id"])
    
    query = db.query(Alert).filter(Alert.user_id == user_id)
    
    if unread_only:
        query = query.filter(Alert.is_read == False)
    
    if farm_id:
        # Verify farm belongs to user
        farm = db.query(Farm).filter(
            Farm.id == farm_id,
            Farm.owner_id == user_id
        ).first()
        
        if not farm:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Farm not found"
            )
        
        query = query.filter(Alert.farm_id == farm_id)
    
    alerts = query.order_by(Alert.created_at.desc()).all()
    return alerts


@router.get("/{alert_id}", response_model=AlertResponse)
def get_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get specific alert details."""
    user_id = int(current_user["user_id"])
    
    alert = db.query(Alert).filter(
        Alert.id == alert_id,
        Alert.user_id == user_id
    ).first()
    
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alert not found"
        )
    
    return alert


@router.patch("/{alert_id}", response_model=AlertResponse)
def update_alert(
    alert_id: int,
    alert_update: AlertUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Update alert status."""
    user_id = int(current_user["user_id"])
    
    alert = db.query(Alert).filter(
        Alert.id == alert_id,
        Alert.user_id == user_id
    ).first()
    
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alert not found"
        )
    
    # Update fields if provided
    update_data = alert_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(alert, field, value)
    
    db.add(alert)
    db.commit()
    db.refresh(alert)
    
    logger.info(f"Alert updated: {alert_id}")
    return alert


@router.delete("/{alert_id}")
def delete_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Delete an alert."""
    user_id = int(current_user["user_id"])
    
    alert = db.query(Alert).filter(
        Alert.id == alert_id,
        Alert.user_id == user_id
    ).first()
    
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alert not found"
        )
    
    db.delete(alert)
    db.commit()
    
    logger.info(f"Alert deleted: {alert_id}")
    return {"message": "Alert deleted successfully"}


@router.get("/stats/summary", response_model=dict)
def get_alert_summary(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get alert statistics summary."""
    user_id = int(current_user["user_id"])
    
    # Count by severity
    critical = db.query(Alert).filter(
        Alert.user_id == user_id,
        Alert.severity == "CRITICAL",
        Alert.is_read == False
    ).count()
    
    high = db.query(Alert).filter(
        Alert.user_id == user_id,
        Alert.severity == "HIGH",
        Alert.is_read == False
    ).count()
    
    medium = db.query(Alert).filter(
        Alert.user_id == user_id,
        Alert.severity == "MEDIUM",
        Alert.is_read == False
    ).count()
    
    total_unread = critical + high + medium
    
    return {
        "critical": critical,
        "high": high,
        "medium": medium,
        "total_unread": total_unread
    }
