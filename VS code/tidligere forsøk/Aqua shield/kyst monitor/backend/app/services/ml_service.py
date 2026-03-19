"""Machine learning service for disease transmission prediction."""
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Tuple
import numpy as np
from sqlalchemy.orm import Session
from app.db import models_disease as disease_models
from app.db.models import Farm, Alert
from app.db.models_vessel import Vessel
from app.services.disease_risk_service import DiseaseRiskAnalyzer
import json

logger = logging.getLogger(__name__)


class MLModelTrainer:
    """Train ML models on disease transmission data."""
    
    @staticmethod
    def prepare_training_data(db: Session) -> List[Dict]:
        """Prepare training data from historical disease propagations."""
        training_data = []
        
        # Get all resolved disease occurrences (ground truth)
        resolved_diseases = db.query(disease_models.DiseaseOccurrence).filter(
            disease_models.DiseaseOccurrence.is_resolved == True,
            disease_models.DiseaseOccurrence.detected_at >= datetime.utcnow() - timedelta(days=180)
        ).all()
        
        for source_disease in resolved_diseases:
            # Find all risk propagations from this disease
            propagations = db.query(disease_models.RiskPropagation).filter(
                disease_models.RiskPropagation.disease_occurrence_id == source_disease.id
            ).all()
            
            for propagation in propagations:
                # Determine if transmission actually occurred
                if propagation.target_farm_id:
                    target = db.query(Farm).filter(Farm.id == propagation.target_farm_id).first()
                    if not target:
                        continue
                    
                    # Check if there's a subsequent disease at target farm near prediction time
                    transmitted = bool(db.query(disease_models.DiseaseOccurrence).filter(
                        disease_models.DiseaseOccurrence.farm_id == propagation.target_farm_id,
                        disease_models.DiseaseOccurrence.disease_type == source_disease.disease_type,
                        disease_models.DiseaseOccurrence.detected_at >= propagation.estimated_arrival_time - timedelta(hours=24) if propagation.estimated_arrival_time else False,
                        disease_models.DiseaseOccurrence.detected_at <= propagation.estimated_arrival_time + timedelta(days=14) if propagation.estimated_arrival_time else False
                    ).first())
                    
                    source_farm = db.query(Farm).filter(Farm.id == source_disease.farm_id).first()
                    if source_farm and target:
                        # Extract features
                        features = MLModelTrainer.extract_features(
                            source_disease, source_farm, target, propagation, db
                        )
                        
                        training_data.append({
                            "features": features,
                            "outcome": "transmitted" if transmitted else "not_transmitted",
                            "outcome_date": propagation.estimated_arrival_time or datetime.utcnow(),
                            "source_disease_id": source_disease.id,
                            "propagation_id": propagation.id
                        })
        
        return training_data
    
    @staticmethod
    def extract_features(
        source_disease: disease_models.DiseaseOccurrence,
        source_farm: Farm,
        target_farm: Farm,
        propagation: disease_models.RiskPropagation,
        db: Session
    ) -> Dict:
        """Extract ML features from disease/farm/vessel data."""
        
        # Distance
        distance_km = DiseaseRiskAnalyzer.haversine_distance(
            source_farm.latitude, source_farm.longitude,
            target_farm.latitude, target_farm.longitude
        )
        
        # Water current effect (get from infection zones)
        zones = db.query(disease_models.InfectionZone).filter(
            disease_models.InfectionZone.disease_type == source_disease.disease_type,
            disease_models.InfectionZone.is_active == True
        ).all()
        
        avg_current_speed = np.mean([z.water_current_speed_knots or 0.5 for z in zones]) if zones else 0.5
        
        # Severity mapping
        severity_map = {"LOW": 0.25, "MEDIUM": 0.5, "HIGH": 0.75, "CRITICAL": 1.0}
        
        # Lice/disease intensity
        disease_intensity = source_disease.lice_count / 1000 if source_disease.lice_count else 0.5
        disease_intensity = min(1.0, disease_intensity)
        
        # Historical transmission rates (similar disease types between nearby farms)
        similar_transmissions = db.query(disease_models.RiskPropagation).filter(
            disease_models.RiskPropagation.propagation_vector == propagation.propagation_vector
        ).all()
        
        historical_transmission_rate = 0.5
        if similar_transmissions:
            transmitted_count = sum(1 for p in similar_transmissions if 
                db.query(disease_models.DiseaseOccurrence).filter(
                    disease_models.DiseaseOccurrence.farm_id == p.target_farm_id if p.target_farm_id else False
                ).first()
            )
            historical_transmission_rate = transmitted_count / len(similar_transmissions)
        
        # Detection time (how long from source to detection in target)
        time_since_source_days = (datetime.utcnow() - source_disease.detected_at).days
        
        return {
            "source_disease_type": source_disease.disease_type,
            "source_severity": severity_map.get(source_disease.severity, 0.5),
            "source_lice_count": min(source_disease.lice_count or 100, 1000),
            "source_mortality_rate": source_disease.mortality_rate or 0.05,
            
            "distance_km": distance_km,
            "water_current_speed_knots": avg_current_speed,
            "propagation_vector": {"water_current": 1.0, "vessel_movement": 2.0, "escaped_fish": 0.8}.get(propagation.propagation_vector, 1.0),
            
            "target_farm_size_biomass": 500,  # Placeholder - would need from farm data
            "target_distance_to_coast_km": 5,  # Placeholder
            
            "time_since_source_days": time_since_source_days,
            "disease_intensity": disease_intensity,
            "historical_transmission_rate": historical_transmission_rate,
            "season": datetime.utcnow().month,
            "water_temperature": 8.5,  # Placeholder - from oceanographic data
        }
    
    @staticmethod
    def train_simple_model(training_data: List[Dict]) -> Dict:
        """
        Train a simple logistic regression-style model.
        
        In production, use sklearn, XGBoost, or TensorFlow.
        This is a simplified example.
        """
        if not training_data:
            logger.warning("No training data available")
            return {"error": "No training data"}
        
        # Separate transmitted vs not_transmitted
        transmitted = [d for d in training_data if d["outcome"] == "transmitted"]
        not_transmitted = [d for d in training_data if d["outcome"] == "not_transmitted"]
        
        logger.info(f"Training data: {len(transmitted)} transmitted, {len(not_transmitted)} not transmitted")
        
        # Calculate feature importance (simplified)
        importance = {}
        if transmitted and not_transmitted:
            for key in transmitted[0]["features"].keys():
                transmitted_avg = np.mean([d["features"][key] for d in transmitted if isinstance(d["features"][key], (int, float))])
                not_transmitted_avg = np.mean([d["features"][key] for d in not_transmitted if isinstance(d["features"][key], (int, float))])
                
                importance[key] = abs(transmitted_avg - not_transmitted_avg)
        
        return {
            "model_version": "v1.0",
            "trained_at": datetime.utcnow().isoformat(),
            "samples": len(training_data),
            "transmitted_samples": len(transmitted),
            "not_transmitted_samples": len(not_transmitted),
            "feature_importance": importance,
            "accuracy_estimate": len(transmitted) / len(training_data) if training_data else 0.5
        }


class MLPredictionService:
    """Make disease transmission predictions using ML models."""
    
    @staticmethod
    async def predict_transmission(
        source_farm: Farm,
        target_farm: Farm,
        disease_type: str,
        db: Session
    ) -> Tuple[float, str]:
        """
        Predict transmission probability from source to target farm.
        
        Returns:
            Tuple of (probability, confidence_level)
        """
        
        # Get recent infection zones
        zones = db.query(disease_models.InfectionZone).filter(
            disease_models.InfectionZone.disease_type == disease_type,
            disease_models.InfectionZone.is_active == True
        ).all()
        
        if not zones:
            # No active zones, baseline prediction
            return 0.1, "baseline"
        
        # Check if target is in any zone
        distance_to_zone = min(
            DiseaseRiskAnalyzer.haversine_distance(
                target_farm.latitude, target_farm.longitude,
                zone.center_lat, zone.center_lon
            ) - zone.radius_km
            for zone in zones
        )
        
        if distance_to_zone <= 0:
            # Target is in zone
            return 0.85, "high_confidence"
        
        # Distance-based prediction
        if distance_to_zone <= 10:  # Within 10km
            probability = 0.6
            confidence = "medium_confidence"
        elif distance_to_zone <= 30:  # Within 30km
            probability = 0.3
            confidence = "low_confidence"
        else:  # Further than 30km
            probability = 0.1
            confidence = "low_confidence"
        
        return probability, confidence
    
    @staticmethod
    async def predict_farm_outbreaks(db: Session) -> List[Dict]:
        """Predict potential disease outbreaks for all farms."""
        farms = db.query(Farm).filter(Farm.is_active == True).all()
        predictions = []
        
        # Get active diseases
        active_diseases = db.query(disease_models.DiseaseOccurrence).filter(
            disease_models.DiseaseOccurrence.is_resolved == False,
            disease_models.DiseaseOccurrence.detected_at >= datetime.utcnow() - timedelta(days=7)
        ).all()
        
        for farm in farms:
            for disease in active_diseases:
                if disease.farm_id == farm.id:
                    continue  # Skip source farm
                
                source_farm = db.query(Farm).filter(Farm.id == disease.farm_id).first()
                if not source_farm:
                    continue
                
                # Get prediction
                probability, confidence = await MLPredictionService.predict_transmission(
                    source_farm, farm, disease.disease_type, db
                )
                
                if probability > 0.3:  # Only include meaningful predictions
                    predictions.append({
                        "target_farm_id": farm.id,
                        "target_farm_name": farm.name,
                        "source_farm_id": disease.farm_id,
                        "source_farm_name": source_farm.name,
                        "disease_type": disease.disease_type,
                        "transmission_probability": probability,
                        "confidence": confidence,
                        "predicted_arrival": (datetime.utcnow() + timedelta(days=2)).isoformat(),
                        "recommendation": "Økt overvåking anbefalt" if probability > 0.5 else "Normal overvåking"
                    })
        
        return sorted(predictions, key=lambda x: x["transmission_probability"], reverse=True)
    
    @staticmethod
    async def create_predictions_in_db(db: Session, predictions: List[Dict]) -> None:
        """Store predictions in database for tracking."""
        for pred in predictions:
            existing = db.query(disease_models.ModelPrediction).filter(
                disease_models.ModelPrediction.target_farm_id == pred.get("target_farm_id"),
                disease_models.ModelPrediction.disease_type == pred.get("disease_type"),
                disease_models.ModelPrediction.created_at >= datetime.utcnow() - timedelta(hours=1)
            ).first()
            
            if not existing:  # Avoid duplicates within 1 hour
                model_pred = disease_models.ModelPrediction(
                    source_farm_id=pred.get("source_farm_id"),
                    target_farm_id=pred.get("target_farm_id"),
                    disease_type=pred.get("disease_type"),
                    transmission_probability=pred.get("transmission_probability", 0.5),
                    predicted_arrival=datetime.fromisoformat(pred.get("predicted_arrival", datetime.utcnow().isoformat())),
                    model_version="v1.0",
                    model_accuracy=None,
                    prediction_active=True
                )
                db.add(model_pred)
        
        db.commit()


# Global instances
ml_trainer = MLModelTrainer()
ml_prediction_service = MLPredictionService()
