"""
Data persistence layer for KystMonitor
Provides utilities for storing and retrieving risk assessments and vessel data
"""

from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import logging
from src.db.database_manager import DatabaseManager

logger = logging.getLogger(__name__)


class RiskAssessmentStorage:
    """Store and retrieve risk assessments."""
    
    def __init__(self, db: DatabaseManager):
        self.db = db
    
    def save_assessment(self, facility_id: int, assessment: Dict[str, Any]) -> int:
        """Save a risk assessment to the database.
        
        Args:
            facility_id: Facility ID
            assessment: Risk assessment dict from RiskEngine
            
        Returns: assessment_id
        """
        try:
            factors = assessment.get('factors', {})
            assessment_id = self.db.add_risk_assessment(
                facility_id=facility_id,
                risk_score=assessment.get('risk_score', 0),
                risk_level=assessment.get('risk_level', 'UNKNOWN'),
                factors={
                    'disease_proximity': factors.disease_proximity if hasattr(factors, 'disease_proximity') else None,
                    'disease_prevalence': factors.disease_prevalence if hasattr(factors, 'disease_prevalence') else None,
                    'water_exchange': factors.water_exchange if hasattr(factors, 'water_exchange') else None,
                    'farm_density': factors.farm_density if hasattr(factors, 'farm_density') else None,
                    'lice_level': factors.lice_level if hasattr(factors, 'lice_level') else None,
                    'biggest_risk_factor': assessment.get('biggest_risk_factor', 'Unknown')
                }
            )
            logger.info(f"Saved risk assessment for facility {facility_id}, score {assessment['risk_score']}")
            return assessment_id
        except Exception as e:
            logger.error(f"Error saving assessment for facility {facility_id}: {e}")
            return None
    
    def save_batch_assessments(self, assessments: List[Dict[str, Any]]) -> int:
        """Save multiple risk assessments efficiently.
        
        Args:
            assessments: List of facility_id, assessment dicts
            
        Returns: Number saved
        """
        saved_count = 0
        for facility_id, assessment in assessments:
            if self.save_assessment(facility_id, assessment):
                saved_count += 1
        
        logger.info(f"Saved {saved_count} risk assessments")
        return saved_count
    
    def get_latest_assessment(self, facility_id: int) -> Optional[Dict[str, Any]]:
        """Get the most recent risk assessment for a facility.
        
        Returns: Assessment dict or None
        """
        history = self.db.get_facility_risk_history(facility_id, days=1000)
        return history[0] if history else None
    
    def get_trend(self, facility_id: int, days: int = 30) -> List[Dict[str, Any]]:
        """Get risk assessment trend for a facility.
        
        Returns: List of assessments in chronological order
        """
        return self.db.get_facility_risk_history(facility_id, days=days)


class DiseaseDataStorage:
    """Store and retrieve disease data."""
    
    def __init__(self, db: DatabaseManager):
        self.db = db
    
    def save_lice_data(self, facility_id: int, disease_type: str = 'LICE',
                      adult_female: float = None, mobile: float = None) -> int:
        """Save lice monitoring data.
        
        Returns: disease_id
        """
        try:
            disease_id = self.db.add_disease_data(
                facility_id=facility_id,
                disease_type=disease_type,
                adult_female_lice=adult_female,
                mobile_lice=mobile
            )
            logger.info(f"Saved lice data for facility {facility_id}")
            return disease_id
        except Exception as e:
            logger.error(f"Error saving lice data for facility {facility_id}: {e}")
            return None
    
    def save_outbreak(self, facility_id: int, disease_type: str) -> int:
        """Record a disease outbreak detection.
        
        Returns: disease_id
        """
        try:
            disease_id = self.db.add_disease_data(
                facility_id=facility_id,
                disease_type=disease_type,
                adult_female_lice=None,
                mobile_lice=None
            )
            
            # Create alert
            self.db.add_alert(
                facility_id=facility_id,
                alert_type='DISEASE',
                alert_severity='HIGH',
                alert_message=f"{disease_type} detected"
            )
            
            logger.warning(f"Disease {disease_type} detected at facility {facility_id}")
            return disease_id
        except Exception as e:
            logger.error(f"Error recording outbreak at facility {facility_id}: {e}")
            return None


class VesselTrackingStorage:
    """Store and retrieve vessel position data."""
    
    def __init__(self, db: DatabaseManager):
        self.db = db
    
    def save_position(self, mmsi: int, latitude: float, longitude: float,
                     heading: float = None, speed_knots: float = None,
                     vessel_name: str = None) -> int:
        """Save a vessel AIS position.
        
        Returns: position_id
        """
        try:
            position_id = self.db.add_vessel_position(
                mmsi=mmsi,
                latitude=latitude,
                longitude=longitude,
                heading=heading,
                speed_knots=speed_knots,
                vessel_name=vessel_name
            )
            return position_id
        except Exception as e:
            logger.error(f"Error saving vessel position for MMSI {mmsi}: {e}")
            return None
    
    def save_exposure(self, facility_id: int, mmsi: int, 
                     distance_km: float, exposure_risk_score: float,
                     vessel_name: str = None) -> int:
        """Record a vessel visit/exposure to a farm.
        
        Returns: exposure_id
        """
        conn = self.db.get_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute("""
                INSERT INTO vessel_facility_exposure
                (facility_id, mmsi, vessel_name, visit_date, distance_km, 
                 exposure_risk_score, exposure_type, data_source)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (facility_id, mmsi, vessel_name, datetime.now().isoformat(),
                  distance_km, exposure_risk_score, 'visit', 'AIS'))
            
            conn.commit()
            exposure_id = cursor.lastrowid
            
            logger.info(f"Recorded vessel exposure: MMSI {mmsi} to facility {facility_id}, "
                       f"distance {distance_km}km, risk {exposure_risk_score}")
            return exposure_id
            
        except Exception as e:
            logger.error(f"Error recording vessel exposure: {e}")
            return None
        finally:
            conn.close()


class OceanDataStorage:
    """Store and retrieve oceanographic data."""
    
    def __init__(self, db: DatabaseManager):
        self.db = db
    
    def save_current_data(self, latitude: float, longitude: float,
                         magnitude: float, u_velocity: float = None,
                         v_velocity: float = None) -> int:
        """Save ocean current measurement.
        
        Returns: current_id
        """
        conn = self.db.get_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute("""
                INSERT INTO ocean_currents
                (latitude, longitude, magnitude, u_velocity, v_velocity, 
                 measurement_date, data_source)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (latitude, longitude, magnitude, u_velocity, v_velocity,
                  datetime.now().isoformat(), 'Copernicus'))
            
            conn.commit()
            current_id = cursor.lastrowid
            return current_id
            
        except Exception as e:
            logger.error(f"Error saving ocean current data: {e}")
            return None
        finally:
            conn.close()


class AlertingSystem:
    """Manage system alerts and notifications."""
    
    def __init__(self, db: DatabaseManager):
        self.db = db
    
    def create_alert(self, facility_id: int, alert_type: str,
                    alert_severity: str, message: str):
        """Create a system alert.
        
        Args:
            facility_id: Affected facility
            alert_type: DISEASE, EXPOSURE, QUALITY, SYSTEM
            alert_severity: LOW, MEDIUM, HIGH, CRITICAL
            message: Alert message
        """
        alert_id = self.db.add_alert(
            facility_id=facility_id,
            alert_type=alert_type,
            alert_severity=alert_severity,
            alert_message=message
        )
        
        logger.warning(f"ALERT [{alert_severity}] {alert_type}: {message}")
        return alert_id
    
    def get_active_alerts(self, severity: str = None) -> List[Dict[str, Any]]:
        """Get all active (unresolved) alerts.
        
        Returns: List of alerts
        """
        return self.db.get_recent_alerts(alert_severity=severity)
    
    def get_facility_alerts(self, facility_id: int) -> List[Dict[str, Any]]:
        """Get alerts for a specific facility.
        
        Returns: List of alerts
        """
        return self.db.get_recent_alerts(facility_id=facility_id)
    
    def resolve_alert(self, alert_id: int):
        """Mark an alert as resolved.
        
        Args:
            alert_id: Alert ID to resolve
        """
        conn = self.db.get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            UPDATE alerts SET resolved = 1, resolved_date = ?
            WHERE alert_id = ?
        """, (datetime.now().isoformat(), alert_id))
        
        conn.commit()
        conn.close()


class SystemLogging:
    """Centralized system logging."""
    
    def __init__(self, db: DatabaseManager):
        self.db = db
    
    def info(self, category: str, message: str, facility_id: int = None):
        """Log info level message."""
        self.db.log_system_event('INFO', category, message, facility_id)
    
    def warning(self, category: str, message: str, facility_id: int = None):
        """Log warning level message."""
        self.db.log_system_event('WARNING', category, message, facility_id)
    
    def error(self, category: str, message: str, facility_id: int = None,
             error_details: str = None):
        """Log error level message."""
        self.db.log_system_event('ERROR', category, message, facility_id, error_details)
    
    def critical(self, category: str, message: str, facility_id: int = None,
                error_details: str = None):
        """Log critical level message."""
        self.db.log_system_event('CRITICAL', category, message, facility_id, error_details)


class DataQualityMonitor:
    """Monitor data source quality and availability."""
    
    def __init__(self, db: DatabaseManager):
        self.db = db
    
    def record_api_check(self, data_source: str, available: bool,
                        response_time_ms: float = None, error_count: int = 0):
        """Record API availability check.
        
        Args:
            data_source: Name of the API (BarentsWatch, Copernicus, etc.)
            available: Whether API is available
            response_time_ms: Response time in milliseconds
            error_count: Number of errors in this check period
        """
        conn = self.db.get_connection()
        cursor = conn.cursor()
        
        last_successful = datetime.now().isoformat() if available else None
        
        cursor.execute("""
            INSERT INTO data_quality
            (data_source, check_date, api_available, last_successful_fetch, 
             error_count, average_response_time_ms)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (data_source, datetime.now().isoformat(), 1 if available else 0,
              last_successful, error_count, response_time_ms))
        
        conn.commit()
        conn.close()
        
        logger.info(f"API Quality Check: {data_source} - "
                   f"{'Available' if available else 'Down'} "
                   f"({response_time_ms:.0f}ms)" if response_time_ms else "")
