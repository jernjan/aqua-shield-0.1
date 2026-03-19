"""
Frontend Dashboard Engine - Real-time visualization and analytics for KystMonitor.
Provides aggregated data, trends, and alerts for the web dashboard.
"""

from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
import json
from src.db.database_manager import DatabaseManager
from src.db.persistence_layer import (
    RiskAssessmentStorage, AlertingSystem, SystemLogging, DataQualityMonitor
)


class DashboardEngine:
    """Central dashboard data aggregation engine."""
    
    def __init__(self, db_manager: DatabaseManager = None):
        """Initialize dashboard engine with database access."""
        self.db = db_manager or DatabaseManager()
        self.risk_storage = RiskAssessmentStorage(self.db)
        self.alert_system = AlertingSystem(self.db)
        self.sys_logger = SystemLogging(self.db)
        self.data_quality = DataQualityMonitor(self.db)
    
    def get_dashboard_summary(self) -> Dict[str, Any]:
        """Get comprehensive dashboard summary."""
        conn = self.db.get_connection()
        cursor = conn.cursor()
        
        try:
            # Get facility count
            cursor.execute("SELECT COUNT(*) FROM facilities WHERE production_status='Active'")
            active_facilities = cursor.fetchone()[0]
            
            # Get risk distribution
            cursor.execute("""
                SELECT risk_level, COUNT(*) as count FROM risk_assessments
                WHERE assessment_date >= datetime('now', '-1 day')
                GROUP BY risk_level
            """)
            risk_distribution = {row[0]: row[1] for row in cursor.fetchall()}
            
            # Get alert stats
            cursor.execute("SELECT COUNT(*) FROM alerts WHERE resolved=0")
            active_alerts = cursor.fetchone()[0]
            
            cursor.execute("SELECT COUNT(*) FROM alerts WHERE resolved=1 AND resolved_date >= datetime('now', '-1 day')")
            resolved_today = cursor.fetchone()[0]
            
            # Get disease prevalence
            cursor.execute("""
                SELECT disease_type, COUNT(*) as count FROM disease_data
                WHERE detected_date >= datetime('now', '-30 days')
                GROUP BY disease_type
            """)
            disease_stats = {row[0]: row[1] for row in cursor.fetchall()}
            
            # Get vessel exposure data
            cursor.execute("""
                SELECT COUNT(DISTINCT mmsi) FROM vessel_positions
                WHERE position_time >= datetime('now', '-24 hours')
            """)
            vessels_monitored = cursor.fetchone()[0]
            
            cursor.execute("""
                SELECT COUNT(DISTINCT mmsi) FROM vessel_facility_exposure
                WHERE visit_date >= datetime('now', '-7 days')
                AND exposure_risk_score > 50
            """)
            vessels_at_risk = cursor.fetchone()[0]
            
            summary = {
                "timestamp": datetime.now().isoformat(),
                "facilities": {
                    "active": active_facilities,
                    "monitored": active_facilities
                },
                "risk_distribution": risk_distribution or {
                    "LOW": 0, "MEDIUM": 0, "HIGH": 0, "CRITICAL": 0
                },
                "alerts": {
                    "active": active_alerts,
                    "resolved_today": resolved_today
                },
                "diseases": disease_stats or {},
                "vessels": {
                    "monitored": vessels_monitored,
                    "at_risk": vessels_at_risk
                }
            }
            
            return summary
        finally:
            conn.close()
    
    def get_facility_details(self, facility_id: int) -> Dict[str, Any]:
        """Get detailed information for a specific facility."""
        # Hent alltid fra database, ingen mock/testdata
        conn = self.db.get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("""
                SELECT f.facility_id, f.facility_name, f.latitude, f.longitude, f.status, f.municipality, f.created_at
                FROM facilities f
                WHERE f.facility_id = ?
            """, (facility_id,))
            row = cursor.fetchone()
            if not row:
                return {}
            facility = {
                "id": row[0],
                "name": row[1],
                "location": {"lat": row[2], "lon": row[3]},
                "status": row[4],
                "municipality": row[5],
                "created_at": row[6]
            }
            # Hent siste risiko
            cursor.execute("""
                SELECT risk_score, risk_level, assessment_date, disease_proximity, disease_prevalence, water_exchange, farm_density, lice_level
                FROM risk_assessments
                WHERE facility_id = ?
                ORDER BY assessment_date DESC LIMIT 1
            """, (facility_id,))
            risk_row = cursor.fetchone()
            if risk_row:
                facility["latest_risk"] = {
                    "score": risk_row[0],
                    "level": risk_row[1],
                    "assessed_at": risk_row[2],
                    "factors": {
                        "disease_proximity": risk_row[3],
                        "disease_prevalence": risk_row[4],
                        "water_exchange": risk_row[5],
                        "farm_density": risk_row[6],
                        "lice_level": risk_row[7]
                    }
                }
            # Hent sykdommer
            cursor.execute("""
                SELECT disease_type, lice_count, adult_female, mobile, detected_date
                FROM disease_data
                WHERE facility_id = ?
                ORDER BY detected_date DESC LIMIT 5
            """, (facility_id,))
            facility["recent_diseases"] = [
                {
                    "type": d[0], "lice_count": d[1], "adult_female": d[2], "mobile": d[3], "detected_at": d[4]
                } for d in cursor.fetchall()
            ]
            # Hent aktive varsler
            cursor.execute("""
                SELECT alert_id, alert_type, alert_severity, alert_message, alert_date
                FROM alerts
                WHERE facility_id = ? AND resolved = 0
                ORDER BY alert_date DESC LIMIT 5
            """, (facility_id,))
            facility["active_alerts"] = [
                {
                    "id": a[0], "type": a[1], "severity": a[2], "message": a[3], "created_at": a[4]
                } for a in cursor.fetchall()
            ]
            # Hent eksponeringer
            cursor.execute("""
                SELECT mmsi, vessel_name, distance_km, risk_score, visit_date
                FROM vessel_facility_exposure
                WHERE facility_id = ?
                ORDER BY visit_date DESC LIMIT 5
            """, (facility_id,))
            facility["recent_exposures"] = [
                {
                    "mmsi": e[0], "vessel_name": e[1], "distance_km": e[2], "risk_score": e[3], "visit_date": e[4]
                } for e in cursor.fetchall()
            ]
            return facility
        finally:
            conn.close()
    
    def get_risk_trends(self, facility_id: int, days: int = 30) -> Dict[str, Any]:
        """Get risk trend data for a facility over time."""
        conn = self.db.get_connection()
        cursor = conn.cursor()
        
        try:
            cutoff_date = (datetime.now() - timedelta(days=days)).isoformat()
            
            cursor.execute("""
                SELECT assessment_date, risk_score, risk_level
                FROM risk_assessments
                WHERE facility_id = ? AND assessment_date >= ?
                ORDER BY assessment_date ASC
            """, (facility_id, cutoff_date))
            
            trend_data = [
                {
                    "date": row[0],
                    "score": row[1],
                    "level": row[2]
                }
                for row in cursor.fetchall()
            ]
            
            # Calculate statistics
            if trend_data:
                scores = [t["score"] for t in trend_data]
                avg_score = sum(scores) / len(scores)
                max_score = max(scores)
                min_score = min(scores)
                
                stats = {
                    "average": round(avg_score, 1),
                    "maximum": max_score,
                    "minimum": min_score,
                    "trend": "increasing" if scores[-1] > scores[0] else "decreasing"
                }
            else:
                stats = {"average": 0, "maximum": 0, "minimum": 0, "trend": "stable"}
            
            return {
                "facility_id": facility_id,
                "period_days": days,
                "data_points": len(trend_data),
                "trend_data": trend_data,
                "statistics": stats
            }
        finally:
            conn.close()
    
    def get_active_alerts_summary(self, limit: int = 20) -> List[Dict[str, Any]]:
        """Get list of active alerts across all facilities."""
        conn = self.db.get_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute("""
                SELECT a.alert_id, a.facility_id, a.alert_type, a.alert_severity,
                       a.alert_message, a.alert_date, f.facility_name
                FROM alerts a
                JOIN facilities f ON a.facility_id = f.facility_id
                WHERE a.resolved = 0
                ORDER BY a.alert_severity DESC, a.alert_date DESC
                LIMIT ?
            """, (limit,))
            
            alerts = [
                {
                    "id": row[0],
                    "facility_id": row[1],
                    "facility_name": row[6],
                    "type": row[2],
                    "severity": row[3],
                    "message": row[4],
                    "created_at": row[5]
                }
                for row in cursor.fetchall()
            ]
            
            return alerts
        finally:
            conn.close()
    
    def get_disease_map_data(self) -> List[Dict[str, Any]]:
        """Get geospatial disease data for map visualization."""
        conn = self.db.get_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute("""
                SELECT f.facility_id, f.facility_name, f.latitude, f.longitude,
                       d.disease_type, d.lice_count, d.detected_date,
                       r.risk_score, r.risk_level
                FROM facilities f
                LEFT JOIN disease_data d ON f.facility_id = d.facility_id
                  AND d.detected_date >= datetime('now', '-30 days')
                LEFT JOIN risk_assessments r ON f.facility_id = r.facility_id
                  AND r.assessment_date >= datetime('now', '-1 day')
                WHERE f.production_status = 'Active'
                ORDER BY f.facility_id
            """)
            
            facilities_map = {}
            for row in cursor.fetchall():
                fac_id = row[0]
                if fac_id not in facilities_map:
                    facilities_map[fac_id] = {
                        "id": row[0],
                        "name": row[1],
                        "location": {"lat": row[2], "lon": row[3]},
                        "diseases": [],
                        "risk_score": row[7],
                        "risk_level": row[8]
                    }
                
                if row[4]:  # If disease exists
                    facilities_map[fac_id]["diseases"].append({
                        "type": row[4],
                        "lice_count": row[5],
                        "detected_date": row[6]
                    })
            
            return list(facilities_map.values())
        finally:
            conn.close()
    
    def get_vessel_heatmap_data(self) -> List[Dict[str, Any]]:
        """Get vessel exposure heatmap data."""
        conn = self.db.get_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute("""
                SELECT latitude, longitude, COUNT(*) as vessel_count,
                       AVG(exposure_risk_score) as avg_risk
                FROM (
                    SELECT vp.latitude, vp.longitude, vfe.exposure_risk_score
                    FROM vessel_positions vp
                    LEFT JOIN vessel_facility_exposure vfe 
                      ON vp.mmsi = vfe.mmsi
                      AND vp.position_time >= datetime('now', '-24 hours')
                )
                GROUP BY latitude, longitude
                ORDER BY vessel_count DESC
            """)
            
            heatmap_data = [
                {
                    "lat": row[0],
                    "lon": row[1],
                    "vessel_count": row[2],
                    "avg_risk": row[3]
                }
                for row in cursor.fetchall()
            ]
            
            return heatmap_data
        finally:
            conn.close()
    
    def get_system_health(self) -> Dict[str, Any]:
        """Get overall system health and data quality status."""
        conn = self.db.get_connection()
        cursor = conn.cursor()
        
        try:
            # Get API health stats
            cursor.execute("""
                SELECT data_source, api_available, average_response_time_ms,
                       error_count, check_date
                FROM data_quality
                ORDER BY check_date DESC
                LIMIT 10
            """)
            
            api_health = {}
            for row in cursor.fetchall():
                source = row[0]
                if source not in api_health or row[4] > api_health[source]["last_check"]:
                    api_health[source] = {
                        "available": bool(row[1]),
                        "response_time_ms": row[2],
                        "error_count": row[3],
                        "last_check": row[4]
                    }
            
            # Get database stats
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
            tables = [row[0] for row in cursor.fetchall()]
            
            stats = {}
            for table in tables:
                cursor.execute(f"SELECT COUNT(*) FROM {table}")
                stats[table] = cursor.fetchone()[0]
            
            # Get recent errors
            cursor.execute("""
                SELECT log_level, COUNT(*) as count
                FROM system_logs
                WHERE created_at >= datetime('now', '-24 hours')
                GROUP BY log_level
            """)
            
            error_stats = {row[0]: row[1] for row in cursor.fetchall()}
            
            return {
                "timestamp": datetime.now().isoformat(),
                "api_health": api_health,
                "database_stats": stats,
                "recent_errors": error_stats
            }
        finally:
            conn.close()
    
    def get_facility_details(self, facility_id: int) -> Dict[str, Any]:
        """Get detailed information for a specific facility."""
        # Hent alltid fra database, ingen mock/testdata
        conn = self.db.get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("""
                SELECT f.facility_id, f.facility_name, f.latitude, f.longitude, f.status, f.municipality, f.created_at
                FROM facilities f
                WHERE f.facility_id = ?
            """, (facility_id,))
            row = cursor.fetchone()
            if not row:
                return {}
            facility = {
                "id": row[0],
                "name": row[1],
                "location": {"lat": row[2], "lon": row[3]},
                "status": row[4],
                "municipality": row[5],
                "created_at": row[6]
            }
            # Hent siste risiko
            cursor.execute("""
                SELECT risk_score, risk_level, assessment_date, disease_proximity, disease_prevalence, water_exchange, farm_density, lice_level
                FROM risk_assessments
                WHERE facility_id = ?
                ORDER BY assessment_date DESC LIMIT 1
            """, (facility_id,))
            risk_row = cursor.fetchone()
            if risk_row:
                facility["latest_risk"] = {
                    "score": risk_row[0],
                    "level": risk_row[1],
                    "assessed_at": risk_row[2],
                    "factors": {
                        "disease_proximity": risk_row[3],
                        "disease_prevalence": risk_row[4],
                        "water_exchange": risk_row[5],
                        "farm_density": risk_row[6],
                        "lice_level": risk_row[7]
                    }
                }
            # Hent sykdomsdata
            cursor.execute("""
                SELECT type, lice_count, adult_female, mobile, detected_at
                FROM disease_data
                WHERE facility_id = ?
                ORDER BY detected_at DESC LIMIT 5
            """, (facility_id,))
            facility["recent_diseases"] = [
                {
                    "type": d[0],
                    "lice_count": d[1],
                    "adult_female": d[2],
                    "mobile": d[3],
                    "detected_at": d[4]
                } for d in cursor.fetchall()
            ]
            # Hent aktive varsler
            cursor.execute("""
                SELECT alert_id, alert_type, alert_severity, alert_message, alert_date
                FROM alerts
                WHERE facility_id = ? AND resolved = 0
                ORDER BY alert_date DESC LIMIT 5
            """, (facility_id,))
            facility["active_alerts"] = [
                {
                    "id": a[0],
                    "type": a[1],
                    "severity": a[2],
                    "message": a[3],
                    "created_at": a[4]
                } for a in cursor.fetchall()
            ]
            # Hent eksponeringer
            cursor.execute("""
                SELECT mmsi, vessel_name, distance_km, risk_score, visit_date
                FROM vessel_facility_exposure
                WHERE facility_id = ?
                ORDER BY visit_date DESC LIMIT 5
            """, (facility_id,))
            facility["recent_exposures"] = [
                {
                    "mmsi": e[0],
                    "vessel_name": e[1],
                    "distance_km": e[2],
                    "risk_score": e[3],
                    "visit_date": e[4]
                } for e in cursor.fetchall()
            ]
            return facility
        finally:
            conn.close()

