"""
Prediction Validator - Tracks prediction accuracy and enables ML feedback loop

Records predictions and compares them with actual outcomes to:
1. Calculate accuracy metrics (precision, recall, F1)
2. Build historical dataset for ML training
3. Identify systematic prediction errors
4. Enable continuous model improvement

This module is the foundation for transitioning from rule-based to ML-based predictions.
"""

import json
import os
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
import logging

logger = logging.getLogger(__name__)


@dataclass
class PredictionRecord:
    """A single prediction with metadata for validation"""
    facility_code: str
    facility_name: str
    prediction_date: str  # ISO format
    prediction_horizon_days: int  # How many days ahead was predicted
    predicted_risk_pct: float
    predicted_risk_level: str  # "Low", "Medium", "Critical"
    predicted_outbreak: bool  # True if risk >= 25%
    
    # Factors that contributed to prediction
    distance_to_infected: float
    time_since_visit: float
    boat_visits_7d: int
    quarantine_boat_visits_7d: int = 0  # NEW: Boats under quarantine (3x weight in risk calculation)
    ocean_current_risk: float = 0.0
    disease_weight: float = 1.0
    quarantine_factor: float = 1.0
    
    # Actual outcome (filled in later during validation)
    actual_outbreak: Optional[bool] = None
    actual_outbreak_date: Optional[str] = None
    validation_date: Optional[str] = None
    
    # Prediction accuracy
    correct_prediction: Optional[bool] = None
    days_between_prediction_and_outbreak: Optional[int] = None


@dataclass
class AccuracyMetrics:
    """Overall prediction accuracy metrics"""
    total_predictions: int
    validated_predictions: int
    
    # Classification metrics
    true_positives: int  # Correctly predicted outbreak
    true_negatives: int  # Correctly predicted no outbreak
    false_positives: int  # Predicted outbreak but didn't happen
    false_negatives: int  # Missed an outbreak
    
    # Calculated metrics
    accuracy: float  # (TP + TN) / Total
    precision: float  # TP / (TP + FP)
    recall: float  # TP / (TP + FN)
    f1_score: float  # 2 * (precision * recall) / (precision + recall)
    
    # Time-based metrics
    average_prediction_lead_time_days: Optional[float] = None
    median_prediction_lead_time_days: Optional[float] = None


class PredictionValidator:
    """Manages prediction tracking and validation"""
    
    def __init__(self):
        self.predictions_file = "src/api/data/predictions_tracking.json"
        self.validation_results_file = "src/api/data/validation_results.json"
        self.metrics_file = "src/api/data/prediction_metrics.json"
        
        for file_path in [self.predictions_file, self.validation_results_file, self.metrics_file]:
            os.makedirs(os.path.dirname(file_path), exist_ok=True)
    
    def record_prediction(
        self,
        facility_code: str,
        facility_name: str,
        predicted_risk_pct: float,
        predicted_risk_level: str,
        factors: Dict[str, float],
        prediction_horizon_days: int = 30,
        quarantine_boat_visits_7d: int = 0
    ) -> None:
        """Record a prediction for later validation
        
        Args:
            facility_code: Facility identifier
            facility_name: Facility name
            predicted_risk_pct: Predicted outbreak probability (0-100)
            predicted_risk_level: "Low", "Medium", or "Critical"
            factors: Dict of risk factors that contributed to prediction
            prediction_horizon_days: How many days ahead this predicts
            quarantine_boat_visits_7d: Number of visits from boats under quarantine (3x weight)
        """
        try:
            record = PredictionRecord(
                facility_code=facility_code,
                facility_name=facility_name,
                prediction_date=datetime.now().isoformat(),
                prediction_horizon_days=prediction_horizon_days,
                predicted_risk_pct=predicted_risk_pct,
                predicted_risk_level=predicted_risk_level,
                predicted_outbreak=(predicted_risk_pct >= 25.0),
                distance_to_infected=factors.get("distance_to_infected", 0.0),
                time_since_visit=factors.get("time_since_visit", 0.0),
                boat_visits_7d=int(factors.get("boat_visits_7d", 0)),
                quarantine_boat_visits_7d=quarantine_boat_visits_7d,
                ocean_current_risk=factors.get("ocean_current_risk", 0.0),
                disease_weight=factors.get("disease_weight", 1.0),
                quarantine_factor=factors.get("quarantine_factor", 1.0),
            )
            
            # Load existing predictions
            predictions = self._load_predictions()
            
            # Add new record
            predictions.append(asdict(record))
            
            # Save back
            with open(self.predictions_file, 'w') as f:
                json.dump(predictions, f, indent=2)
                
        except Exception as e:
            logger.error(f"Failed to record prediction: {e}")
    
    def validate_predictions(
        self,
        current_facilities_with_disease: List[Dict],
        observation_window_days: int = 90
    ) -> AccuracyMetrics:
        """Validate past predictions against current disease status
        
        Args:
            current_facilities_with_disease: List of facilities with confirmed diseases
                                            Each dict should have 'localityNo' and 'disease'
            observation_window_days: Days to wait before marking prediction as false positive
                                    Default 90 days accounts for detection lag
        
        Returns:
            AccuracyMetrics with overall prediction performance
            
        Note:
            Detection lag problem: Disease may occur weeks/months before official detection.
            We use extended observation window to avoid premature false positive marking.
            - Prediction date: Day 0
            - Short-term horizon: 30 days (predicted outbreak window)
            - Observation window: 90 days (detection may happen anytime within this)
            - After 90 days: If no outbreak detected, mark as true negative
        """
        try:
            predictions = self._load_predictions()
            
            # Build set of facility codes with current diseases
            diseased_facilities = set()
            disease_dates = {}  # facility_code -> earliest disease detection date
            
            for facility in current_facilities_with_disease:
                code = str(facility.get('localityNo', ''))
                if code:
                    diseased_facilities.add(code)
                    # If we have detection date, use it
                    detection_date = facility.get('detectionDate') or facility.get('week')
                    if detection_date:
                        disease_dates[code] = detection_date
            
            # Validate each prediction that's old enough
            today = datetime.now()
            validated_count = 0
            true_positives = 0
            true_negatives = 0
            false_positives = 0
            false_negatives = 0
            lead_times = []
            
            for pred in predictions:
                # Skip if already validated
                if pred.get('validation_date'):
                    validated_count += 1
                    # Count towards metrics
                    if pred.get('correct_prediction') is not None:
                        actual_outbreak = pred.get('actual_outbreak', False)
                        predicted_outbreak = pred.get('predicted_outbreak', False)
                        
                        if predicted_outbreak and actual_outbreak:
                            true_positives += 1
                            if pred.get('days_between_prediction_and_outbreak'):
                                lead_times.append(pred['days_between_prediction_and_outbreak'])
                        elif predicted_outbreak and not actual_outbreak:
                            false_positives += 1
                        elif not predicted_outbreak and actual_outbreak:
                            false_negatives += 1
                        else:
                            true_negatives += 1
                    continue
                
                # Check if prediction is old enough to validate
                pred_date = datetime.fromisoformat(pred['prediction_date'])
                horizon_days = pred.get('prediction_horizon_days', 30)
                
                # Use extended observation window to account for detection lag
                # Even if we predict outbreak in 7 days, disease may not be detected until 90 days
                observation_cutoff = pred_date + timedelta(days=observation_window_days)
                
                if today < observation_cutoff:
                    # Still in observation window - don't validate yet
                    # This prevents premature false positive classification
                    continue
                
                # Now we're past observation window - safe to validate
                facility_code = str(pred['facility_code'])
                predicted_outbreak = pred.get('predicted_outbreak', False)
                actual_outbreak = facility_code in diseased_facilities
                
                # Update prediction record
                pred['actual_outbreak'] = actual_outbreak
                pred['validation_date'] = today.isoformat()
                pred['correct_prediction'] = (predicted_outbreak == actual_outbreak)
                pred['observation_window_days'] = observation_window_days
                
                if actual_outbreak and facility_code in disease_dates:
                    pred['actual_outbreak_date'] = disease_dates[facility_code]
                    # Calculate lead time (prediction date -> detection date)
                    # This can be negative if detected before prediction, or very large if detected late
                    if predicted_outbreak:
                        try:
                            outbreak_date = datetime.fromisoformat(disease_dates[facility_code].split('T')[0])
                            lead_time = (outbreak_date - pred_date).days
                            pred['days_between_prediction_and_outbreak'] = lead_time
                            
                            # Only count as lead time if detected within reasonable window
                            # (not years later, which would be different outbreak)
                            if 0 <= lead_time <= observation_window_days:
                                lead_times.append(lead_time)
                        except:
                            pass
                
                # Count towards metrics
                if predicted_outbreak and actual_outbreak:
                    true_positives += 1
                elif predicted_outbreak and not actual_outbreak:
                    false_positives += 1
                elif not predicted_outbreak and actual_outbreak:
                    false_negatives += 1
                else:
                    true_negatives += 1
                
                validated_count += 1
            
            # Save updated predictions
            with open(self.predictions_file, 'w') as f:
                json.dump(predictions, f, indent=2)
            
            # Calculate metrics
            total_validated = validated_count
            accuracy = (true_positives + true_negatives) / total_validated if total_validated > 0 else 0.0
            precision = true_positives / (true_positives + false_positives) if (true_positives + false_positives) > 0 else 0.0
            recall = true_positives / (true_positives + false_negatives) if (true_positives + false_negatives) > 0 else 0.0
            f1_score = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0
            
            avg_lead_time = sum(lead_times) / len(lead_times) if lead_times else None
            median_lead_time = sorted(lead_times)[len(lead_times) // 2] if lead_times else None
            
            metrics = AccuracyMetrics(
                total_predictions=len(predictions),
                validated_predictions=total_validated,
                true_positives=true_positives,
                true_negatives=true_negatives,
                false_positives=false_positives,
                false_negatives=false_negatives,
                accuracy=round(accuracy, 3),
                precision=round(precision, 3),
                recall=round(recall, 3),
                f1_score=round(f1_score, 3),
                average_prediction_lead_time_days=round(avg_lead_time, 1) if avg_lead_time else None,
                median_prediction_lead_time_days=median_lead_time
            )
            
            # Save metrics
            self._save_metrics(metrics)
            
            logger.info(f"✅ Validated {validated_count} predictions - Accuracy: {metrics.accuracy:.1%}, F1: {metrics.f1_score:.3f}")
            
            return metrics
            
        except Exception as e:
            logger.error(f"Failed to validate predictions: {e}")
            # Return empty metrics
            return AccuracyMetrics(
                total_predictions=0,
                validated_predictions=0,
                true_positives=0,
                true_negatives=0,
                false_positives=0,
                false_negatives=0,
                accuracy=0.0,
                precision=0.0,
                recall=0.0,
                f1_score=0.0
            )
    
    def get_latest_metrics(self) -> Optional[AccuracyMetrics]:
        """Get the most recent accuracy metrics"""
        try:
            if os.path.exists(self.metrics_file):
                with open(self.metrics_file, 'r') as f:
                    data = json.load(f)
                    if isinstance(data, list) and len(data) > 0:
                        latest = data[-1]['metrics']
                        return AccuracyMetrics(**latest)
            return None
        except Exception as e:
            logger.error(f"Failed to load metrics: {e}")
            return None
    
    def get_validation_history(self, days: int = 30) -> List[Dict]:
        """Get validation history for the past N days"""
        try:
            predictions = self._load_predictions()
            cutoff = datetime.now() - timedelta(days=days)
            
            recent = []
            for pred in predictions:
                if pred.get('validation_date'):
                    val_date = datetime.fromisoformat(pred['validation_date'])
                    if val_date >= cutoff:
                        recent.append(pred)
            
            return recent
        except Exception as e:
            logger.error(f"Failed to get validation history: {e}")
            return []
    
    def _load_predictions(self) -> List[Dict]:
        """Load all prediction records"""
        if os.path.exists(self.predictions_file):
            try:
                with open(self.predictions_file, 'r') as f:
                    return json.load(f)
            except:
                return []
        return []
    
    def _save_metrics(self, metrics: AccuracyMetrics) -> None:
        """Save metrics with timestamp"""
        try:
            history = []
            if os.path.exists(self.metrics_file):
                with open(self.metrics_file, 'r') as f:
                    history = json.load(f)
            
            history.append({
                'timestamp': datetime.now().isoformat(),
                'metrics': asdict(metrics)
            })
            
            # Keep last 90 days only
            cutoff = datetime.now() - timedelta(days=90)
            history = [
                h for h in history
                if datetime.fromisoformat(h['timestamp']) >= cutoff
            ]
            
            with open(self.metrics_file, 'w') as f:
                json.dump(history, f, indent=2)
                
        except Exception as e:
            logger.error(f"Failed to save metrics: {e}")
