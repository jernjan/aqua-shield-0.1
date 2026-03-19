"""Scheduled background tasks for data analysis."""
import asyncio
from datetime import datetime
from sqlalchemy.orm import Session
from app.db.database import SessionLocal, engine
from app.db.models import Base, Farm, Alert, RiskAssessment, User
from app.services.risk_assessment_service import RiskAssessmentService
from app.core.config import settings
from app.logging.logger import logger


# Create tables on startup
Base.metadata.create_all(bind=engine)


async def nightly_risk_analysis():
    """Run comprehensive risk analysis for all farms every night."""
    if not settings.ENABLE_SCHEDULED_TASKS:
        return
    
    logger.info("Starting nightly risk analysis")
    db = SessionLocal()
    risk_service = RiskAssessmentService()
    
    try:
        # Get all active farms
        farms = db.query(Farm).filter(Farm.is_active == True).all()
        logger.info(f"Running analysis for {len(farms)} farms")
        
        for farm in farms:
            try:
                # Perform risk assessment
                risk_level, scores = await risk_service.assess_farm_risk(db, farm)
                
                # Save assessment
                assessment = await risk_service.save_assessment(
                    db, farm, risk_level, scores
                )
                
                # Create alerts if risk level changed or is critical
                create_alerts_for_assessment(db, farm, assessment)
                
                logger.info(f"Analysis completed for farm {farm.id}: {risk_level}")
                
            except Exception as e:
                logger.error(f"Error analyzing farm {farm.id}: {str(e)}")
                continue
        
        logger.info("Nightly risk analysis completed")
        
    except Exception as e:
        logger.error(f"Error in nightly analysis: {str(e)}")
    
    finally:
        db.close()


def create_alerts_for_assessment(
    db: Session,
    farm: Farm,
    assessment: RiskAssessment
):
    """Create alerts based on risk assessment results."""
    severity_map = {
        "CRITICAL": "CRITICAL",
        "HIGH": "HIGH",
        "MEDIUM": "MEDIUM",
        "LOW": "LOW"
    }
    
    # Check if previous assessment exists
    previous = db.query(RiskAssessment).filter(
        RiskAssessment.farm_id == farm.id,
        RiskAssessment.id != assessment.id
    ).order_by(RiskAssessment.created_at.desc()).first()
    
    risk_changed = previous and previous.risk_level != assessment.risk_level
    is_high_risk = assessment.risk_level in ["HIGH", "CRITICAL"]
    
    if is_high_risk or risk_changed:
        # Get farm owner
        owner = db.query(User).filter(User.id == farm.owner_id).first()
        
        if not owner:
            return
        
        # Create alert
        alert_type = "RISK_LEVEL_CHANGE" if risk_changed else "HIGH_RISK_DETECTED"
        severity = severity_map.get(assessment.risk_level, "MEDIUM")
        
        alert = Alert(
            user_id=owner.id,
            farm_id=farm.id,
            alert_type=alert_type,
            severity=severity,
            title=f"{assessment.risk_level} Risk Level for {farm.name}",
            message=f"Risk assessment for {farm.name} shows {assessment.risk_level} risk. "
                   f"Disease: {assessment.disease_risk:.1%}, "
                   f"Sea Lice: {assessment.sea_lice_risk:.1%}, "
                   f"Water Quality: {assessment.water_quality_risk:.1%}, "
                   f"Escape: {assessment.escape_risk:.1%}"
        )
        
        db.add(alert)
        db.commit()
        
        logger.info(f"Alert created for farm {farm.id}: {severity}")


async def periodic_data_sync():
    """Sync data from external APIs periodically."""
    logger.info("Starting periodic data sync")
    
    try:
        # This would be called at regular intervals to keep data fresh
        await nightly_risk_analysis()
        
    except Exception as e:
        logger.error(f"Error in periodic sync: {str(e)}")


def schedule_tasks():
    """Initialize task scheduling."""
    import schedule
    
    if not settings.ENABLE_SCHEDULED_TASKS:
        logger.info("Scheduled tasks are disabled")
        return
    
    # Schedule nightly analysis
    schedule.every().day.at(f"{settings.NIGHTLY_ANALYSIS_HOUR:02d}:00").do(
        lambda: asyncio.run(nightly_risk_analysis())
    )
    
    logger.info(f"Tasks scheduled - nightly analysis at {settings.NIGHTLY_ANALYSIS_HOUR}:00")
    
    # Run scheduler in background
    import threading
    
    def run_scheduler():
        while True:
            schedule.run_pending()
            import time
            time.sleep(60)
    
    scheduler_thread = threading.Thread(target=run_scheduler, daemon=True)
    scheduler_thread.start()
