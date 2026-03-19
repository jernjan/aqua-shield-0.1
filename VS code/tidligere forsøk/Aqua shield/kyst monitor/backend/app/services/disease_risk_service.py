"""Disease risk analysis and propagation service."""
import asyncio
import logging
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Tuple
from math import radians, cos, sin, asin, sqrt, atan2
import httpx
from app.services.barentswatch_service import barentswatch_service
from sqlalchemy.orm import Session
from app.db import models_disease as disease_models
from app.db.models_vessel import Vessel
from app.db.models import Farm, Alert
from app.core.config import settings

logger = logging.getLogger(__name__)


class OceanographicService:
    """Fetch water current and oceanographic data."""
    
    async def get_water_currents(self, lat: float, lon: float) -> Optional[Dict]:
        """Get water current data from public oceanographic services."""
        try:
            # Using NOAA or Copernicus Marine Service (free tier)
            # This is a simplified example - in production use actual APIs
            async with httpx.AsyncClient() as client:
                # Example: Copernicus Marine Service
                response = await client.get(
                    "https://data.marine.copernicus.eu/api/v1/timeseries",
                    params={
                        "latitude": lat,
                        "longitude": lon,
                        "dataset": "global-analysis-forecast-phys-001-024"
                    },
                    timeout=10
                )
                if response.status_code == 200:
                    return response.json()
        except Exception as e:
            logger.warning(f"Failed to fetch water current data: {e}")
        
        # Return mock data if API unavailable (for demonstration)
        return {
            "current_direction": "NE",  # degrees
            "current_speed_knots": 0.5,
            "temperature_c": 8.5,
            "salinity_psu": 34.8
        }
    
    async def get_weather_forecast(self, lat: float, lon: float) -> Optional[Dict]:
        """Get weather forecast data."""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    "https://api.open-meteo.com/v1/forecast",
                    params={
                        "latitude": lat,
                        "longitude": lon,
                        "hourly": "wind_speed_10m,wind_direction_10m",
                        "timezone": "UTC"
                    },
                    timeout=10
                )
                if response.status_code == 200:
                    return response.json()
        except Exception as e:
            logger.warning(f"Failed to fetch weather data: {e}")
        
        return None


class DiseaseRiskAnalyzer:
    """Analyze disease transmission risk and propagation."""
    
    def __init__(self):
        self.oceanographic = OceanographicService()
    
    @staticmethod
    def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Calculate distance between two points in km."""
        lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
        c = 2 * asin(sqrt(a))
        r = 6371  # Radius of earth in kilometers
        return c * r
    
    @staticmethod
    def calculate_drift_position(
        center_lat: float,
        center_lon: float,
        current_direction: float,
        current_speed_knots: float,
        hours: int
    ) -> Tuple[float, float]:
        """Calculate drifted position based on water current."""
        distance_km = (current_speed_knots * 1.852) * hours  # knots to km/h conversion
        
        # Convert direction to radians
        direction_rad = radians(current_direction)
        
        # Approximate calculation (valid for short distances)
        lat_offset = (distance_km / 111.0) * cos(direction_rad)
        lon_offset = (distance_km / (111.0 * cos(radians(center_lat)))) * sin(direction_rad)
        
        return center_lat + lat_offset, center_lon + lon_offset
    
    async def analyze_vessel_disease_exposure(
        self,
        db: Session,
        vessel: Vessel,
        infection_zones: List[disease_models.InfectionZone]
    ) -> List[Dict]:
        """Check if vessel has been exposed to infection zones."""
        exposures = []
        
        for zone in infection_zones:
            distance = self.haversine_distance(
                vessel.latitude, vessel.longitude,
                zone.center_lat, zone.center_lon
            )
            
            # If vessel is within infection zone radius + buffer
            if distance <= zone.radius_km + 5:  # 5km buffer for safety
                exposures.append({
                    "vessel_mmsi": vessel.mmsi,
                    "infection_zone_id": zone.id,
                    "disease_type": zone.disease_type,
                    "distance_km": distance,
                    "exposure_date": datetime.utcnow(),
                    "confidence_score": max(0.0, 1.0 - (distance / (zone.radius_km + 5)))
                })
        
        return exposures
    
    async def calculate_farm_risk_from_vessel(
        self,
        farm: Farm,
        vessel: Vessel,
        disease_type: str,
        water_currents: Optional[Dict] = None
    ) -> float:
        """Calculate transmission probability from vessel to farm."""
        distance_km = self.haversine_distance(
            farm.latitude, farm.longitude,
            vessel.latitude, vessel.longitude
        )
        
        # Base risk factors
        distance_risk = max(0.0, 1.0 - (distance_km / 50))  # 50km max range
        
        # Vessel speed risk (faster = more contamination)
        speed_risk = min(vessel.speed / 20, 1.0) if vessel.speed else 0.1
        
        # Check if vessel is moving toward farm (course risk)
        course_risk = 0.3  # Default
        if vessel.course is not None:
            bearing_to_farm = self.get_bearing(
                vessel.latitude, vessel.longitude,
                farm.latitude, farm.longitude
            )
            course_diff = abs(vessel.course - bearing_to_farm)
            course_diff = min(course_diff, 360 - course_diff)
            course_risk = max(0.0, 1.0 - (course_diff / 180))
        
        # Water current factor
        current_risk = 0.5  # Default
        if water_currents and "current_direction" in water_currents:
            # Similar bearing calculation for water current
            current_bearing = water_currents["current_direction"]
            bearing_to_farm = self.get_bearing(
                farm.latitude, farm.longitude,
                vessel.latitude, vessel.longitude
            )
            direction_diff = abs(current_bearing - bearing_to_farm)
            direction_diff = min(direction_diff, 360 - direction_diff)
            current_risk = max(0.0, 1.0 - (direction_diff / 180)) * (water_currents.get("current_speed_knots", 1) / 2)
        
        # Combine factors (weighted)
        transmission_probability = (
            distance_risk * 0.3 +
            speed_risk * 0.2 +
            course_risk * 0.25 +
            current_risk * 0.25
        )
        
        return min(1.0, max(0.0, transmission_probability))
    
    @staticmethod
    def get_bearing(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Calculate bearing between two points."""
        lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
        dlon = lon2 - lon1
        
        x = sin(dlon) * cos(lat2)
        y = cos(lat1) * sin(lat2) - sin(lat1) * cos(lat2) * cos(dlon)
        
        bearing = (atan2(x, y) * 180 / 3.14159265359) % 360
        return bearing


class DiseaseRiskService:
    """Main service for disease risk detection and alerts."""
    
    def __init__(self):
        self.analyzer = DiseaseRiskAnalyzer()
        self.oceanographic = OceanographicService()
    
    async def update_infection_zones(self, db: Session) -> None:
        """Update infection zones based on recent disease occurrences."""
        # Get recent disease occurrences (last 7 days)
        recent_diseases = db.query(disease_models.DiseaseOccurrence).filter(
            disease_models.DiseaseOccurrence.detected_at >= datetime.utcnow() - timedelta(days=7),
            disease_models.DiseaseOccurrence.is_resolved == False
        ).all()
        
        # Group by disease type and location
        disease_clusters = {}
        for disease in recent_diseases:
            key = disease.disease_type
            if key not in disease_clusters:
                disease_clusters[key] = []
            disease_clusters[key].append(disease)
        
        # Create/update zones for each cluster
        for disease_type, diseases in disease_clusters.items():
            if not diseases:
                continue
            
            # Calculate cluster center and radius
            avg_lat = sum(d.location_lat for d in diseases) / len(diseases)
            avg_lon = sum(d.location_lon for d in diseases) / len(diseases)
            
            # Find furthest disease from center
            max_distance = max(
                DiseaseRiskAnalyzer.haversine_distance(avg_lat, avg_lon, d.location_lat, d.location_lon)
                for d in diseases
            )
            radius_km = max_distance + 10  # Add 10km buffer
            
            # Get water current data
            currents = await self.oceanographic.get_water_currents(avg_lat, avg_lon)
            
            # Determine severity
            max_severity = "CRITICAL" if any(d.severity == "CRITICAL" for d in diseases) else \
                           "HIGH" if any(d.severity == "HIGH" for d in diseases) else "MEDIUM"
            
            # Create or update zone
            zone = db.query(disease_models.InfectionZone).filter(
                disease_models.InfectionZone.disease_type == disease_type,
                disease_models.InfectionZone.is_active == True
            ).first()
            
            if zone:
                zone.center_lat = avg_lat
                zone.center_lon = avg_lon
                zone.radius_km = radius_km
                zone.severity = max_severity
                zone.water_current_direction = currents.get("current_direction")
                zone.water_current_speed_knots = currents.get("current_speed_knots")
                zone.source_occurrences = ",".join(str(d.id) for d in diseases)
                zone.updated_at = datetime.utcnow()
            else:
                zone = disease_models.InfectionZone(
                    disease_type=disease_type,
                    center_lat=avg_lat,
                    center_lon=avg_lon,
                    radius_km=radius_km,
                    severity=max_severity,
                    water_current_direction=currents.get("current_direction"),
                    water_current_speed_knots=currents.get("current_speed_knots"),
                    source_occurrences=",".join(str(d.id) for d in diseases),
                    active_until=datetime.utcnow() + timedelta(days=14)  # Auto-expire after 2 weeks
                )
                db.add(zone)
            
            db.commit()
    
    async def check_vessel_disease_exposure(self, db: Session, vessels: List[Vessel]) -> List[Alert]:
        """Check vessels for disease zone exposure and create alerts."""
        alerts = []
        
        # Get active infection zones
        infection_zones = db.query(disease_models.InfectionZone).filter(
            disease_models.InfectionZone.is_active == True
        ).all()
        
        for vessel in vessels:
            # Check exposure to each zone
            exposures = await self.analyzer.analyze_vessel_disease_exposure(
                db, vessel, infection_zones
            )
            
            for exposure in exposures:
                # Check if already exposed
                existing = db.query(disease_models.VesselDiseaseExposure).filter(
                    disease_models.VesselDiseaseExposure.vessel_mmsi == vessel.mmsi,
                    disease_models.VesselDiseaseExposure.infection_zone_id == exposure["infection_zone_id"],
                    disease_models.VesselDiseaseExposure.exposure_date >= datetime.utcnow() - timedelta(hours=24)
                ).first()
                
                if not existing and exposure["confidence_score"] > 0.6:
                    # Create exposure record
                    vessel_exposure = disease_models.VesselDiseaseExposure(
                        vessel_mmsi=vessel.mmsi,
                        infection_zone_id=exposure["infection_zone_id"],
                        disease_type=exposure["disease_type"],
                        exposure_date=exposure["exposure_date"],
                        confidence_score=exposure["confidence_score"],
                        recommended_action="Desinfeksjon anbefales. Inspeksjon av utstyr påkrevd. Karantene hvis nødvendig."
                    )
                    db.add(vessel_exposure)
                    
                    # Create alert for vessel
                    alert = Alert(
                        user_id=1,  # System alert
                        farm_id=None,
                        alert_type="vessel_disease_exposure",
                        severity="HIGH",
                        title=f"⚠️ Båt {vessel.name} eksponert for {exposure['disease_type']}",
                        message=f"Båten {vessel.name} (MMSI: {vessel.mmsi}) har vært i en smittesone for {exposure['disease_type']}. "
                                f"Avstand: {exposure['distance_km']:.1f}km. "
                                f"Anbefalt tiltak: {vessel_exposure.recommended_action}"
                    )
                    db.add(alert)
                    alerts.append(alert)
        
        db.commit()
        return alerts
    
    async def analyze_farm_risk(self, db: Session, farm: Farm) -> Dict:
        """Analyze disease transmission risk to a specific farm."""
        vessels = db.query(Vessel).all()
        
        # Get water currents for farm location
        water_currents = await self.oceanographic.get_water_currents(farm.latitude, farm.longitude)
        
        risks = {
            "farm_id": farm.id,
            "farm_name": farm.name,
            "vessel_risks": [],
            "zone_risks": [],
            "overall_risk_score": 0.0
        }
        
        # Check risk from each vessel
        for vessel in vessels:
            prob = await self.analyzer.calculate_farm_risk_from_vessel(
                farm, vessel, "sea_lice", water_currents
            )
            
            if prob > 0.3:  # Only include if meaningful risk
                risks["vessel_risks"].append({
                    "vessel_name": vessel.name,
                    "vessel_mmsi": vessel.mmsi,
                    "distance_km": DiseaseRiskAnalyzer.haversine_distance(
                        farm.latitude, farm.longitude,
                        vessel.latitude, vessel.longitude
                    ),
                    "transmission_probability": prob,
                    "vessel_speed": vessel.speed,
                    "vessel_course": vessel.course
                })
        
        # Check infection zones
        infection_zones = db.query(disease_models.InfectionZone).filter(
            disease_models.InfectionZone.is_active == True
        ).all()
        
        for zone in infection_zones:
            distance = DiseaseRiskAnalyzer.haversine_distance(
                farm.latitude, farm.longitude,
                zone.center_lat, zone.center_lon
            )
            
            if distance <= zone.radius_km + 20:  # 20km safety zone
                zone_risk = max(0.0, 1.0 - (distance / (zone.radius_km + 20)))
                risks["zone_risks"].append({
                    "disease_type": zone.disease_type,
                    "distance_km": distance,
                    "zone_severity": zone.severity,
                    "risk_probability": zone_risk,
                    "water_current_direction": zone.water_current_direction,
                    "water_current_speed_knots": zone.water_current_speed_knots
                })
        
        # Calculate overall risk (weighted average)
        vessel_risk_avg = sum(r["transmission_probability"] for r in risks["vessel_risks"]) / len(risks["vessel_risks"]) if risks["vessel_risks"] else 0
        zone_risk_avg = sum(r["risk_probability"] for r in risks["zone_risks"]) / len(risks["zone_risks"]) if risks["zone_risks"] else 0
        
        risks["overall_risk_score"] = (vessel_risk_avg * 0.4 + zone_risk_avg * 0.6)
        risks["risk_level"] = "CRITICAL" if risks["overall_risk_score"] > 0.7 else \
                             "HIGH" if risks["overall_risk_score"] > 0.5 else \
                             "MEDIUM" if risks["overall_risk_score"] > 0.3 else "LOW"
        
        return risks


# Global instance
disease_risk_service = DiseaseRiskService()
