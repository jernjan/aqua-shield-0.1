"""
Outbreak Risk Predictor - Predicts facility infection risk for next 7 days

Uses rule-based model with factors:
- Distance to infected facilities
- Time since last boat visit
- Number of boat visits in zone
- Quarantine status
- Disease type weights

Future: Can be swapped with ML (scikit-learn) model as historical data grows.
"""

from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
import math
import json
import os


@dataclass
class FacilityPrediction:
    """Outbreak risk prediction for a facility"""
    facility_name: str
    facility_code: str
    latitude: float
    longitude: float
    outbreak_risk_pct: float  # 0-100: Calibrated probability next 30 days
    risk_level: str  # "Low" (<10%), "Medium" (10-25%), "Critical" (>25%)
    primary_disease: str  # Highest risk disease at this facility
    days_until_critical: Optional[int]  # If trend indicates critical, how many days
    factors: Dict[str, float]  # Breakdown of contributing factors
    risk_drivers: List[Tuple[str, float]]  # Ranked factors (factor_name, contribution_%)
    prediction_date: str
    confidence_score: float = 0.85  # 0-1: Data quality and model certainty
    confidence_level: str = "High"  # "High" (>0.8), "Medium" (0.5-0.8), "Low" (<0.5)
    trend_7d: Optional[str] = None  # "increasing", "stable", "decreasing"
    trend_pct: Optional[float] = None  # Change in risk % over past 30 days
    # Source facility info (where threat comes from)
    source_facility_name: Optional[str] = None
    source_facility_code: Optional[str] = None
    source_latitude: Optional[float] = None
    source_longitude: Optional[float] = None
    distance_to_nearest_infected: Optional[float] = None  # km


class OutbreakRiskPredictor:
    """
    Rule-based outbreak risk prediction for aquaculture facilities.
    
    Model: risk_score = sum of weighted factors
    
    Weights by disease type (relative importance of disease for risk):
    - ILA: 2.5 (highly contagious, rapid spread, forced slaughter)
    - PD: 2.0 (endemic in Mid-Norway, spreads via boat, economic impact)
    - Francisellose: 1.2 (local spread, lower mortality)
    - BKD: 1.0 (slow spread, lower economic impact)
    - Lus: 0.6 (chronic, handled by traffic light system)
    """
    
    # Disease weights (higher = more contagious / impactful)
    DISEASE_WEIGHTS = {
        "ILA": 2.5,
        "INFEKSIØS LAKSEANEMI": 2.5,
        "INFEKCIOS LAKSEANEMI": 2.5,
        "PD": 2.0,
        "PANKREASSYKDOM": 2.0,
        "SAV": 2.0,
        "FRANCISELLOSE": 1.2,
        "FRANCISELLOSIS": 1.2,
        "BKD": 1.0,
        "BAKTERIELL NYRESYKE": 1.0,
        "LUS": 0.6,
        "LICE": 0.6,
    }

    # Calibrated probability curve for 30-day outbreak risk.
    PROB_MIN = 0.01
    PROB_MAX = 0.55
    PROB_K = 7.0
    PROB_MID = 0.5
    MEDIUM_THRESHOLD = 0.10
    CRITICAL_THRESHOLD = 0.25
    
    def __init__(self, ocean_client=None):
        """Initialize predictor
        
        Args:
            ocean_client: Optional CMEMSClient for ocean current data integration
        """
        self.predictions_cache_file = "src/api/data/predictions_cache.json"
        self.historical_file = "src/api/data/predictions_history.json"
        self.ocean_client = ocean_client
        os.makedirs(os.path.dirname(self.predictions_cache_file), exist_ok=True)
        os.makedirs(os.path.dirname(self.historical_file), exist_ok=True)

    def _normalize_facility_name(self, name: str) -> str:
        if not isinstance(name, str):
            return name
        if "\u00c3" not in name:
            return name
        try:
            fixed = name.encode("latin1").decode("utf-8")
            return fixed if "\u00c3" not in fixed else name
        except (UnicodeEncodeError, UnicodeDecodeError):
            return name
    
    def get_disease_weight(self, disease_name: Optional[str]) -> float:
        """Get weight multiplier for a disease (higher = more contagious)"""
        if not disease_name:
            return 1.0
        
        disease_upper = str(disease_name).upper().strip()
        
        # Try exact match first
        if disease_upper in self.DISEASE_WEIGHTS:
            return self.DISEASE_WEIGHTS[disease_upper]
        
        # Try partial match
        for disease_key, weight in self.DISEASE_WEIGHTS.items():
            if disease_key in disease_upper or disease_upper in disease_key:
                return weight
        
        # Default weight for unknown diseases
        return 1.0

    def _calibrate_probability(self, raw_score: float) -> float:
        raw_score = max(0.0, min(1.0, raw_score))
        curve = 1.0 / (1.0 + math.exp(-self.PROB_K * (raw_score - self.PROB_MID)))
        return self.PROB_MIN + (self.PROB_MAX - self.PROB_MIN) * curve
    
    def calculate_distance_risk(self, distance_km: float) -> float:
        """
        Calculate risk factor from distance to infected facility.
        
        Exponential falloff: e^(-distance/5km)
        Rationale: Infection spreads via water currents (typical 5km influence zone)
        
        Returns: 0-1.0 (0 = no risk, 1.0 = maximum risk at 0km)
        """
        if distance_km < 0:
            return 0.0
        if distance_km == 0:
            return 1.0
        
        # Exponential falloff with 5km characteristic distance
        risk = math.exp(-distance_km / 5.0)
        return min(1.0, risk)
    
    def calculate_time_since_visit_risk(self, hours_since_last_visit: Optional[float]) -> float:
        """
        Calculate risk from time since last boat visit.
        
        Pathogen survival in water:
        - <48h: 1.0 (high risk, pathogens still viable)
        - 48-72h: 0.7
        - 72h-1week: 0.3
        - >1week: 0.05
        
        Returns: 0-1.0
        """
        if hours_since_last_visit is None or hours_since_last_visit < 0:
            return 0.0
        
        if hours_since_last_visit < 48:
            return 1.0
        elif hours_since_last_visit < 72:
            return 0.7
        elif hours_since_last_visit < 168:  # 7 days
            return 0.3
        else:
            return 0.05
    
    def calculate_boat_visit_risk(self, normal_visits_7d: int = 0, quarantine_visits_7d: int = 0) -> float:
        """
        Calculate risk from number of boat visits in last 7 days.
        
        Differentiates between:
        - Normal boats: regular transmission risk
        - Quarantine boats: 3x higher weight (confirmed high-risk vectors)
        
        More visits = cumulative transmission risk
        Uses logarithmic scale with quarantine multiplier
        
        Args:
            normal_visits_7d: Visits from normal/cleared boats
            quarantine_visits_7d: Visits from boats under quarantine (3x weight)
        
        Returns: 0-1.0
        """
        if normal_visits_7d <= 0 and quarantine_visits_7d <= 0:
            return 0.0
        
        # Quarantine boats count as 3x (higher transmission risk)
        weighted_visits = normal_visits_7d + (quarantine_visits_7d * 3)
        
        # Logarithmic scale (1 visit = 0.69, 3 visits = 1.39, 10 visits = 2.40)
        risk = math.log(1 + weighted_visits) / math.log(10)  # Normalize to 0-1
        return min(1.0, risk)
    
    def calculate_quarantine_factor(self, is_in_quarantine: bool) -> float:
        """
        Apply quarantine reduction factor.
        
        If facility confirmed in quarantine:
        - Risk reduced by 80%
        
        Returns: 0-1.0 multiplier
        """
        if is_in_quarantine:
            return 0.2  # 80% risk reduction
        return 1.0
    
    def predict_facility_outbreak(
        self,
        facility_name: str,
        facility_code: str,
        latitude: float,
        longitude: float,
        current_diseases: List[str],
        distance_to_nearest_infected_km: Optional[float],
        boat_visits_7d: int,
        hours_since_last_boat_visit: Optional[float],
        is_in_quarantine: bool = False,
        last_visit_date: Optional[str] = None,
        nearest_infected_coords: Optional[Tuple[float, float]] = None,
        quarantine_boat_visits_7d: int = 0,
    ) -> FacilityPrediction:
        """
        Predict outbreak risk for a facility.
        
        Args:
            facility_name: Name of the facility
            facility_code: Facility code (barentswatch identifier)
            latitude, longitude: Geo coordinates
            current_diseases: List of diseases present at facility
            distance_to_nearest_infected_km: km to nearest infected facility (or None)
            boat_visits_7d: Number of boat visits from normal/cleared boats in last 7 days
            quarantine_boat_visits_7d: Number of boat visits from boats under quarantine (3x weight)
            hours_since_last_boat_visit: Hours since last visit (or None)
            is_in_quarantine: Whether facility has confirmed quarantine
            last_visit_date: ISO date string of last visit
        
        Returns:
            FacilityPrediction with risk percentage and factors
        """
        
        # Initialize factor scores
        factors = {}
        contributions = []
        
        # 1. DISTANCE TO INFECTED FACILITY (30% importance - reduced to make room for currents)
        distance_risk = 0.0
        if distance_to_nearest_infected_km is not None and distance_to_nearest_infected_km >= 0:
            distance_risk = self.calculate_distance_risk(distance_to_nearest_infected_km)
            factors["distance_to_infected"] = distance_risk
            contributions.append(("distance_to_nearest_infected", 30))
        else:
            factors["distance_to_infected"] = 0.0
        
        # 2. TIME SINCE LAST VISIT (32% importance - reduced)
        time_risk = 0.0
        if hours_since_last_boat_visit is not None and hours_since_last_boat_visit >= 0:
            time_risk = self.calculate_time_since_visit_risk(hours_since_last_boat_visit)
            factors["time_since_visit"] = time_risk
            contributions.append(("time_since_last_boat_visit", 32))
        else:
            factors["time_since_visit"] = 0.0
        
        # 3. NUMBER OF BOAT VISITS (23% importance - reduced)
        # Split between normal and quarantine boats
        normal_visits = boat_visits_7d  # Provided as separate parameter
        visit_risk = 0.0
        if boat_visits_7d > 0 or quarantine_boat_visits_7d > 0:
            visit_risk = self.calculate_boat_visit_risk(
                normal_visits_7d=normal_visits,
                quarantine_visits_7d=quarantine_boat_visits_7d
            )
            factors["boat_visits_7d"] = visit_risk
            factors["quarantine_boats"] = quarantine_boat_visits_7d  # Track separately
            contributions.append(("number_of_boat_visits", 23))
            if quarantine_boat_visits_7d > 0:
                contributions.append(("quarantine_boat_visits_3x_weight", 0))  # Already in boat_visits score
        else:
            factors["boat_visits_7d"] = 0.0
            factors["quarantine_boats"] = 0
        
        # 4. OCEAN CURRENT RISK (15% importance - NEW!)
        current_risk = 0.0
        if (nearest_infected_coords and 
            distance_to_nearest_infected_km is not None and 
            distance_to_nearest_infected_km > 0):
            infected_lat, infected_lon = nearest_infected_coords
            current_risk = self.calculate_ocean_current_risk(
                latitude, longitude,
                infected_lat, infected_lon,
                distance_to_nearest_infected_km
            )
            if current_risk > 0:
                factors["ocean_current_risk"] = current_risk
                contributions.append(("ocean_current_alignment", 15))
        else:
            factors["ocean_current_risk"] = 0.0
        
        # 5. DISEASE TYPE WEIGHT
        # Get highest weight disease at this facility
        disease_weight = 1.0
        primary_disease = "Unknown"
        
        if current_diseases and len(current_diseases) > 0:
            disease_weights = []
            for disease in current_diseases:
                weight = self.get_disease_weight(disease)
                disease_weights.append((disease, weight))
            
            if disease_weights:
                primary_disease, disease_weight = max(disease_weights, key=lambda x: x[1])
        
        factors["disease_weight"] = disease_weight
        
        # 6. QUARANTINE STATUS (80% reduction if active)
        quarantine_factor = self.calculate_quarantine_factor(is_in_quarantine)
        factors["quarantine_factor"] = quarantine_factor
        
        # COMBINED SCORE CALCULATION
        # Weighted sum of components (normalized to 0-1)
        base_risk = (
            (distance_risk * 0.30) +
            (time_risk * 0.32) +
            (visit_risk * 0.23) +
            (current_risk * 0.15)
        )  # Result is 0-1
        
        # Scale by disease weight but normalize
        # Divide by max disease weight so scale stays reasonable
        max_weight = max(self.DISEASE_WEIGHTS.values(), default=1.0)
        scaled_risk = base_risk * disease_weight / max_weight
        
        # Apply quarantine reduction (gets closer to 0 if quarantined)
        final_risk = scaled_risk * quarantine_factor
        
        # Final normalization to 0-1 range for sigmoid
        raw_score = max(0.0, min(1.0, final_risk))
        probability = self._calibrate_probability(raw_score)
        outbreak_risk_pct = probability * 100.0
        
        # Determine risk level
        if probability >= self.CRITICAL_THRESHOLD:
            risk_level = "Critical"
        elif probability >= self.MEDIUM_THRESHOLD:
            risk_level = "Medium"
        else:
            risk_level = "Low"
        
        # Calculate confidence score based on data availability
        # Confidence = boat visits + disease data quality + distance data quality
        confidence_base = 0.70
        total_boat_visits = boat_visits_7d + quarantine_boat_visits_7d
        if total_boat_visits > 0:
            confidence_base += 0.10
        if current_diseases and len(current_diseases) > 0:
            confidence_base += 0.10
        if distance_to_nearest_infected_km and distance_to_nearest_infected_km < 100:
            confidence_base += 0.05
        
        confidence_score = min(0.95, max(0.50, confidence_base))
        if confidence_score >= 0.80:
            confidence_level = "High"
        elif confidence_score >= 0.65:
            confidence_level = "Medium"
        else:
            confidence_level = "Low"
        
        # Get trend from historical data
        trend_7d = None
        trend_pct = None
        prev_risk = self._get_previous_risk(facility_code)
        if prev_risk is not None:
            trend_pct = outbreak_risk_pct - prev_risk
            if trend_pct > 2:  # More than 2% increase
                trend_7d = "increasing"
            elif trend_pct < -2:  # More than 2% decrease
                trend_7d = "decreasing"
            else:
                trend_7d = "stable"
        
        # Estimate days until critical (if trending up)
        days_until_critical = None
        if probability < self.CRITICAL_THRESHOLD and probability > 0.20:
            # If moderate and have a recent visit, estimate 3-5 days
            if hours_since_last_boat_visit is not None and hours_since_last_boat_visit < 72:
                days_until_critical = 3 + int((72 - hours_since_last_boat_visit) / 48)
        
        # Sort contributions by importance
        contributions_sorted = sorted(contributions, key=lambda x: x[1], reverse=True)
        risk_drivers = contributions_sorted
        
        return FacilityPrediction(
            facility_name=facility_name,
            facility_code=facility_code,
            latitude=latitude,
            longitude=longitude,
            outbreak_risk_pct=round(outbreak_risk_pct, 1),
            risk_level=risk_level,
            primary_disease=primary_disease,
            days_until_critical=days_until_critical,
            factors={
                k: (
                    round(v, 2)
                    if k in {"disease_weight", "quarantine_factor"}
                    else round(v * 100, 1)
                )
                if isinstance(v, float)
                else v
                for k, v in factors.items()
            },
            risk_drivers=risk_drivers,
            prediction_date=datetime.now().isoformat(),
            confidence_score=round(confidence_score, 2),
            confidence_level=confidence_level,
            trend_7d=trend_7d,
            trend_pct=round(trend_pct, 1) if trend_pct else None,
        )
    
    def _get_previous_risk(self, facility_code: int) -> Optional[float]:
        """Get previous risk % from history for trend calculation"""
        try:
            if os.path.exists(self.historical_file):
                with open(self.historical_file, 'r') as f:
                    history = json.load(f)
                # Get the most recent entry for this facility (not today)
                if isinstance(history, dict) and str(facility_code) in history:
                    records = history[str(facility_code)]
                    if isinstance(records, list) and len(records) > 0:
                        return records[-1].get('risk_pct')
        except Exception:
            pass
        return None
    
    def save_predictions(self, predictions: List[FacilityPrediction]) -> None:
        """Save predictions to cache file for admin dashboard"""
        prediction_dicts = []
        for p in predictions:
            item = asdict(p)
            item["facility_name"] = self._normalize_facility_name(item.get("facility_name"))
            prediction_dicts.append(item)

        data = {
            "timestamp": datetime.now().isoformat(),
            "predictions": prediction_dicts,
            "summary": {
                "total_facilities": len(predictions),
                "critical": len([p for p in predictions if p.risk_level == "Critical"]),
                "medium": len([p for p in predictions if p.risk_level == "Medium"]),
                "low": len([p for p in predictions if p.risk_level == "Low"]),
            }
        }
        
        os.makedirs(os.path.dirname(self.predictions_cache_file), exist_ok=True)
        with open(self.predictions_cache_file, 'w') as f:
            json.dump(data, f, indent=2)
        
        # Also save to history for trend tracking
        try:
            history = {}
            if os.path.exists(self.historical_file):
                with open(self.historical_file, 'r') as f:
                    history = json.load(f)
            
            today = datetime.now().strftime("%Y-%m-%d")
            for pred in prediction_dicts:
                code = str(pred.get("facility_code", ""))
                if code not in history:
                    history[code] = []
                # Only add one entry per day per facility
                if not any(rec.get("date") == today for rec in history[code]):
                    history[code].append({
                        "date": today,
                        "risk_pct": pred.get("outbreak_risk_pct"),
                        "risk_level": pred.get("risk_level")
                    })
            
            os.makedirs(os.path.dirname(self.historical_file), exist_ok=True)
            with open(self.historical_file, 'w') as f:
                json.dump(history, f, indent=2)
        except Exception as e:
            print(f"Warning: Could not save history: {e}")
    
    def load_predictions(self) -> Dict:
        """Load last predictions from cache"""
        if os.path.exists(self.predictions_cache_file):
            with open(self.predictions_cache_file, 'r') as f:
                data = json.load(f)
            preds = data.get("predictions", []) if isinstance(data, dict) else []
            for item in preds if isinstance(preds, list) else []:
                if isinstance(item, dict):
                    item["facility_name"] = self._normalize_facility_name(item.get("facility_name"))
            return data
        return {"predictions": [], "summary": {}}
