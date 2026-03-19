# PHASE 4 DESIGN - ML AGENT SPECIFICATION

**Document Version**: 1.0  
**Date**: January 20, 2026  
**Status**: Ready for Implementation  
**Estimated Duration**: 1.5 - 2 hours  

---

## EXECUTIVE SUMMARY

**Objective**: Build ML Agent for predictive analytics and intelligent risk forecasting

**Components**:
1. Trend Analysis Engine
2. Anomaly Detection System
3. Risk Forecasting Module
4. Pattern Recognition System

**Integration Point**: Admin Agent database + API Agent results  
**Output**: New ML endpoints + database predictions

---

## ARCHITECTURE

```
┌─────────────────────────────────────┐
│   ADMIN AGENT (Existing Database)   │
│  ├─ risk_assessments (time-series)  │
│  ├─ disease_data (temporal)         │
│  ├─ vessel_positions (dynamic)      │
│  └─ ocean_currents (environmental)  │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│   ML AGENT (NEW - This Phase)       │
│  ├─ TrendAnalyzer                   │
│  ├─ AnomalyDetector                 │
│  ├─ RiskForecaster                  │
│  └─ PatternRecognizer               │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│   ML STORAGE (New Tables)           │
│  ├─ ml_predictions                  │
│  ├─ ml_anomalies                    │
│  ├─ ml_patterns                     │
│  └─ ml_model_metadata               │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│   API ENDPOINTS (12 New)            │
│  ├─ /api/ml/trends/{facility_id}    │
│  ├─ /api/ml/forecast/{facility_id}  │
│  ├─ /api/ml/anomalies              │
│  ├─ /api/ml/patterns               │
│  └─ 8 more specialized endpoints   │
└─────────────────────────────────────┘
```

---

## DETAILED SPECIFICATIONS

### 1. TREND ANALYSIS ENGINE

**Purpose**: Extract meaningful trends from time-series risk data

**Methods**:

#### `analyze_facility_trends(facility_id, days=30, window=7)`
```python
Input:
  - facility_id: int (facility identifier)
  - days: int (lookback period in days)
  - window: int (moving average window)

Output:
  {
    "facility_id": 1,
    "period_days": 30,
    "trend_direction": "increasing" | "decreasing" | "stable",
    "trend_slope": float (rate of change per day),
    "moving_average": float (7-day MA),
    "min_risk": float,
    "max_risk": float,
    "volatility": float (standard deviation),
    "acceleration": float (slope of slope),
    "forecast_direction": string,
    "confidence": float (0-1)
  }
```

**Implementation**:
- Calculate 7-day moving average
- Fit linear regression to determine slope
- Calculate second derivative for acceleration
- Generate confidence based on R² value
- Return trend classification

---

#### `analyze_risk_component_trends(facility_id, component, days=30)`
```python
Input:
  - facility_id: int
  - component: str ("disease_proximity" | "farm_density" | "vessel_exposure" | "thermal_stress")
  - days: int

Output:
  {
    "facility_id": 1,
    "component": "disease_proximity",
    "trend_data": [
      {
        "date": "2026-01-20",
        "value": 0.45,
        "moving_avg": 0.48
      },
      ...
    ],
    "contribution_to_overall_risk": float (0-1),
    "trending_up_since": "2026-01-15",
    "highest_on": "2026-01-19",
    "lowest_on": "2026-01-10"
  }
```

---

#### `compare_facility_trends(facility_ids: List[int], days=30)`
```python
Input:
  - facility_ids: list of ints
  - days: int

Output:
  {
    "comparison_period": "2025-12-21 to 2026-01-20",
    "facilities": [
      {
        "facility_id": 1,
        "trend_direction": "increasing",
        "slope": 0.15,
        "percentile": 75 (vs other facilities)
      },
      ...
    ],
    "best_trend": 1,
    "worst_trend": 3,
    "average_slope": 0.08
  }
```

---

### 2. ANOMALY DETECTION SYSTEM

**Purpose**: Identify unusual risk patterns and outliers

**Methods**:

#### `detect_anomalies(facility_id, sensitivity=0.95, window=30)`
```python
Input:
  - facility_id: int
  - sensitivity: float (0-1, higher = more sensitive)
  - window: int (training window days)

Output:
  {
    "facility_id": 1,
    "anomalies_detected": 3,
    "anomalies": [
      {
        "date": "2026-01-18",
        "risk_score": 0.87,
        "expected_range": [0.42, 0.58],
        "severity": "high" | "medium" | "low",
        "likely_cause": "high_disease_proximity",
        "confidence": 0.92
      },
      ...
    ],
    "threshold": 0.65,
    "baseline_mean": 0.48,
    "baseline_std": 0.08
  }
```

---

#### `detect_systemic_anomalies(limit=50, sensitivity=0.95)`
```python
Input:
  - limit: int (max facilities to return)
  - sensitivity: float

Output:
  {
    "timestamp": "2026-01-20T14:30:00Z",
    "total_facilities_checked": 147,
    "anomalies_found": 5,
    "critical_anomalies": [
      {
        "facility_id": 23,
        "current_risk": 0.92,
        "historical_avg": 0.48,
        "deviation_std": 2.8,
        "event_type": "sudden_spike",
        "recommendation": "investigate_disease_data"
      },
      ...
    ],
    "overall_system_health": "normal" | "warning" | "critical"
  }
```

---

#### `detect_pattern_anomalies(facility_id, pattern_type="risk_spike")`
```python
Input:
  - facility_id: int
  - pattern_type: str ("risk_spike" | "seasonal_pattern" | "irregular_oscillation" | "step_change")

Output:
  {
    "facility_id": 1,
    "pattern_detected": True | False,
    "pattern_type": "risk_spike",
    "confidence": 0.87,
    "onset_date": "2026-01-15",
    "duration_days": 5,
    "peak_value": 0.92,
    "resolution_forecast": "2026-01-25"
  }
```

---

### 3. RISK FORECASTING MODULE

**Purpose**: Predict future risk levels based on historical patterns

**Methods**:

#### `forecast_facility_risk(facility_id, days_ahead=14, method="exponential_smoothing")`
```python
Input:
  - facility_id: int
  - days_ahead: int (1-30, forecast horizon)
  - method: str ("exponential_smoothing" | "arima" | "prophet")

Output:
  {
    "facility_id": 1,
    "forecast_date": "2026-01-20",
    "forecast_horizon_days": 14,
    "forecast_method": "exponential_smoothing",
    "forecast_data": [
      {
        "date": "2026-01-21",
        "predicted_risk": 0.52,
        "confidence_lower": 0.45,
        "confidence_upper": 0.59,
        "recommendation": "monitor"
      },
      {
        "date": "2026-01-22",
        "predicted_risk": 0.55,
        "confidence_lower": 0.43,
        "confidence_upper": 0.67,
        "recommendation": "monitor"
      },
      ...
    ],
    "model_accuracy_mae": 0.08,
    "model_accuracy_rmse": 0.11,
    "turning_points": [
      {
        "date": "2026-01-26",
        "type": "peak",
        "predicted_value": 0.72
      }
    ]
  }
```

---

#### `forecast_component_risk(facility_id, component, days_ahead=14)`
```python
Input:
  - facility_id: int
  - component: str ("disease_proximity" | "farm_density" | "vessel_exposure" | "thermal_stress")
  - days_ahead: int

Output:
  {
    "facility_id": 1,
    "component": "disease_proximity",
    "forecast_horizon": 14,
    "current_value": 0.65,
    "forecast": [
      {
        "date": "2026-01-21",
        "predicted_value": 0.62,
        "confidence_interval": [0.55, 0.69],
        "driver": "lice_movement_northward"
      },
      ...
    ],
    "peak_forecast": 0.78,
    "peak_date": "2026-01-25"
  }
```

---

#### `forecast_epidemic_risk(days_ahead=14)`
```python
Input:
  - days_ahead: int

Output:
  {
    "forecast_date": "2026-01-20",
    "forecast_horizon": 14,
    "system_wide_risk_forecast": [
      {
        "date": "2026-01-21",
        "predicted_risk_level": "moderate",
        "facilities_at_risk": 18,
        "facilities_high_risk": 3,
        "primary_drivers": ["disease_proximity", "vessel_exposure"],
        "expected_new_cases": 2.3
      },
      ...
    ],
    "highest_risk_period": "2026-01-25 to 2026-01-27",
    "mitigation_recommendations": [...]
  }
```

---

### 4. PATTERN RECOGNITION SYSTEM

**Purpose**: Identify recurring patterns and behavioral changes

**Methods**:

#### `identify_recurring_patterns(facility_id, min_occurrences=3)`
```python
Input:
  - facility_id: int
  - min_occurrences: int (minimum times pattern must repeat)

Output:
  {
    "facility_id": 1,
    "patterns_identified": 2,
    "patterns": [
      {
        "pattern_id": "P001",
        "pattern_type": "seasonal",
        "description": "Risk elevation every 28 days",
        "occurrences": 4,
        "average_duration_days": 5,
        "average_peak_risk": 0.68,
        "next_expected_occurrence": "2026-02-17",
        "confidence": 0.85,
        "likely_cause": "farm_stocking_cycle"
      },
      ...
    ]
  }
```

---

#### `detect_behavioral_change(facility_id, window_days=30)`
```python
Input:
  - facility_id: int
  - window_days: int

Output:
  {
    "facility_id": 1,
    "analysis_window": 30,
    "historical_pattern": "stable_low_risk",
    "historical_avg": 0.42,
    "recent_avg": 0.68,
    "change_detected": True,
    "change_type": "elevated_risk",
    "change_magnitude": "significant",
    "change_onset_date": "2026-01-10",
    "probability_temporary": 0.6,
    "probability_permanent": 0.4,
    "recommended_investigation": "disease_data_review"
  }
```

---

#### `identify_risk_clusters()`
```python
Input:
  None

Output:
  {
    "analysis_timestamp": "2026-01-20T14:30:00Z",
    "clusters_identified": 3,
    "clusters": [
      {
        "cluster_id": "C001",
        "facilities": [1, 2, 4, 7],
        "cluster_center": {"lat": 60.5, "lng": 5.2},
        "radius_km": 15,
        "shared_risk_factors": ["lice_outbreak", "high_vessel_traffic"],
        "average_risk": 0.72,
        "cluster_risk_score": 0.85,
        "recommendation": "coordinated_response"
      },
      ...
    ]
  }
```

---

## DATABASE SCHEMA ADDITIONS

### New Tables

#### `ml_predictions`
```sql
CREATE TABLE ml_predictions (
  id INTEGER PRIMARY KEY,
  facility_id INTEGER NOT NULL,
  prediction_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  forecast_date DATE NOT NULL,
  predicted_risk REAL NOT NULL,
  confidence_lower REAL,
  confidence_upper REAL,
  method TEXT,
  days_ahead INTEGER,
  model_version TEXT,
  actual_risk REAL,
  mae REAL,
  rmse REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (facility_id) REFERENCES facilities(id),
  INDEX idx_facility_forecast (facility_id, forecast_date),
  INDEX idx_prediction_date (prediction_date)
);
```

#### `ml_anomalies`
```sql
CREATE TABLE ml_anomalies (
  id INTEGER PRIMARY KEY,
  facility_id INTEGER NOT NULL,
  anomaly_date DATE NOT NULL,
  risk_score REAL NOT NULL,
  expected_range_low REAL,
  expected_range_high REAL,
  severity TEXT,
  likely_cause TEXT,
  confidence REAL,
  investigated BOOLEAN DEFAULT 0,
  investigation_notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (facility_id) REFERENCES facilities(id),
  INDEX idx_facility_date (facility_id, anomaly_date),
  INDEX idx_severity (severity)
);
```

#### `ml_patterns`
```sql
CREATE TABLE ml_patterns (
  id INTEGER PRIMARY KEY,
  facility_id INTEGER NOT NULL,
  pattern_type TEXT,
  pattern_description TEXT,
  occurrence_count INTEGER,
  average_duration_days INTEGER,
  average_peak_risk REAL,
  next_expected_date DATE,
  confidence REAL,
  likely_cause TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (facility_id) REFERENCES facilities(id),
  INDEX idx_facility_type (facility_id, pattern_type)
);
```

#### `ml_model_metadata`
```sql
CREATE TABLE ml_model_metadata (
  id INTEGER PRIMARY KEY,
  model_name TEXT UNIQUE,
  model_version TEXT,
  training_start_date DATE,
  training_end_date DATE,
  training_samples INTEGER,
  accuracy_mae REAL,
  accuracy_rmse REAL,
  last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
  parameters JSON
);
```

---

## API ENDPOINT SPECIFICATIONS

### 12 New ML Endpoints

#### 1. Facility Trends
```
GET /api/ml/trends/{facility_id}
  ?days=30&component=all

Returns:
  - Overall risk trend
  - Component breakdown trends
  - Forecast direction
```

#### 2. Risk Forecast
```
GET /api/ml/forecast/{facility_id}
  ?days_ahead=14&method=exponential_smoothing

Returns:
  - 14-day risk forecast
  - Confidence intervals
  - Turning points
```

#### 3. Component Forecast
```
GET /api/ml/forecast/{facility_id}/component
  ?component=disease_proximity&days_ahead=14

Returns:
  - Component-specific forecast
  - Driver analysis
  - Peak prediction
```

#### 4. System-wide Forecast
```
GET /api/ml/forecast/system
  ?days_ahead=14

Returns:
  - Overall system risk forecast
  - Facilities at risk count
  - Epidemic risk assessment
```

#### 5. Anomalies
```
GET /api/ml/anomalies
  ?facility_id=1&sensitivity=0.95

Returns:
  - Current anomalies
  - Historical anomalies
  - Severity distribution
```

#### 6. Systemic Anomalies
```
GET /api/ml/anomalies/system
  ?sensitivity=0.95&limit=20

Returns:
  - All facilities with anomalies
  - System health status
  - Ranked by severity
```

#### 7. Pattern Detection
```
GET /api/ml/patterns/{facility_id}
  ?min_occurrences=3

Returns:
  - Recurring patterns
  - Pattern statistics
  - Next occurrence forecast
```

#### 8. Behavioral Change
```
GET /api/ml/behavior/{facility_id}
  ?window_days=30

Returns:
  - Historical pattern
  - Recent behavior
  - Change type & magnitude
```

#### 9. Risk Clusters
```
GET /api/ml/clusters
  ?radius_km=25

Returns:
  - Geographic clusters
  - Shared risk factors
  - Cluster risk scores
```

#### 10. Trend Comparison
```
GET /api/ml/trends/compare
  ?facility_ids=1,2,4,7

Returns:
  - Multi-facility trend comparison
  - Percentile ranking
  - Relative risk assessment
```

#### 11. Model Metadata
```
GET /api/ml/models
  ?model_name=trend_analyzer

Returns:
  - Model version
  - Training parameters
  - Accuracy metrics
```

#### 12. Bulk Forecasting
```
POST /api/ml/forecast/bulk
  {
    "facility_ids": [1, 2, 3, 4],
    "days_ahead": 14
  }

Returns:
  - Forecasts for all facilities
  - Comparative analysis
```

---

## IMPLEMENTATION REQUIREMENTS

### Dependencies
```
numpy >= 1.21.0      # Numerical computing
scipy >= 1.7.0       # Statistical functions
scikit-learn >= 1.0  # ML algorithms
statsmodels >= 0.13  # Time series
pandas >= 1.3.0      # Data manipulation
```

### Libraries to Use
```python
# Trend Analysis
from scipy.stats import linregress
from sklearn.linear_model import LinearRegression

# Anomaly Detection
from scipy import stats
from sklearn.ensemble import IsolationForest

# Time Series Forecasting
from statsmodels.tsa.holtwinters import ExponentialSmoothing
from statsmodels.tsa.arima.model import ARIMA

# Pattern Recognition
from sklearn.cluster import DBSCAN
```

---

## TESTING SPECIFICATIONS

### Unit Tests (15 tests minimum)

```python
# test_ml_agent.py

test_trend_analysis_linear()
test_trend_analysis_with_gaps()
test_component_trend_calculation()
test_trend_comparison_accuracy()

test_anomaly_detection_spike()
test_anomaly_detection_sustained()
test_systemic_anomaly_detection()
test_anomaly_sensitivity_levels()

test_forecast_exponential_smoothing()
test_forecast_arima()
test_forecast_confidence_intervals()
test_epidemic_forecast()

test_pattern_identification()
test_behavioral_change_detection()
test_risk_cluster_analysis()

test_database_storage()
test_api_endpoint_integration()
```

### Integration Tests (5 tests minimum)

```python
test_full_workflow_facility()           # Trend → Anomaly → Forecast
test_system_wide_analysis()            # All facilities
test_real_data_processing()            # Existing database
test_forecast_accuracy_tracking()      # Model improvement
test_api_consistency()                 # Endpoint returns match
```

---

## CODE STRUCTURE

### Directory Layout
```
src/ml/
├── __init__.py
├── trend_analyzer.py           (350+ lines)
├── anomaly_detector.py         (350+ lines)
├── risk_forecaster.py          (350+ lines)
├── pattern_recognizer.py       (300+ lines)
├── ml_routes.py                (200+ lines)
└── utils/
    ├── statistics.py           (utilities)
    └── models.py               (model definitions)
```

### Key Classes
```python
class TrendAnalyzer:
    def analyze_facility_trends()
    def analyze_risk_component_trends()
    def compare_facility_trends()

class AnomalyDetector:
    def detect_anomalies()
    def detect_systemic_anomalies()
    def detect_pattern_anomalies()

class RiskForecaster:
    def forecast_facility_risk()
    def forecast_component_risk()
    def forecast_epidemic_risk()

class PatternRecognizer:
    def identify_recurring_patterns()
    def detect_behavioral_change()
    def identify_risk_clusters()
```

---

## PERFORMANCE TARGETS

| Operation | Target Time | Target Accuracy |
|-----------|------------|-----------------|
| Trend analysis | < 500ms | R² > 0.85 |
| Anomaly detection | < 1s | Precision > 0.90 |
| Risk forecast | < 2s | MAE < 0.10 |
| Pattern detection | < 3s | Confidence > 0.85 |
| Systemic analysis | < 5s | - |

---

## INTEGRATION WITH EXISTING SYSTEM

### 1. Initialize ML Agent
```python
# In src/api/main.py
from src.ml.trend_analyzer import TrendAnalyzer
from src.ml.anomaly_detector import AnomalyDetector
from src.ml.risk_forecaster import RiskForecaster
from src.ml.pattern_recognizer import PatternRecognizer

ml_agent = {
    'trends': TrendAnalyzer(db_connection),
    'anomalies': AnomalyDetector(db_connection),
    'forecasts': RiskForecaster(db_connection),
    'patterns': PatternRecognizer(db_connection)
}
```

### 2. Register Routes
```python
# In src/api/main.py
from src.ml.ml_routes import router as ml_router

app.include_router(ml_router, prefix="/api/ml", tags=["ML"])
```

### 3. Database Integration
```python
# Create new tables at startup
admin.database.create_ml_tables()
```

---

## SUCCESS CRITERIA

- [x] Design complete
- [ ] 4 core modules implemented
- [ ] 12 API endpoints working
- [ ] 4 database tables created
- [ ] 20 tests passing (100%)
- [ ] All forecasts accurate (MAE < 0.10)
- [ ] Anomalies correctly identified
- [ ] Patterns detected with > 85% confidence
- [ ] Documentation complete
- [ ] Ready for integration

---

## HANDOFF CRITERIA

**Phase 4 Complete When**:
1. All 4 ML modules implemented
2. All 12 endpoints functional
3. All 20 tests passing
4. Database tables populated
5. Integration verified
6. Documentation updated
7. Performance targets met

**Expected Delivery**: 1.5-2 hours from start

---

**Ready to build ML Agent!** 🚀

