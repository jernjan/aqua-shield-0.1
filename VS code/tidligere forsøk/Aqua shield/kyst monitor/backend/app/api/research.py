"""API endpoints for machine learning and research data."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import List, Optional
from app.db.database import get_db
from app.db import models_disease as disease_models
from app.db.models import Farm, Alert
from app.db.models_vessel import Vessel
from app.services.ml_service import ml_trainer, ml_prediction_service
from pydantic import BaseModel

router = APIRouter(prefix="/api/research", tags=["research"])


# ============ Pydantic Schemas ============

class TrainingDataResponse(BaseModel):
    total_samples: int
    disease_types: List[str]
    time_range: dict
    sample_breakdown: dict


class ModelInfoResponse(BaseModel):
    model_version: str
    trained_at: datetime
    training_samples: int
    feature_importance: dict
    accuracy_estimate: float


class PredictionResponse(BaseModel):
    target_farm_id: int
    target_farm_name: str
    source_farm_id: int
    source_farm_name: str
    disease_type: str
    transmission_probability: float
    confidence: str
    predicted_arrival: str
    recommendation: str


class ResearchDataExport(BaseModel):
    """Complete data export for research/insurance companies."""
    export_date: datetime
    farm_count: int
    vessel_count: int
    disease_occurrences: int
    active_infection_zones: int
    predictions_count: int
    training_data_points: int
    
    # Summary statistics
    disease_types: List[str]
    severity_distribution: dict
    geographic_coverage: dict


# ============ Training Data ============

@router.get("/training-data", response_model=TrainingDataResponse)
async def get_training_data_info(
    days: int = Query(180, ge=30, le=730),
    db: Session = Depends(get_db)
):
    """Get training data statistics."""
    cutoff_date = datetime.utcnow() - timedelta(days=days)
    
    training_data = ml_trainer.prepare_training_data(db)
    
    # Count by disease type
    diseases_in_data = {}
    for d in training_data:
        disease_type = d["features"].get("source_disease_type", "unknown")
        diseases_in_data[disease_type] = diseases_in_data.get(disease_type, 0) + 1
    
    # Count outcomes
    outcomes = {}
    for d in training_data:
        outcome = d["outcome"]
        outcomes[outcome] = outcomes.get(outcome, 0) + 1
    
    return {
        "total_samples": len(training_data),
        "disease_types": list(diseases_in_data.keys()),
        "time_range": {
            "from": cutoff_date.isoformat(),
            "to": datetime.utcnow().isoformat()
        },
        "sample_breakdown": outcomes
    }


@router.post("/train-model", response_model=ModelInfoResponse)
async def train_disease_model(db: Session = Depends(get_db)):
    """Train/retrain disease transmission model."""
    training_data = ml_trainer.prepare_training_data(db)
    
    if not training_data:
        raise HTTPException(status_code=400, detail="Insufficient training data")
    
    model_info = ml_trainer.train_simple_model(training_data)
    
    # Store training metadata
    # In production: save model weights, version, etc.
    
    return {
        "model_version": model_info.get("model_version", "unknown"),
        "trained_at": datetime.fromisoformat(model_info.get("trained_at", datetime.utcnow().isoformat())),
        "training_samples": model_info.get("samples", 0),
        "feature_importance": model_info.get("feature_importance", {}),
        "accuracy_estimate": model_info.get("accuracy_estimate", 0.5)
    }


# ============ Predictions ============

@router.get("/predictions", response_model=List[PredictionResponse])
async def get_current_predictions(
    disease_type: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db)
):
    """Get current disease transmission predictions."""
    query = db.query(disease_models.ModelPrediction).filter(
        disease_models.ModelPrediction.prediction_active == True,
        disease_models.ModelPrediction.created_at >= datetime.utcnow() - timedelta(hours=24)
    )
    
    if disease_type:
        query = query.filter(disease_models.ModelPrediction.disease_type == disease_type)
    
    predictions = query.order_by(
        disease_models.ModelPrediction.transmission_probability.desc()
    ).limit(limit).all()
    
    result = []
    for pred in predictions:
        source_farm = None
        target_farm = None
        
        if pred.source_farm_id:
            source_farm = db.query(Farm).filter(Farm.id == pred.source_farm_id).first()
        if pred.target_farm_id:
            target_farm = db.query(Farm).filter(Farm.id == pred.target_farm_id).first()
        
        if target_farm:
            result.append({
                "target_farm_id": target_farm.id,
                "target_farm_name": target_farm.name,
                "source_farm_id": source_farm.id if source_farm else None,
                "source_farm_name": source_farm.name if source_farm else "Unknown",
                "disease_type": pred.disease_type,
                "transmission_probability": pred.transmission_probability,
                "confidence": "high" if pred.transmission_probability > 0.7 else "medium" if pred.transmission_probability > 0.4 else "low",
                "predicted_arrival": pred.predicted_arrival.isoformat(),
                "recommendation": "Kritisk: økt biosikkerhet påkrevd" if pred.transmission_probability > 0.7 else "Høy: overvåking intensivert" if pred.transmission_probability > 0.5 else "Moderat: normal overvåking"
            })
    
    return result


@router.post("/predict-outbreaks")
async def predict_farm_outbreaks(db: Session = Depends(get_db)):
    """Generate outbreak predictions for all farms."""
    predictions = await ml_prediction_service.predict_farm_outbreaks(db)
    
    # Store in database
    await ml_prediction_service.create_predictions_in_db(db, predictions)
    
    return {
        "predictions_generated": len(predictions),
        "critical_risk": len([p for p in predictions if p["transmission_probability"] > 0.7]),
        "high_risk": len([p for p in predictions if 0.5 <= p["transmission_probability"] <= 0.7]),
        "predictions": predictions[:20]  # Return top 20
    }


# ============ Research Data Export ============

@router.get("/export-research-data", response_model=ResearchDataExport)
async def export_research_data(
    include_raw_data: bool = Query(False),
    db: Session = Depends(get_db)
):
    """Export anonymized data for research and insurance companies."""
    
    # Count basic entities
    farms = db.query(Farm).all()
    vessels = db.query(Vessel).all()
    diseases = db.query(disease_models.DiseaseOccurrence).all()
    zones = db.query(disease_models.InfectionZone).filter(
        disease_models.InfectionZone.is_active == True
    ).all()
    predictions = db.query(disease_models.ModelPrediction).filter(
        disease_models.ModelPrediction.prediction_active == True
    ).all()
    
    training_data = ml_trainer.prepare_training_data(db)
    
    # Aggregate statistics
    disease_types = set(d.disease_type for d in diseases)
    severity_dist = {}
    for severity in ["LOW", "MEDIUM", "HIGH", "CRITICAL"]:
        count = len([d for d in diseases if d.severity == severity])
        if count > 0:
            severity_dist[severity] = count
    
    # Geographic coverage
    geo_coverage = {
        "farms": len(farms),
        "vessels_tracked": len(vessels),
        "geographic_bounds": {
            "north": max(f.latitude for f in farms) if farms else 70.0,
            "south": min(f.latitude for f in farms) if farms else 58.0,
            "east": max(f.longitude for f in farms) if farms else 35.0,
            "west": min(f.longitude for f in farms) if farms else 4.0,
        }
    }
    
    export_data = {
        "export_date": datetime.utcnow(),
        "farm_count": len(farms),
        "vessel_count": len(vessels),
        "disease_occurrences": len(diseases),
        "active_infection_zones": len(zones),
        "predictions_count": len(predictions),
        "training_data_points": len(training_data),
        "disease_types": list(disease_types),
        "severity_distribution": severity_dist,
        "geographic_coverage": geo_coverage
    }
    
    return export_data


@router.get("/export-research-data/detailed")
async def export_detailed_research_data(
    anonymize: bool = Query(True),
    db: Session = Depends(get_db)
):
    """Export detailed research data (for authorized users only)."""
    
    # Get all data
    diseases = db.query(disease_models.DiseaseOccurrence).all()
    zones = db.query(disease_models.InfectionZone).all()
    propagations = db.query(disease_models.RiskPropagation).all()
    predictions = db.query(disease_models.ModelPrediction).all()
    
    # Format for export
    disease_data = []
    for d in diseases:
        disease_data.append({
            "id": d.id if not anonymize else "D_" + str(d.id),
            "disease_type": d.disease_type,
            "severity": d.severity,
            "location": {
                "latitude": d.location_lat,
                "longitude": d.location_lon
            },
            "detected_date": d.detected_at.isoformat(),
            "lice_count": d.lice_count,
            "mortality_rate": d.mortality_rate,
            "transmission_vector": d.transmission_vector,
            "resolved": d.is_resolved
        })
    
    zone_data = []
    for z in zones:
        zone_data.append({
            "id": z.id if not anonymize else "Z_" + str(z.id),
            "disease_type": z.disease_type,
            "center": {
                "latitude": z.center_lat,
                "longitude": z.center_lon
            },
            "radius_km": z.radius_km,
            "severity": z.severity,
            "active": z.is_active
        })
    
    propagation_data = []
    for p in propagations:
        propagation_data.append({
            "id": p.id if not anonymize else "P_" + str(p.id),
            "disease_type": p.disease_occurrence_id,
            "vector": p.propagation_vector,
            "probability": p.transmission_probability,
            "alert_sent": p.alert_sent,
            "created_date": p.created_at.isoformat()
        })
    
    return {
        "export_date": datetime.utcnow().isoformat(),
        "anonymized": anonymize,
        "diseases": disease_data,
        "infection_zones": zone_data,
        "propagations": propagation_data,
        "predictions_count": len(predictions),
        "note": "For research and insurance analysis. Further anonymization may be applied as needed."
    }


# ============ Statistics ============

@router.get("/statistics")
async def get_research_statistics(
    days: int = Query(90, ge=7, le=365),
    db: Session = Depends(get_db)
):
    """Get comprehensive statistics for research."""
    cutoff_date = datetime.utcnow() - timedelta(days=days)
    
    # Count by disease type
    diseases_by_type = {}
    all_diseases = db.query(disease_models.DiseaseOccurrence).filter(
        disease_models.DiseaseOccurrence.detected_at >= cutoff_date
    ).all()
    
    for disease in all_diseases:
        if disease.disease_type not in diseases_by_type:
            diseases_by_type[disease.disease_type] = {
                "count": 0,
                "resolved": 0,
                "active": 0,
                "severity_breakdown": {}
            }
        
        diseases_by_type[disease.disease_type]["count"] += 1
        if disease.is_resolved:
            diseases_by_type[disease.disease_type]["resolved"] += 1
        else:
            diseases_by_type[disease.disease_type]["active"] += 1
        
        severity = disease.severity
        if severity not in diseases_by_type[disease.disease_type]["severity_breakdown"]:
            diseases_by_type[disease.disease_type]["severity_breakdown"][severity] = 0
        diseases_by_type[disease.disease_type]["severity_breakdown"][severity] += 1
    
    # Transmission vectors
    propagations = db.query(disease_models.RiskPropagation).filter(
        disease_models.RiskPropagation.created_at >= cutoff_date
    ).all()
    
    vectors = {}
    for prop in propagations:
        vector = prop.propagation_vector
        if vector not in vectors:
            vectors[vector] = {"count": 0, "avg_probability": 0.0}
        vectors[vector]["count"] += 1
        vectors[vector]["avg_probability"] = (
            (vectors[vector]["avg_probability"] * (vectors[vector]["count"] - 1) + prop.transmission_probability) /
            vectors[vector]["count"]
        )
    
    return {
        "time_period_days": days,
        "total_disease_occurrences": len(all_diseases),
        "diseases_by_type": diseases_by_type,
        "propagation_vectors": vectors,
        "generated_at": datetime.utcnow().isoformat()
    }
