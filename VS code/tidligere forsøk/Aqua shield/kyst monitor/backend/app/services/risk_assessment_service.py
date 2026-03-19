"""Risk assessment service for analyzing farm data."""
from datetime import datetime
from typing import Optional, Tuple
from sqlalchemy.orm import Session
from app.db.models import Farm, RiskAssessment
from app.services.barentswatch_service import barentswatch_service
from app.services.ais_service import AISService
from app.logging.logger import logger
import json


class RiskAssessmentService:
    """Service for analyzing and calculating risk levels."""
    
    def __init__(self):
        self.barentswatch = barentswatch_service
        self.ais = AISService()
    
    async def assess_farm_risk(
        self,
        db: Session,
        farm: Farm
    ) -> Tuple[str, dict]:
        """
        Perform comprehensive risk assessment for a farm.
        
        Returns:
            Tuple of (risk_level, detailed_scores)
        """
        logger.info(f"Assessing risk for farm {farm.id}")
        
        # Collect data from external sources
        disease_data = await self.barentzwatch.get_disease_data(
            farm.latitude,
            farm.longitude,
            farm.id
        )
        
        pest_data = await self.barentzwatch.get_pest_data(
            farm.latitude,
            farm.longitude,
            farm.id
        )
        
        water_quality = await self.barentzwatch.get_water_quality_data(
            farm.latitude,
            farm.longitude,
            farm.id
        )
        
        ais_data = await self.ais.get_vessels_near_location(
            farm.latitude,
            farm.longitude
        )
        
        # Calculate individual risk scores
        disease_risk = self._calculate_disease_risk(disease_data)
        sea_lice_risk = self._calculate_sea_lice_risk(pest_data)
        water_quality_risk = self._calculate_water_quality_risk(water_quality)
        escape_risk = self._calculate_escape_risk(ais_data, farm)
        
        # Overall risk level
        max_risk = max(disease_risk, sea_lice_risk, water_quality_risk, escape_risk)
        risk_level = self._determine_risk_level(max_risk)
        
        scores = {
            "disease_risk": disease_risk,
            "sea_lice_risk": sea_lice_risk,
            "water_quality_risk": water_quality_risk,
            "escape_risk": escape_risk,
            "barentzwatch_data": json.dumps(disease_data or {}),
            "ais_data": json.dumps(ais_data or {})
        }
        
        logger.info(f"Risk assessment complete for farm {farm.id}: {risk_level}")
        return risk_level, scores
    
    def _calculate_disease_risk(self, disease_data: Optional[dict]) -> float:
        """Calculate disease outbreak risk."""
        if not disease_data:
            return 0.1
        
        # Simple scoring based on disease presence
        outbreaks = disease_data.get("outbreaks", [])
        if not outbreaks:
            return 0.1
        
        # Higher risk with nearby outbreaks
        risk = min(len(outbreaks) * 0.2, 1.0)
        return risk
    
    def _calculate_sea_lice_risk(self, pest_data: Optional[dict]) -> float:
        """Calculate sea lice and pest risk."""
        if not pest_data:
            return 0.1
        
        # Calculate based on pest presence and intensity
        pest_count = pest_data.get("pest_count", 0)
        
        if pest_count == 0:
            return 0.1
        elif pest_count < 100:
            return 0.3
        elif pest_count < 500:
            return 0.6
        else:
            return 0.9
    
    def _calculate_water_quality_risk(self, water_quality: Optional[dict]) -> float:
        """Calculate water quality risk."""
        if not water_quality:
            return 0.1
        
        risk = 0.0
        
        # Check oxygen levels
        oxygen = water_quality.get("oxygen_level")
        if oxygen and oxygen < 5.0:
            risk = max(risk, 0.7)
        
        # Check temperature
        temperature = water_quality.get("temperature")
        if temperature and (temperature > 16 or temperature < 0):
            risk = max(risk, 0.5)
        
        # Check pH
        ph = water_quality.get("ph")
        if ph and (ph < 6.5 or ph > 8.5):
            risk = max(risk, 0.4)
        
        return risk if risk > 0.1 else 0.1
    
    def _calculate_escape_risk(self, ais_data: Optional[dict], farm: Farm) -> float:
        """Calculate fish escape risk based on vessel proximity."""
        if not ais_data or not ais_data.get("vessels"):
            return 0.1
        
        max_proximity_risk = 0.0
        
        for vessel in ais_data.get("vessels", []):
            proximity_risk = self.ais.calculate_proximity_risk(
                farm.latitude,
                farm.longitude,
                vessel.get("latitude"),
                vessel.get("longitude")
            )
            max_proximity_risk = max(max_proximity_risk, proximity_risk)
        
        return max_proximity_risk if max_proximity_risk > 0.0 else 0.1
    
    def _determine_risk_level(self, max_risk: float) -> str:
        """Determine overall risk level from max component risk."""
        if max_risk >= 0.75:
            return "CRITICAL"
        elif max_risk >= 0.5:
            return "HIGH"
        elif max_risk >= 0.25:
            return "MEDIUM"
        else:
            return "LOW"
    
    async def save_assessment(
        self,
        db: Session,
        farm: Farm,
        risk_level: str,
        scores: dict
    ) -> RiskAssessment:
        """Save risk assessment to database."""
        assessment = RiskAssessment(
            farm_id=farm.id,
            risk_level=risk_level,
            disease_risk=scores.get("disease_risk", 0.0),
            escape_risk=scores.get("escape_risk", 0.0),
            water_quality_risk=scores.get("water_quality_risk", 0.0),
            sea_lice_risk=scores.get("sea_lice_risk", 0.0),
            barentzwatch_data=scores.get("barentzwatch_data"),
            ais_data=scores.get("ais_data")
        )
        
        db.add(assessment)
        db.commit()
        db.refresh(assessment)
        
        logger.info(f"Risk assessment saved for farm {farm.id}")
        return assessment
