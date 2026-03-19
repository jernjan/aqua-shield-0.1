"""
FastAPI Backend - Kyst Monitor

Main API server with endpoints for:
- Facility risk data
- Alert management
- Data export
- Dashboard access
"""

from fastapi import FastAPI, HTTPException, Query, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import logging
from typing import List, Optional
from datetime import datetime, timedelta
import csv
import io

from src.database.connection import SessionLocal
from src.database.models import (
    Facility,
    RiskAssessment,
    Alert,
    HealthStatus,
    VesselVisit,
    User,
)
from src.sync.scheduler import DataSyncScheduler

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="Kyst Monitor API",
    description="Real-time aquaculture monitoring system",
    version="1.0.0",
)

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # TODO: Restrict to frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize scheduler
scheduler = DataSyncScheduler()


def get_db():
    """Dependency for database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ============================================================================
# HEALTH CHECK
# ============================================================================


@app.get("/health")
def health_check():
    """Health check endpoint."""
    return {
        "status": "ok",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.0",
    }


# ============================================================================
# FACILITIES ENDPOINTS
# ============================================================================


@app.get("/api/facilities")
def get_facilities(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    municipality: Optional[str] = None,
    risk_level: Optional[str] = Query(None, pattern="^(RED|YELLOW|GREEN)$"),
    db=Depends(get_db),
):
    """
    Get all facilities with current risk scores.

    Query parameters:
    - skip: Number of records to skip (pagination)
    - limit: Number of records to return (max 100)
    - municipality: Filter by municipality
    - risk_level: Filter by risk level (RED, YELLOW, GREEN)
    """
    try:
        query = db.query(Facility)

        if municipality:
            query = query.filter(Facility.municipality.ilike(f"%{municipality}%"))

        facilities = query.offset(skip).limit(limit).all()

        result = []
        for facility in facilities:
            # Get latest risk assessment
            risk = (
                db.query(RiskAssessment)
                .filter(RiskAssessment.facility_id == facility.id)
                .order_by(RiskAssessment.assessment_date.desc())
                .first()
            )

            # Get latest health status
            health = (
                db.query(HealthStatus)
                .filter(HealthStatus.facility_id == facility.id)
                .order_by(HealthStatus.reported_date.desc())
                .first()
            )

            facility_data = {
                "id": facility.id,
                "locality_no": facility.locality_no,
                "name": facility.name,
                "municipality": facility.municipality,
                "species": facility.species,
                "latitude": facility.latitude,
                "longitude": facility.longitude,
                "production_status": facility.production_status,
                "risk": {
                    "score": risk.total_risk_score if risk else 0,
                    "level": risk.risk_level if risk else "GREEN",
                    "assessment_date": risk.assessment_date.isoformat() if risk else None,
                },
                "health": {
                    "lice_count": health.lice_count if health else 0,
                    "disease": health.disease_name if health else None,
                    "reported_date": health.reported_date.isoformat() if health else None,
                },
            }

            # Apply risk level filter
            if risk_level and facility_data["risk"]["level"] != risk_level:
                continue

            result.append(facility_data)

        return {
            "count": len(result),
            "skip": skip,
            "limit": limit,
            "facilities": result,
        }

    except Exception as e:
        logger.error(f"Error fetching facilities: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/facilities/{facility_id}")
def get_facility_detail(facility_id: int, db=Depends(get_db)):
    """Get detailed information for a specific facility."""
    try:
        facility = db.query(Facility).filter(Facility.id == facility_id).first()
        if not facility:
            raise HTTPException(status_code=404, detail="Facility not found")

        # Get risk assessment
        risk = (
            db.query(RiskAssessment)
            .filter(RiskAssessment.facility_id == facility.id)
            .order_by(RiskAssessment.assessment_date.desc())
            .first()
        )

        # Get health history (last 12 weeks)
        health_history = (
            db.query(HealthStatus)
            .filter(HealthStatus.facility_id == facility.id)
            .order_by(HealthStatus.reported_date.desc())
            .limit(12)
            .all()
        )

        # Get recent vessel visits
        recent_visits = (
            db.query(VesselVisit)
            .filter(VesselVisit.facility_id == facility.id)
            .order_by(VesselVisit.visit_date.desc())
            .limit(10)
            .all()
        )

        # Get active alerts
        active_alerts = (
            db.query(Alert)
            .filter(Alert.facility_id == facility.id, Alert.acknowledged == False)
            .order_by(Alert.alert_date.desc())
            .all()
        )

        return {
            "id": facility.id,
            "locality_no": facility.locality_no,
            "name": facility.name,
            "municipality": facility.municipality,
            "species": facility.species,
            "latitude": facility.latitude,
            "longitude": facility.longitude,
            "production_status": facility.production_status,
            "risk_assessment": {
                "total_score": risk.total_risk_score if risk else 0,
                "alert_level": risk.risk_level if risk else "GREEN",
                "factors": {
                    "ocean_current": risk.ocean_current_risk if risk else 0,
                    "vessel_movement": risk.vessel_movement_risk if risk else 0,
                    "genetic_disease": risk.genetic_disease_risk if risk else 0,
                    "temperature": risk.temperature_risk if risk else 0,
                },
                "assessment_date": risk.assessment_date.isoformat() if risk else None,
            },
            "health_history": [
                {
                    "week": h.week,
                    "year": h.year,
                    "salmon_lice_count": h.salmon_lice_count,
                    "pd_status": h.pd_status,
                    "isa_status": h.isa_status,
                    "lice_treatment_applied": h.lice_treatment_applied,
                    "reported_date": h.reported_date.isoformat(),
                }
                for h in health_history
            ],
            "recent_vessel_visits": [
                {
                    "vessel_id": v.vessel_id,
                    "visit_date": v.visit_date.isoformat(),
                    "source_facility_id": v.source_facility_id,
                }
                for v in recent_visits
            ],
            "active_alerts": [
                {
                    "id": a.id,
                    "type": a.alert_type,
                    "severity": a.severity,
                    "message": a.message,
                    "alert_date": a.alert_date.isoformat(),
                }
                for a in active_alerts
            ],
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching facility detail: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# ALERTS ENDPOINTS
# ============================================================================


@app.get("/api/alerts")
def get_alerts(
    severity: Optional[str] = Query(None, pattern="^(CRITICAL|HIGH|MEDIUM|LOW)$"),
    alert_type: Optional[str] = None,
    acknowledged: Optional[bool] = None,
    limit: int = Query(50, ge=1, le=500),
    db=Depends(get_db),
):
    """Get all active alerts, sorted by severity."""
    try:
        query = db.query(Alert)

        if severity:
            query = query.filter(Alert.severity == severity)

        if alert_type:
            query = query.filter(Alert.alert_type == alert_type)

        if acknowledged is not None:
            query = query.filter(Alert.acknowledged == acknowledged)

        alerts = (
            query.order_by(Alert.severity.desc(), Alert.alert_date.desc())
            .limit(limit)
            .all()
        )

        return {
            "count": len(alerts),
            "alerts": [
                {
                    "id": a.id,
                    "facility_id": a.facility_id,
                    "type": a.alert_type,
                    "severity": a.severity,
                    "message": a.message,
                    "alert_date": a.alert_date.isoformat(),
                    "acknowledged": a.acknowledged,
                }
                for a in alerts
            ],
        }

    except Exception as e:
        logger.error(f"Error fetching alerts: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/alerts/{alert_id}/acknowledge")
def acknowledge_alert(alert_id: int, db=Depends(get_db)):
    """Acknowledge an alert."""
    try:
        alert = db.query(Alert).filter(Alert.id == alert_id).first()
        if not alert:
            raise HTTPException(status_code=404, detail="Alert not found")

        alert.acknowledged = True
        db.commit()

        return {"status": "acknowledged", "alert_id": alert_id}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error acknowledging alert: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# RISK HISTORY ENDPOINTS
# ============================================================================


@app.get("/api/facilities/{facility_id}/risk-history")
def get_risk_history(
    facility_id: int, weeks: int = Query(12, ge=1, le=52), db=Depends(get_db)
):
    """Get risk history for a facility."""
    try:
        facility = db.query(Facility).filter(Facility.id == facility_id).first()
        if not facility:
            raise HTTPException(status_code=404, detail="Facility not found")

        risk_history = (
            db.query(RiskAssessment)
            .filter(RiskAssessment.facility_id == facility.id)
            .order_by(RiskAssessment.assessment_date.desc())
            .limit(weeks)
            .all()
        )

        return {
            "facility_id": facility_id,
            "facility_name": facility.name,
            "history": [
                {
                    "date": r.assessment_date.isoformat(),
                    "score": r.total_risk_score,
                    "level": r.risk_level,
                    "factors": {
                        "ocean_current": r.ocean_current_risk,
                        "vessel_movement": r.vessel_movement_risk,
                        "genetic_disease": r.genetic_disease_risk,
                        "temperature": r.temperature_risk,
                    },
                }
                for r in risk_history
            ],
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching risk history: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# DATA EXPORT ENDPOINTS
# ============================================================================


@app.get("/api/export/facilities")
def export_facilities(db=Depends(get_db)):
    """Export all facility data as CSV."""
    try:
        facilities = db.query(Facility).all()

        output = io.StringIO()
        writer = csv.writer(output)

        # Header
        writer.writerow(
            [
                "Locality No",
                "Name",
                "Municipality",
                "Species",
                "Latitude",
                "Longitude",
                "Status",
            ]
        )

        # Data
        for f in facilities:
            writer.writerow(
                [
                    f.locality_no,
                    f.name,
                    f.municipality,
                    f.species,
                    f.latitude,
                    f.longitude,
                    f.status,
                ]
            )

        return {
            "data": output.getvalue(),
            "filename": f"facilities_{datetime.utcnow().strftime('%Y%m%d')}.csv",
        }

    except Exception as e:
        logger.error(f"Error exporting facilities: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/export/risk-assessments")
def export_risk_assessments(
    weeks: int = Query(12, ge=1, le=52), db=Depends(get_db)
):
    """Export risk assessments for research."""
    try:
        cutoff_date = datetime.utcnow() - timedelta(weeks=weeks)
        assessments = (
            db.query(RiskAssessment)
            .filter(RiskAssessment.assessment_date >= cutoff_date)
            .all()
        )

        output = io.StringIO()
        writer = csv.writer(output)

        # Header
        writer.writerow(
            [
                "Facility ID",
                "Risk Score",
                "Alert Level",
                "Ocean Current",
                "Vessel Movement",
                "Genetic Disease",
                "Temperature",
                "Assessment Date",
            ]
        )

        # Data
        for r in assessments:
            writer.writerow(
                [
                    r.facility_id,
                    r.total_risk_score,
                    r.risk_level,
                    r.ocean_current_risk,
                    r.vessel_movement_risk,
                    r.genetic_disease_risk,
                    r.temperature_risk,
                    r.assessment_date.isoformat(),
                ]
            )

        return {
            "data": output.getvalue(),
            "filename": f"risk_assessments_{weeks}w_{datetime.utcnow().strftime('%Y%m%d')}.csv",
        }

    except Exception as e:
        logger.error(f"Error exporting risk assessments: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# SYNC ENDPOINTS (Admin only)
# ============================================================================


@app.post("/api/sync/now")
def trigger_sync():
    """
    Trigger immediate data sync (for testing/admin).
    WARNING: In production, add authentication!
    """
    try:
        logger.info("Manual sync triggered")

        # Run sync in background (for production, use Celery/RQ)
        import asyncio

        asyncio.run(scheduler.run_daily_sync())

        return {
            "status": "sync_started",
            "timestamp": datetime.utcnow().isoformat(),
        }

    except Exception as e:
        logger.error(f"Error during manual sync: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# DASHBOARD SUMMARY
# ============================================================================


@app.get("/api/dashboard/summary")
def get_dashboard_summary(db=Depends(get_db)):
    """Get dashboard summary - counts by risk level and alerts."""
    try:
        # Count facilities by risk level
        total_facilities = db.query(Facility).count()

        red_facilities = (
            db.query(RiskAssessment)
            .filter(RiskAssessment.risk_level == "RED")
            .count()
        )
        yellow_facilities = (
            db.query(RiskAssessment)
            .filter(RiskAssessment.risk_level == "YELLOW")
            .count()
        )
        green_facilities = total_facilities - red_facilities - yellow_facilities

        # Count active alerts by severity
        critical_alerts = (
            db.query(Alert)
            .filter(Alert.severity == "CRITICAL", Alert.acknowledged == False)
            .count()
        )
        high_alerts = (
            db.query(Alert)
            .filter(Alert.severity == "HIGH", Alert.acknowledged == False)
            .count()
        )

        # Top 5 highest risk facilities
        top_risks = (
            db.query(Facility, RiskAssessment)
            .join(RiskAssessment)
            .order_by(RiskAssessment.total_risk_score.desc())
            .limit(5)
            .all()
        )

        return {
            "facilities": {
                "total": total_facilities,
                "red": red_facilities,
                "yellow": yellow_facilities,
                "green": green_facilities,
            },
            "alerts": {
                "critical": critical_alerts,
                "high": high_alerts,
            },
            "top_risks": [
                {
                    "facility_id": f.id,
                    "name": f.name,
                    "municipality": f.municipality,
                    "risk_score": r.total_risk_score,
                    "risk_level": r.risk_level,
                }
                for f, r in top_risks
            ],
            "last_sync": datetime.utcnow().isoformat(),
        }

    except Exception as e:
        logger.error(f"Error fetching dashboard summary: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
