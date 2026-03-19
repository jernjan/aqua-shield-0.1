"""Machine Learning engine for predictive risk modeling and anomaly detection."""

import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
import warnings
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import IsolationForest
import logging

logger = logging.getLogger(__name__)

# Suppress statsmodels warnings
warnings.filterwarnings('ignore')

try:
    from statsmodels.tsa.arima.model import ARIMA
    from statsmodels.tsa.stattools import adfuller
    STATSMODELS_AVAILABLE = True
except ImportError:
    STATSMODELS_AVAILABLE = False
    logger.warning("statsmodels not available - ARIMA forecasting disabled")


@dataclass
class RiskPrediction:
    """Risk prediction for a facility."""
    facility_id: int
    facility_name: str
    forecast_date: str
    predicted_risk_score: float
    risk_level: str
    confidence_lower: float
    confidence_upper: float
    confidence_level: float  # 0.95 = 95% CI
    days_ahead: int
    model_type: str


@dataclass
class AnomalyRecord:
    """Detected anomaly in lice population or disease."""
    facility_id: int
    facility_name: str
    detection_date: str
    anomaly_type: str  # 'lice_spike', 'disease_surge', 'unexpected_jump'
    severity_score: float  # 0-100
    baseline_value: float
    observed_value: float
    deviation_percent: float
    recommended_action: str


@dataclass
class OutbreakForecast:
    """Outbreak probability forecast."""
    facility_id: int
    facility_name: str
    forecast_date: str
    outbreak_probability: float  # 0-1
    risk_factors_contributing: List[str]
    days_to_critical: Optional[int]  # Days until high-risk threshold
    recommended_interventions: List[str]


class MLEngine:
    """Machine Learning engine for predictive risk analysis."""
    
    def __init__(self, db_manager=None):
        """Initialize ML engine.
        
        Args:
            db_manager: DatabaseManager instance for data retrieval
        """
        self.db_manager = db_manager
        self.scaler = StandardScaler()
        self.isolation_forest = IsolationForest(contamination=0.1, random_state=42)
        self.model_cache = {}  # Cache trained models
        
    # ========== PREDICTIVE RISK MODEL ==========
    
    def predict_risk_arima(
        self,
        facility_id: int,
        facility_name: str,
        historical_data: List[Dict[str, Any]],
        forecast_days: int = 21,
        confidence_level: float = 0.95
    ) -> List[RiskPrediction]:
        """Predict risk using ARIMA time-series model.
        
        Args:
            facility_id: Facility ID
            facility_name: Facility name
            historical_data: List of risk assessments with dates and scores
            forecast_days: Days to forecast (default 21 = 3 weeks)
            confidence_level: Confidence interval level (0.95 = 95%)
            
        Returns:
            List of RiskPrediction objects
        """
        if not STATSMODELS_AVAILABLE:
            logger.error("statsmodels not available for ARIMA forecasting")
            return []
        
        if len(historical_data) < 7:
            logger.warning(f"Insufficient data for facility {facility_id}: {len(historical_data)} records")
            return []
        
        try:
            # Prepare data
            df = pd.DataFrame([
                {
                    'date': pd.to_datetime(d.get('assessment_date') or d.get('date')),
                    'risk_score': float(d.get('risk_score', 0))
                }
                for d in historical_data
            ])
            
            df = df.sort_values('date')
            df = df.drop_duplicates(subset=['date'], keep='first')
            
            if len(df) < 7:
                logger.warning(f"After dedup, insufficient data for facility {facility_id}")
                return []
            
            # Use risk scores as the time series
            ts = df['risk_score'].values
            
            # Fit ARIMA model (p, d, q) = (1, 1, 1) as default
            # Try to auto-detect parameters based on data characteristics
            try:
                model = ARIMA(ts, order=(1, 1, 1))
                fitted_model = model.fit()
            except:
                # Fallback to simpler model if fitting fails
                model = ARIMA(ts, order=(0, 1, 0))
                fitted_model = model.fit()
            
            # Generate predictions
            forecast_result = fitted_model.get_forecast(steps=forecast_days)
            forecast_mean = forecast_result.predicted_mean
            forecast_ci = forecast_result.conf_int(alpha=1-confidence_level)
            
            predictions = []
            last_date = df['date'].iloc[-1]
            
            for i in range(forecast_days):
                forecast_date = last_date + timedelta(days=i+1)
                pred_score = float(forecast_mean.iloc[i])
                # Clamp to valid range [0, 100]
                pred_score = max(0, min(100, pred_score))
                
                ci_lower = float(forecast_ci.iloc[i, 0])
                ci_upper = float(forecast_ci.iloc[i, 1])
                ci_lower = max(0, min(100, ci_lower))
                ci_upper = max(0, min(100, ci_upper))
                
                # Determine risk level
                if pred_score >= 70:
                    risk_level = "CRITICAL"
                elif pred_score >= 50:
                    risk_level = "HIGH"
                elif pred_score >= 30:
                    risk_level = "MEDIUM"
                else:
                    risk_level = "LOW"
                
                pred = RiskPrediction(
                    facility_id=facility_id,
                    facility_name=facility_name,
                    forecast_date=forecast_date.strftime("%Y-%m-%d"),
                    predicted_risk_score=round(pred_score, 2),
                    risk_level=risk_level,
                    confidence_lower=round(ci_lower, 2),
                    confidence_upper=round(ci_upper, 2),
                    confidence_level=confidence_level,
                    days_ahead=i+1,
                    model_type="ARIMA(1,1,1)"
                )
                predictions.append(pred)
            
            logger.info(f"Generated {len(predictions)} ARIMA predictions for facility {facility_id}")
            return predictions
            
        except Exception as e:
            logger.error(f"ARIMA prediction failed for facility {facility_id}: {e}")
            return []
    
    def predict_risk_exponential_smoothing(
        self,
        facility_id: int,
        facility_name: str,
        historical_data: List[Dict[str, Any]],
        forecast_days: int = 21,
        alpha: float = 0.3
    ) -> List[RiskPrediction]:
        """Predict risk using exponential smoothing (simpler alternative to ARIMA).
        
        Args:
            facility_id: Facility ID
            facility_name: Facility name
            historical_data: Historical risk assessments
            forecast_days: Days to forecast
            alpha: Smoothing parameter (0-1)
            
        Returns:
            List of RiskPrediction objects
        """
        if len(historical_data) < 3:
            return []
        
        try:
            # Prepare data
            df = pd.DataFrame([
                {
                    'date': pd.to_datetime(d.get('assessment_date') or d.get('date')),
                    'risk_score': float(d.get('risk_score', 0))
                }
                for d in historical_data
            ])
            
            df = df.sort_values('date')
            ts = df['risk_score'].values
            
            # Exponential smoothing
            smoothed = [ts[0]]
            for i in range(1, len(ts)):
                smoothed.append(alpha * ts[i] + (1 - alpha) * smoothed[i-1])
            
            # Forecast: assume trend continues (simple last value forecast with slight dampening)
            last_smoothed = smoothed[-1]
            trend = smoothed[-1] - smoothed[-2] if len(smoothed) > 1 else 0
            trend *= 0.95  # Dampen trend
            
            predictions = []
            last_date = df['date'].iloc[-1]
            
            for i in range(forecast_days):
                forecast_date = last_date + timedelta(days=i+1)
                # Predicted value with trend
                pred_score = last_smoothed + (trend * (i + 1) * 0.5)
                pred_score = max(0, min(100, pred_score))
                
                # Uncertainty increases with forecast horizon
                uncertainty = 5 + (2 * i)
                ci_lower = max(0, pred_score - uncertainty)
                ci_upper = min(100, pred_score + uncertainty)
                
                # Determine risk level
                if pred_score >= 70:
                    risk_level = "CRITICAL"
                elif pred_score >= 50:
                    risk_level = "HIGH"
                elif pred_score >= 30:
                    risk_level = "MEDIUM"
                else:
                    risk_level = "LOW"
                
                pred = RiskPrediction(
                    facility_id=facility_id,
                    facility_name=facility_name,
                    forecast_date=forecast_date.strftime("%Y-%m-%d"),
                    predicted_risk_score=round(pred_score, 2),
                    risk_level=risk_level,
                    confidence_lower=round(ci_lower, 2),
                    confidence_upper=round(ci_upper, 2),
                    confidence_level=0.95,
                    days_ahead=i+1,
                    model_type="ExponentialSmoothing"
                )
                predictions.append(pred)
            
            return predictions
            
        except Exception as e:
            logger.error(f"Exponential smoothing prediction failed: {e}")
            return []
    
    # ========== ANOMALY DETECTION ==========
    
    def detect_anomalies(
        self,
        facility_id: int,
        facility_name: str,
        historical_data: List[Dict[str, Any]],
        lice_data: List[Dict[str, Any]],
        sensitivity: float = 0.1
    ) -> List[AnomalyRecord]:
        """Detect anomalies in lice levels and disease data.
        
        Args:
            facility_id: Facility ID
            facility_name: Facility name
            historical_data: Historical risk assessments
            lice_data: Historical lice counts
            sensitivity: Anomaly sensitivity (0.05-0.20, lower = more sensitive)
            
        Returns:
            List of detected anomalies
        """
        anomalies = []
        
        if not lice_data or len(lice_data) < 5:
            return anomalies
        
        try:
            # Prepare lice level data
            df = pd.DataFrame([
                {
                    'date': pd.to_datetime(d.get('date') or d.get('detected_date')),
                    'lice_count': float(d.get('lice_count') or d.get('adult_female_lice', 0))
                }
                for d in lice_data
            ])
            
            df = df.sort_values('date')
            df = df.drop_duplicates(subset=['date'], keep='last')
            
            if len(df) < 5:
                return anomalies
            
            # Get lice counts
            lice_counts = df['lice_count'].values
            
            # Calculate rolling statistics
            window = min(7, len(lice_counts) // 2)  # 7-day rolling or shorter
            rolling_mean = pd.Series(lice_counts).rolling(window=window, center=True).mean()
            rolling_std = pd.Series(lice_counts).rolling(window=window, center=True).std()
            
            # Detect spikes using statistical method
            for i in range(len(lice_counts)):
                if i < window or pd.isna(rolling_mean.iloc[i]):
                    continue
                
                baseline = rolling_mean.iloc[i]
                std_dev = rolling_std.iloc[i] if not pd.isna(rolling_std.iloc[i]) else 1
                threshold = baseline + (2 * std_dev)  # 2-sigma threshold
                
                if lice_counts[i] > threshold and lice_counts[i] > baseline * 1.5:
                    deviation = ((lice_counts[i] - baseline) / (baseline + 1)) * 100
                    severity = min(100, 30 + (deviation / 10))  # Scale 30-100
                    
                    anomaly = AnomalyRecord(
                        facility_id=facility_id,
                        facility_name=facility_name,
                        detection_date=df['date'].iloc[i].strftime("%Y-%m-%d"),
                        anomaly_type="lice_spike",
                        severity_score=round(severity, 1),
                        baseline_value=round(baseline, 2),
                        observed_value=round(float(lice_counts[i]), 2),
                        deviation_percent=round(deviation, 1),
                        recommended_action="Increase monitoring frequency and consider treatment intervention"
                    )
                    anomalies.append(anomaly)
            
            # Detect trend changes (sudden increase rate)
            if len(lice_counts) >= 7:
                recent_trend = np.mean(np.diff(lice_counts[-7:]))
                historical_trend = np.mean(np.diff(lice_counts[:-7])) if len(lice_counts) > 14 else 0
                
                if recent_trend > historical_trend * 2 and recent_trend > 0:
                    anomaly = AnomalyRecord(
                        facility_id=facility_id,
                        facility_name=facility_name,
                        detection_date=datetime.now().strftime("%Y-%m-%d"),
                        anomaly_type="unexpected_jump",
                        severity_score=50.0,
                        baseline_value=round(float(lice_counts[-7]), 2),
                        observed_value=round(float(lice_counts[-1]), 2),
                        deviation_percent=round((recent_trend / max(1, historical_trend)) * 100 - 100, 1),
                        recommended_action="Acceleration in lice growth detected - review treatment protocols"
                    )
                    anomalies.append(anomaly)
            
            logger.info(f"Detected {len(anomalies)} anomalies for facility {facility_id}")
            return anomalies
            
        except Exception as e:
            logger.error(f"Anomaly detection failed for facility {facility_id}: {e}")
            return []
    
    # ========== OUTBREAK FORECASTING ==========
    
    def forecast_outbreak(
        self,
        facility_id: int,
        facility_name: str,
        current_risk_score: float,
        historical_data: List[Dict[str, Any]],
        nearby_disease_count: int = 0,
        vessel_exposure_events: int = 0
    ) -> OutbreakForecast:
        """Forecast probability of outbreak in coming weeks.
        
        Args:
            facility_id: Facility ID
            facility_name: Facility name
            current_risk_score: Current risk score (0-100)
            historical_data: Historical risk assessments
            nearby_disease_count: Number of diseased facilities nearby
            vessel_exposure_events: Recent vessel exposure incidents
            
        Returns:
            OutbreakForecast object
        """
        contributing_factors = []
        
        try:
            # Factor 1: Current risk level
            risk_contribution = current_risk_score / 100.0
            if current_risk_score >= 70:
                contributing_factors.append("High current risk score")
            
            # Factor 2: Trend analysis
            if len(historical_data) >= 7:
                df = pd.DataFrame([
                    {
                        'date': pd.to_datetime(d.get('assessment_date') or d.get('date')),
                        'risk_score': float(d.get('risk_score', 0))
                    }
                    for d in historical_data[-14:]  # Last 2 weeks
                ])
                df = df.sort_values('date')
                ts = df['risk_score'].values
                
                trend = np.mean(np.diff(ts))
                if trend > 2:  # Risk increasing by >2 points per day
                    risk_contribution += 0.2
                    contributing_factors.append("Rapid risk increase trend")
            
            # Factor 3: Disease proximity
            disease_factor = min(0.3, nearby_disease_count * 0.1)
            risk_contribution += disease_factor
            if nearby_disease_count > 0:
                contributing_factors.append(f"{nearby_disease_count} nearby diseased facilities")
            
            # Factor 4: Vessel exposure
            exposure_factor = min(0.2, vessel_exposure_events * 0.05)
            risk_contribution += exposure_factor
            if vessel_exposure_events > 0:
                contributing_factors.append(f"{vessel_exposure_events} recent vessel exposure incidents")
            
            # Calculate final outbreak probability
            outbreak_probability = min(1.0, risk_contribution)
            
            # Estimate days to critical (risk >= 70)
            days_to_critical = None
            if outbreak_probability >= 0.3:
                # Estimate based on current trend
                if len(historical_data) >= 7:
                    daily_increase = trend if 'trend' in locals() else 0.5
                    days_to_70 = max(0, (70 - current_risk_score) / max(0.1, daily_increase))
                    days_to_critical = min(14, int(days_to_70)) if days_to_70 > 0 else None
            
            # Recommended interventions
            interventions = self._get_interventions(
                outbreak_probability,
                current_risk_score,
                contributing_factors
            )
            
            forecast = OutbreakForecast(
                facility_id=facility_id,
                facility_name=facility_name,
                forecast_date=datetime.now().strftime("%Y-%m-%d"),
                outbreak_probability=round(outbreak_probability, 3),
                risk_factors_contributing=contributing_factors,
                days_to_critical=days_to_critical,
                recommended_interventions=interventions
            )
            
            logger.info(f"Outbreak forecast for facility {facility_id}: {outbreak_probability:.1%} probability")
            return forecast
            
        except Exception as e:
            logger.error(f"Outbreak forecasting failed for facility {facility_id}: {e}")
            # Return neutral forecast on error
            return OutbreakForecast(
                facility_id=facility_id,
                facility_name=facility_name,
                forecast_date=datetime.now().strftime("%Y-%m-%d"),
                outbreak_probability=0.0,
                risk_factors_contributing=[],
                days_to_critical=None,
                recommended_interventions=["Unable to forecast - insufficient data"]
            )
    
    def _get_interventions(
        self,
        outbreak_probability: float,
        current_risk: float,
        risk_factors: List[str]
    ) -> List[str]:
        """Get recommended interventions based on outbreak probability.
        
        Args:
            outbreak_probability: Probability 0-1
            current_risk: Current risk score
            risk_factors: List of contributing factors
            
        Returns:
            List of recommended actions
        """
        interventions = []
        
        if outbreak_probability >= 0.7:
            interventions.append("URGENT: Activate emergency response protocols")
            interventions.append("Coordinate with veterinary authorities")
            interventions.append("Prepare for possible culling or treatment")
        elif outbreak_probability >= 0.5:
            interventions.append("Increase lice treatment frequency")
            interventions.append("Enhance monitoring - daily lice counts recommended")
            interventions.append("Review and strengthen biosecurity measures")
        elif outbreak_probability >= 0.3:
            interventions.append("Continue regular monitoring and assessments")
            interventions.append("Prepare contingency response plans")
            interventions.append("Improve water quality management")
        else:
            interventions.append("Maintain standard monitoring protocols")
            interventions.append("Document conditions for future reference")
        
        # Factor-specific interventions
        if "vessel" in " ".join(risk_factors).lower():
            interventions.append("Increase vessel movement tracking and notifications")
        
        if "disease" in " ".join(risk_factors).lower():
            interventions.append("Enforce strict biosecurity protocols")
            interventions.append("Consider temporary isolation measures")
        
        if current_risk >= 80:
            interventions.append("Notify regional health authorities immediately")
        
        return interventions[:5]  # Limit to top 5 recommendations
    
    # ========== RECOMMENDATION ENGINE ==========
    
    def get_recommendations(
        self,
        facility_id: int,
        facility_name: str,
        current_risk_score: float,
        risk_factors: Dict[str, Optional[float]],
        historical_data: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Generate comprehensive recommendations for a facility.
        
        Args:
            facility_id: Facility ID
            facility_name: Facility name
            current_risk_score: Current risk score
            risk_factors: Dict of individual risk factors
            historical_data: Historical risk assessments
            
        Returns:
            Dict with recommendations and rationale
        """
        recommendations = {
            "facility_id": facility_id,
            "facility_name": facility_name,
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "current_risk_score": round(current_risk_score, 2),
            "priority_level": self._get_priority_level(current_risk_score),
            "immediate_actions": [],
            "short_term_actions": [],  # Next 1-2 weeks
            "medium_term_actions": [],  # 1-4 weeks
            "monitoring_recommendations": [],
            "estimated_impact": {}
        }
        
        # Analyze each risk factor
        factors_analysis = self._analyze_risk_factors(risk_factors, current_risk_score)
        
        # Generate specific recommendations
        for factor, analysis in factors_analysis.items():
            if analysis["severity"] == "critical":
                recommendations["immediate_actions"].extend(analysis["actions"])
            elif analysis["severity"] == "high":
                recommendations["short_term_actions"].extend(analysis["actions"])
            else:
                recommendations["medium_term_actions"].extend(analysis["actions"])
        
        # Add trend-based recommendations
        if len(historical_data) >= 7:
            trend_recs = self._get_trend_based_recommendations(historical_data)
            recommendations["short_term_actions"].extend(trend_recs)
        
        # Add monitoring recommendations
        recommendations["monitoring_recommendations"] = [
            "Daily lice count monitoring at current risk level",
            "Water quality assessment 2x weekly",
            "Fish health observations - watch for ILA/PD symptoms",
            "Vessel movement notifications - alert on proximity events"
        ]
        
        # Estimate impact of recommendations
        recommendations["estimated_impact"] = {
            "risk_reduction_if_actions_taken": f"{min(100, current_risk_score * 0.3):.0f}%",
            "timeline_to_improvement": "2-4 weeks",
            "success_probability_with_compliance": 0.85
        }
        
        return recommendations
    
    def _get_priority_level(self, risk_score: float) -> str:
        """Get priority level from risk score."""
        if risk_score >= 80:
            return "CRITICAL"
        elif risk_score >= 60:
            return "HIGH"
        elif risk_score >= 40:
            return "MEDIUM"
        else:
            return "LOW"
    
    def _analyze_risk_factors(
        self,
        risk_factors: Dict[str, Optional[float]],
        current_risk: float
    ) -> Dict[str, Dict[str, Any]]:
        """Analyze individual risk factors and generate recommendations."""
        analysis = {}
        
        # Disease proximity analysis
        if risk_factors.get('disease_proximity') is not None:
            proximity_score = risk_factors['disease_proximity']
            if proximity_score > 70:
                analysis['disease_proximity'] = {
                    "severity": "critical",
                    "actions": [
                        "Activate daily disease surveillance protocol",
                        "Establish emergency communication with nearby farms",
                        "Review and reinforce biosecurity measures",
                        "Prepare isolation facilities if available"
                    ]
                }
            elif proximity_score > 50:
                analysis['disease_proximity'] = {
                    "severity": "high",
                    "actions": [
                        "Increase monitoring frequency - at least 3x weekly",
                        "Brief staff on disease recognition and reporting",
                        "Maintain enhanced biosecurity protocols"
                    ]
                }
            else:
                analysis['disease_proximity'] = {
                    "severity": "low",
                    "actions": ["Continue standard disease surveillance"]
                }
        
        # Lice level analysis
        if risk_factors.get('lice_level') is not None:
            lice_score = risk_factors['lice_level']
            if lice_score > 70:
                analysis['lice_level'] = {
                    "severity": "critical",
                    "actions": [
                        "Emergency lice treatment protocol required",
                        "Increase treatment frequency to 2x weekly",
                        "Consider alternative treatment methods",
                        "Monitor treatment efficacy closely"
                    ]
                }
            elif lice_score > 50:
                analysis['lice_level'] = {
                    "severity": "high",
                    "actions": [
                        "Increase lice treatment to weekly",
                        "Optimize treatment method for this facility",
                        "Improve water quality management"
                    ]
                }
            else:
                analysis['lice_level'] = {
                    "severity": "low",
                    "actions": ["Continue standard lice management protocol"]
                }
        
        # Farm density analysis
        if risk_factors.get('farm_density') is not None:
            density_score = risk_factors['farm_density']
            if density_score > 60:
                analysis['farm_density'] = {
                    "severity": "high",
                    "actions": [
                        "Review stocking density - consider temporary reduction",
                        "Improve water circulation and oxygenation",
                        "Enhance feed management to reduce stress"
                    ]
                }
        
        # Water exchange analysis
        if risk_factors.get('water_exchange') is not None:
            water_score = risk_factors['water_exchange']
            if water_score > 70:
                analysis['water_exchange'] = {
                    "severity": "critical",
                    "actions": [
                        "Urgent water system inspection required",
                        "Service pumps and check circulation systems",
                        "Consider temporary net replacement if possible"
                    ]
                }
        
        return analysis
    
    def _get_trend_based_recommendations(
        self,
        historical_data: List[Dict[str, Any]]
    ) -> List[str]:
        """Get recommendations based on risk trends."""
        recommendations = []
        
        try:
            df = pd.DataFrame([
                {
                    'date': pd.to_datetime(d.get('assessment_date') or d.get('date')),
                    'risk_score': float(d.get('risk_score', 0))
                }
                for d in historical_data[-21:]  # Last 3 weeks
            ])
            
            df = df.sort_values('date')
            if len(df) >= 7:
                ts = df['risk_score'].values
                trend = np.mean(np.diff(ts[-7:]))  # Last week trend
                
                if trend > 2:
                    recommendations.append("Risk is increasing rapidly - escalate monitoring")
                    recommendations.append("Review recent operational changes")
                elif trend < -2:
                    recommendations.append("Risk trending down - continue current protocols")
                else:
                    recommendations.append("Risk stable - maintain current management strategy")
        except:
            pass
        
        return recommendations


# Export main functions for API use
def create_ml_engine(db_manager=None) -> MLEngine:
    """Factory function to create ML engine."""
    return MLEngine(db_manager)
