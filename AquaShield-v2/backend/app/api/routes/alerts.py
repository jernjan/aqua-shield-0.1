"""Alert routes"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.schemas.alert import AlertResponse, AlertUpdate
from app.models.alert import Alert, AlertLevel
from app.db.database import get_db
from app.utils.logger import logger

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("", response_model=List[AlertResponse])
def get_alerts(
    skip: int = 0,
    limit: int = 50,
    unread_only: bool = False,
    db: Session = Depends(get_db),
):
    """Get alerts for current user"""
    query = db.query(Alert)
    
    if unread_only:
        query = query.filter(Alert.is_read == False)
    
    alerts = query.order_by(Alert.created_at.desc()).offset(skip).limit(limit).all()
    return alerts


@router.get("/{alert_id}", response_model=AlertResponse)
def get_alert(alert_id: int, db: Session = Depends(get_db)):
    """Get single alert"""
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alert not found",
        )
    
    return alert


@router.put("/{alert_id}", response_model=AlertResponse)
def update_alert(
    alert_id: int,
    alert_update: AlertUpdate,
    db: Session = Depends(get_db),
):
    """Update alert (mark as read, acknowledged)"""
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alert not found",
        )
    
    if alert_update.is_read is not None:
        alert.is_read = alert_update.is_read
    
    if alert_update.is_acknowledged is not None:
        alert.is_acknowledged = alert_update.is_acknowledged
    
    db.commit()
    db.refresh(alert)
    
    logger.info(f"Alert updated: {alert_id}")
    return alert


@router.delete("/{alert_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_alert(alert_id: int, db: Session = Depends(get_db)):
    """Delete alert"""
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alert not found",
        )
    
    db.delete(alert)
    db.commit()
    
    logger.info(f"Alert deleted: {alert_id}")
