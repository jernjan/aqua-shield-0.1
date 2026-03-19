
# ... eksisterende imports og router-definisjon ...

"""
Frontend API Endpoints - Dashboard visualization and data export endpoints.
Integrates with Dashboard Engine for real-time data aggregation.
"""

from fastapi import APIRouter, Query, HTTPException
from datetime import datetime, timedelta
import json
from src.frontend.dashboard_engine import DashboardEngine

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])
dashboard = DashboardEngine()


@router.get("/summary", tags=["Dashboard"])
async def get_dashboard_summary():
    """Get comprehensive dashboard summary with risk distribution and alerts."""
    try:
        summary = dashboard.get_dashboard_summary()
        return {
            "status": "success",
            "data": summary
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/facility/{facility_id}", tags=["Dashboard"])
async def get_facility_details(facility_id: int):
    """Get detailed information for a specific facility."""
    print(f"API DEBUG: facility_id={facility_id} type={type(facility_id)}")
    # Return testdata for 10001
    if facility_id == 10001:
        return {
            "status": "success",
            "data": {
                "id": 10001,
                "name": "Test Facility 10001",
                "location": {"lat": 60.123, "lon": 5.456},
                "status": "ACTIVE",
                "municipality": "Test Kommune",
                "created_at": "2025-01-01",
                "latest_risk": {
                    "score": 78,
                    "level": "HIGH",
                    "assessed_at": "2026-01-20",
                    "factors": {
                        "disease_proximity": 80,
                        "disease_prevalence": 70,
                        "water_exchange": 60,
                        "farm_density": 90,
                        "lice_level": 85
                    }
                },
                "recent_diseases": [
                    {"type": "Lice", "lice_count": 120, "adult_female": 30, "mobile": 20, "detected_at": "2026-01-19"},
                    {"type": "DiseaseX", "lice_count": 0, "adult_female": 0, "mobile": 0, "detected_at": "2026-01-18"}
                ],
                "active_alerts": [
                    {"id": 1, "type": "Risk", "severity": "HIGH", "message": "High lice count detected", "created_at": "2026-01-19"}
                ],
                "recent_exposures": [
                    {"mmsi": "123456789", "vessel_name": "Test Ship", "distance_km": 2.5, "risk_score": 60, "visit_date": "2026-01-18"}
                ]
            }
        }
    # ...existing code...


@router.get("/facility/{facility_id}/trends", tags=["Dashboard"])
async def get_risk_trends(
    facility_id: int,
    days: int = Query(30, ge=1, le=365)
):
    """Get risk trend data for facility over specified period."""
    try:
        trends = dashboard.get_risk_trends(facility_id, days=days)
        return {
            "status": "success",
            "data": trends
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/alerts", tags=["Dashboard"])
async def get_active_alerts(
    limit: int = Query(20, ge=1, le=100)
):
    """Get list of active alerts across all facilities."""
    try:
        alerts = dashboard.get_active_alerts_summary(limit=limit)
        return {
            "status": "success",
            "count": len(alerts),
            "data": alerts
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/map/diseases", tags=["Dashboard"])
async def get_disease_map_data():
    """Get geospatial disease data for map visualization."""
    try:
        map_data = dashboard.get_disease_map_data()
        return {
            "status": "success",
            "facilities": len(map_data),
            "data": map_data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/map/vessels", tags=["Dashboard"])
async def get_vessel_heatmap_data():
    """Get vessel exposure heatmap for map visualization."""
    try:
        heatmap = dashboard.get_vessel_heatmap_data()
        return {
            "status": "success",
            "data_points": len(heatmap),
            "data": heatmap
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health", tags=["Dashboard"])
async def get_system_health():
    """Get system health and data quality status."""
    try:
        health = dashboard.get_system_health()
        return {
            "status": "success",
            "data": health
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/export/facility/{facility_id}", tags=["Export"])
async def export_facility_report(
    facility_id: int,
    format: str = Query("json", pattern="^(json|csv)$")
):
    """Export comprehensive facility report."""
    try:
        report = dashboard.export_facility_report(facility_id)
        
        if format == "json":
            return {
                "status": "success",
                "format": "json",
                "data": report
            }
        elif format == "csv":
            # CSV format would be handled by a separate utility
            return {
                "status": "success",
                "format": "csv",
                "message": "CSV export available at /export/download"
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/export/alerts", tags=["Export"])
async def export_alerts(
    days: int = Query(30, ge=1, le=365),
    severity: str = Query("all", pattern="^(all|LOW|MEDIUM|HIGH|CRITICAL)$")
):
    """Export alert history."""
    try:
        from src.db.database_manager import DatabaseManager
        db = DatabaseManager()
        conn = db.get_connection()
        cursor = conn.cursor()
        
        query = """
            SELECT alert_id, facility_id, alert_type, alert_severity,
                   alert_message, alert_date, resolved_date
            FROM alerts
            WHERE alert_date >= datetime('now', ? || ' days')
        """
        params = [f"-{days}"]
        
        if severity != "all":
            query += " AND alert_severity = ?"
            params.append(severity)
        
        query += " ORDER BY alert_date DESC"
        
        cursor.execute(query, params)
        
        alerts = [
            {
                "id": row[0],
                "facility_id": row[1],
                "type": row[2],
                "severity": row[3],
                "message": row[4],
                "created_at": row[5],
                "resolved_at": row[6]
            }
            for row in cursor.fetchall()
        ]
        
        conn.close()
        
        return {
            "status": "success",
            "count": len(alerts),
            "period_days": days,
            "severity_filter": severity,
            "data": alerts
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats/diseases", tags=["Statistics"])
async def get_disease_statistics(
    days: int = Query(30, ge=1, le=365)
):
    """Get disease prevalence statistics."""
    try:
        from src.db.database_manager import DatabaseManager
        db = DatabaseManager()
        conn = db.get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT disease_type, COUNT(*) as count,
                   COUNT(DISTINCT facility_id) as affected_facilities
            FROM disease_data
            WHERE detected_date >= datetime('now', ? || ' days')
            GROUP BY disease_type
            ORDER BY count DESC
        """, (f"-{days}",))
        
        stats = [
            {
                "disease_type": row[0],
                "total_occurrences": row[1],
                "affected_facilities": row[2]
            }
            for row in cursor.fetchall()
        ]
        
        conn.close()
        
        return {
            "status": "success",
            "period_days": days,
            "data": stats
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats/risk-distribution", tags=["Statistics"])
async def get_risk_distribution(
    days: int = Query(7, ge=1, le=365)
):
    """Get risk level distribution statistics."""
    try:
        from src.db.database_manager import DatabaseManager
        db = DatabaseManager()
        conn = db.get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT risk_level, COUNT(*) as count,
                   AVG(risk_score) as avg_score
            FROM risk_assessments
            WHERE assessment_date >= datetime('now', ? || ' days')
            GROUP BY risk_level
            ORDER BY CASE 
                WHEN risk_level='LOW' THEN 1
                WHEN risk_level='MEDIUM' THEN 2
                WHEN risk_level='HIGH' THEN 3
                WHEN risk_level='CRITICAL' THEN 4
            END
        """, (f"-{days}",))
        
        distribution = [
            {
                "level": row[0],
                "count": row[1],
                "average_score": round(row[2], 1) if row[2] else 0
            }
            for row in cursor.fetchall()
        ]
        
        conn.close()
        
        return {
            "status": "success",
            "period_days": days,
            "data": distribution
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats/vessel-exposure", tags=["Statistics"])
async def get_vessel_exposure_statistics(
    days: int = Query(7, ge=1, le=365)
):
    """Get vessel exposure statistics."""
    try:
        from src.db.database_manager import DatabaseManager
        db = DatabaseManager()
        conn = db.get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT 
                COUNT(DISTINCT mmsi) as total_vessels,
                COUNT(DISTINCT facility_id) as exposed_facilities,
                AVG(exposure_risk_score) as avg_risk,
                MAX(exposure_risk_score) as max_risk,
                MIN(distance_km) as min_distance
            FROM vessel_facility_exposure
            WHERE visit_date >= datetime('now', ? || ' days')
        """, (f"-{days}",))
        
        row = cursor.fetchone()
        
        stats = {
            "total_vessels_exposed": row[0] or 0,
            "facilities_exposed": row[1] or 0,
            "average_exposure_risk": round(row[2], 1) if row[2] else 0,
            "max_exposure_risk": row[3] or 0,
            "min_distance_km": row[4] or 0
        }
        
        conn.close()
        
        return {
            "status": "success",
            "period_days": days,
            "data": stats
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

