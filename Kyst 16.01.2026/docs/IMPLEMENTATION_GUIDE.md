# IMPLEMENTATION GUIDE - PHASE 4
**For**: New Implementation Chat  
**Date**: January 20, 2026  
**Duration**: 1.5 - 2 hours  

---

## QUICK START (5 minutes)

### Step 1: Load Project Context
1. **COPY** everything from `PROJECT_STATE.md`
2. **PASTE** into new chat to build context
3. **READ** this entire guide before starting

### Step 2: Verify Environment
```bash
cd "Kyst monitor DEMO\Kyst 16.01.2026"
python --version          # Should be 3.9+
pip list | grep -i numpy  # Should see numpy, scipy, scikit-learn
```

### Step 3: Understand Current Architecture
- **Phase 1**: API Agent ✅ (gathers data)
- **Phase 2**: Admin Agent ✅ (stores data)  
- **Phase 3**: Frontend Agent ✅ (visualizes data)
- **Phase 4**: ML Agent (⏳ YOUR JOB - predicts data)

---

## WHAT YOU'RE BUILDING

### ML Agent Purpose
Predict future risks and identify unusual patterns using historical data

### 4 Core Modules
1. **TrendAnalyzer** (350+ lines)
   - Analyze historical patterns
   - Calculate moving averages & slopes
   - Forecast trend direction

2. **AnomalyDetector** (350+ lines)
   - Find unusual data points
   - Identify outliers
   - Flag concerning patterns

3. **RiskForecaster** (350+ lines)
   - Predict risk 1-30 days ahead
   - Calculate confidence intervals
   - Handle different forecasting methods

4. **PatternRecognizer** (300+ lines)
   - Find recurring patterns
   - Detect behavioral changes
   - Identify geographic clusters

### Output
12 new API endpoints: `/api/ml/trends`, `/api/ml/forecast`, `/api/ml/anomalies`, etc.

---

## DEVELOPMENT SEQUENCE

### Phase 4A: Setup (15 minutes)
```
[1] Create directory: src/ml/
[2] Create files:
    - src/ml/__init__.py
    - src/ml/trend_analyzer.py
    - src/ml/anomaly_detector.py
    - src/ml/risk_forecaster.py
    - src/ml/pattern_recognizer.py
    - src/ml/ml_routes.py
[3] Create test file: test_ml_agent.py
[4] Add database tables to database_manager.py
[5] Install ML dependencies: pip install numpy scipy scikit-learn statsmodels pandas
```

### Phase 4B: Build Modules (60 minutes)
```
[6] Implement TrendAnalyzer class (350 lines)
[7] Implement AnomalyDetector class (350 lines)
[8] Implement RiskForecaster class (350 lines)
[9] Implement PatternRecognizer class (300 lines)
[10] Create ml_routes.py with 12 endpoints (200 lines)
```

### Phase 4C: Test & Integrate (25 minutes)
```
[11] Write 20 unit tests
[12] Run test suite (all passing)
[13] Register ML routes in main.py
[14] Create database tables at startup
[15] Test all 12 endpoints
[16] Verify integration with existing agents
[17] Update documentation
```

---

## KEY IMPLEMENTATION PATTERNS

### Pattern 1: Database Connection
```python
# All ML modules receive db_connection
from src.db.database_manager import DatabaseManager

class TrendAnalyzer:
    def __init__(self, db_connection):
        self.db = db_connection
    
    def query_historical_data(self, facility_id, days=30):
        query = "SELECT * FROM risk_assessments WHERE facility_id=? AND timestamp > ?"
        return self.db.execute(query, (facility_id, date_threshold)).fetchall()
```

### Pattern 2: Return Format (Consistent JSON)
```python
# All methods return standardized dictionaries
def analyze_facility_trends(self, facility_id):
    return {
        "facility_id": facility_id,
        "trend_direction": "increasing",
        "trend_slope": 0.15,
        "moving_average": 0.52,
        "confidence": 0.87,
        # ... more fields
    }
```

### Pattern 3: Error Handling
```python
# Graceful failure with informative messages
def forecast_facility_risk(self, facility_id):
    try:
        data = self.query_historical_data(facility_id)
        if len(data) < 7:
            raise ValueError(f"Insufficient data for facility {facility_id}")
        # ... process
    except Exception as e:
        return {
            "error": str(e),
            "status": "failed",
            "facility_id": facility_id
        }
```

### Pattern 4: NumPy Array Processing
```python
# Efficient numerical computation
import numpy as np
from scipy.stats import linregress

# Convert to numpy array
risk_scores = np.array([r[1] for r in data])

# Calculate trend
slope, intercept, r_value, p_value, std_err = linregress(range(len(risk_scores)), risk_scores)
```

### Pattern 5: API Routes
```python
# FastAPI endpoint pattern (existing, follow this)
from fastapi import APIRouter, Query, HTTPException

router = APIRouter()

@router.get("/trends/{facility_id}")
async def get_trends(
    facility_id: int,
    days: int = Query(30, ge=1, le=365),
    component: str = Query("all")
):
    analyzer = TrendAnalyzer(get_db_connection())
    result = analyzer.analyze_facility_trends(facility_id, days, component)
    return result
```

---

## CRITICAL REFERENCE FILES

### Read FIRST (5 min)
- ✅ PROJECT_STATE.md (current status)
- ✅ PHASE4_DESIGN.md (specifications)

### Read for Code Patterns (10 min)
- `src/api/main.py` (see how routes registered)
- `src/frontend/dashboard_engine.py` (see aggregation pattern)
- `src/db/database_manager.py` (see database access pattern)

### Reference During Build (keep open)
- `PHASE4_DESIGN.md` (method signatures)
- `docs/API_SPECIFICATION.md` (endpoint patterns)

---

## DATABASE ACCESS

### Connect to Database
```python
from src.db.database_manager import DatabaseManager

db = DatabaseManager()
```

### Query Risk Data (Example)
```python
query = """
    SELECT 
        timestamp,
        overall_risk,
        disease_proximity,
        farm_density,
        vessel_exposure,
        thermal_stress
    FROM risk_assessments
    WHERE facility_id = ? AND timestamp > datetime('now', '-30 days')
    ORDER BY timestamp ASC
"""
data = db.execute(query, (facility_id,)).fetchall()
```

### Store Predictions (Example)
```python
# Insert forecast
db.execute("""
    INSERT INTO ml_predictions 
    (facility_id, forecast_date, predicted_risk, confidence_lower, confidence_upper, method, days_ahead)
    VALUES (?, ?, ?, ?, ?, ?, ?)
""", (facility_id, date, risk, lower, upper, method, days))
```

---

## TESTING APPROACH

### Test Structure
```python
# test_ml_agent.py

import unittest
from src.ml.trend_analyzer import TrendAnalyzer
from src.ml.anomaly_detector import AnomalyDetector
# ... etc

class TestMLAgent(unittest.TestCase):
    
    def setUp(self):
        # Initialize with test database
        self.analyzer = TrendAnalyzer(test_db)
        self.detector = AnomalyDetector(test_db)
        # ...
    
    def test_trend_linear_increase(self):
        # Create mock data with known trend
        # Call method
        # Assert result matches expectation
        
    def test_forecast_accuracy(self):
        # Use historical data as test
        # Compare prediction vs actual
        # Assert MAE < 0.10
```

### Minimum Tests Required (20 total)
- Trend: 4 tests
- Anomalies: 4 tests
- Forecast: 4 tests
- Patterns: 4 tests
- Integration: 4 tests

---

## STEP-BY-STEP IMPLEMENTATION

### Step 1: Create Files (5 min)

```bash
mkdir src/ml
touch src/ml/__init__.py
touch src/ml/trend_analyzer.py
touch src/ml/anomaly_detector.py
touch src/ml/risk_forecaster.py
touch src/ml/pattern_recognizer.py
touch src/ml/ml_routes.py
touch test_ml_agent.py
```

### Step 2: Add Database Tables (5 min)

Edit `src/db/database_manager.py` and add:

```python
def create_ml_tables(self):
    """Create ML-related tables"""
    
    # ml_predictions
    self.execute("""
        CREATE TABLE IF NOT EXISTS ml_predictions (
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
            UNIQUE(facility_id, forecast_date, method)
        )
    """)
    
    # ml_anomalies
    self.execute("""
        CREATE TABLE IF NOT EXISTS ml_anomalies (
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
            FOREIGN KEY (facility_id) REFERENCES facilities(id)
        )
    """)
    
    # ml_patterns
    self.execute("""
        CREATE TABLE IF NOT EXISTS ml_patterns (
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
            FOREIGN KEY (facility_id) REFERENCES facilities(id)
        )
    """)
    
    # ml_model_metadata
    self.execute("""
        CREATE TABLE IF NOT EXISTS ml_model_metadata (
            id INTEGER PRIMARY KEY,
            model_name TEXT UNIQUE,
            model_version TEXT,
            training_start_date DATE,
            training_end_date DATE,
            training_samples INTEGER,
            accuracy_mae REAL,
            accuracy_rmse REAL,
            last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
            parameters TEXT
        )
    """)
```

### Step 3: Install Dependencies (3 min)

```bash
pip install numpy scipy scikit-learn statsmodels pandas
```

### Step 4: Build TrendAnalyzer (15 min)

```python
# src/ml/trend_analyzer.py

import numpy as np
from scipy.stats import linregress
from datetime import datetime, timedelta

class TrendAnalyzer:
    def __init__(self, db_connection):
        self.db = db_connection
    
    def analyze_facility_trends(self, facility_id, days=30, window=7):
        """Analyze risk trends for a facility"""
        # Query historical data
        # Calculate moving average
        # Fit linear regression
        # Return trend metrics
        pass
    
    def analyze_risk_component_trends(self, facility_id, component, days=30):
        """Analyze individual component trends"""
        pass
    
    def compare_facility_trends(self, facility_ids, days=30):
        """Compare trends across multiple facilities"""
        pass
```

### Step 5: Build AnomalyDetector (15 min)

```python
# src/ml/anomaly_detector.py

import numpy as np
from scipy import stats

class AnomalyDetector:
    def __init__(self, db_connection):
        self.db = db_connection
    
    def detect_anomalies(self, facility_id, sensitivity=0.95, window=30):
        """Detect anomalies in risk data"""
        # Query data
        # Calculate baseline (mean, std)
        # Identify outliers
        # Return anomalies
        pass
    
    def detect_systemic_anomalies(self, limit=50, sensitivity=0.95):
        """Detect anomalies across all facilities"""
        pass
    
    def detect_pattern_anomalies(self, facility_id, pattern_type="risk_spike"):
        """Detect specific pattern types"""
        pass
```

### Step 6: Build RiskForecaster (15 min)

```python
# src/ml/risk_forecaster.py

from statsmodels.tsa.holtwinters import ExponentialSmoothing
from statsmodels.tsa.arima.model import ARIMA
import numpy as np

class RiskForecaster:
    def __init__(self, db_connection):
        self.db = db_connection
    
    def forecast_facility_risk(self, facility_id, days_ahead=14, method="exponential_smoothing"):
        """Forecast facility risk"""
        # Query historical data
        # Choose method
        # Train model
        # Generate forecast
        # Return with confidence intervals
        pass
    
    def forecast_component_risk(self, facility_id, component, days_ahead=14):
        """Forecast component risk"""
        pass
    
    def forecast_epidemic_risk(self, days_ahead=14):
        """System-wide epidemic forecast"""
        pass
```

### Step 7: Build PatternRecognizer (15 min)

```python
# src/ml/pattern_recognizer.py

from sklearn.cluster import DBSCAN
import numpy as np

class PatternRecognizer:
    def __init__(self, db_connection):
        self.db = db_connection
    
    def identify_recurring_patterns(self, facility_id, min_occurrences=3):
        """Identify recurring patterns"""
        # Query data
        # Find repeating patterns
        # Calculate statistics
        # Return patterns
        pass
    
    def detect_behavioral_change(self, facility_id, window_days=30):
        """Detect behavioral changes"""
        pass
    
    def identify_risk_clusters(self):
        """Identify geographic risk clusters"""
        pass
```

### Step 8: Create API Routes (10 min)

```python
# src/ml/ml_routes.py

from fastapi import APIRouter, Query
from src.ml.trend_analyzer import TrendAnalyzer
from src.ml.anomaly_detector import AnomalyDetector
from src.ml.risk_forecaster import RiskForecaster
from src.ml.pattern_recognizer import PatternRecognizer
from src.db.database_manager import DatabaseManager

router = APIRouter()
db = DatabaseManager()

@router.get("/trends/{facility_id}")
async def get_trends(facility_id: int, days: int = Query(30)):
    analyzer = TrendAnalyzer(db)
    return analyzer.analyze_facility_trends(facility_id, days)

@router.get("/forecast/{facility_id}")
async def get_forecast(facility_id: int, days_ahead: int = Query(14)):
    forecaster = RiskForecaster(db)
    return forecaster.forecast_facility_risk(facility_id, days_ahead)

@router.get("/anomalies")
async def get_anomalies(facility_id: int = Query(...), sensitivity: float = Query(0.95)):
    detector = AnomalyDetector(db)
    return detector.detect_anomalies(facility_id, sensitivity)

@router.get("/patterns/{facility_id}")
async def get_patterns(facility_id: int):
    recognizer = PatternRecognizer(db)
    return recognizer.identify_recurring_patterns(facility_id)

# ... 8 more endpoints
```

### Step 9: Integrate into Main App (5 min)

Edit `src/api/main.py`:

```python
# At top
from src.ml.ml_routes import router as ml_router

# In main()
app.include_router(ml_router, prefix="/api/ml", tags=["ML"])

# At startup
admin.database.create_ml_tables()
```

### Step 10: Write Tests (15 min)

```python
# test_ml_agent.py

import unittest
from src.ml.trend_analyzer import TrendAnalyzer
# ... other imports

class TestMLAgent(unittest.TestCase):
    def setUp(self):
        # Initialize modules
        pass
    
    def test_trend_analysis_basic(self):
        # Test with known data
        pass
    
    # ... 19 more tests
```

### Step 11: Run Tests (5 min)

```bash
python test_ml_agent.py
# Expect: 20/20 tests passing
```

### Step 12: Verify API (5 min)

```bash
# Start server
python -m uvicorn src.api.main:app --reload

# Test endpoints
curl http://localhost:8000/api/ml/trends/1
curl http://localhost:8000/api/ml/forecast/1
curl http://localhost:8000/api/ml/anomalies?facility_id=1
```

---

## ESTIMATED TIME BREAKDOWN

| Task | Time |
|------|------|
| Setup (files, DB, deps) | 15 min |
| TrendAnalyzer build | 15 min |
| AnomalyDetector build | 15 min |
| RiskForecaster build | 15 min |
| PatternRecognizer build | 15 min |
| API routes | 10 min |
| Integration | 5 min |
| Tests | 15 min |
| Debugging/Polish | 10 min |
| **TOTAL** | **110 min (1h50m)** |

---

## REPORTING BACK

### When Complete, Tell Project Manager Chat:

1. **Status**: "Phase 4 (ML Agent) implementation complete"

2. **Metrics**:
   - Lines of code: XXX
   - Test results: XX/XX passing
   - API endpoints: 12/12 working
   - Response times: < threshold

3. **What Was Built**:
   - TrendAnalyzer ✓
   - AnomalyDetector ✓
   - RiskForecaster ✓
   - PatternRecognizer ✓
   - 12 endpoints ✓
   - 4 database tables ✓

4. **What's Next**:
   - Frontend UI (Vue.js)
   - Deployment

---

## TROUBLESHOOTING

### NumPy Import Error
```bash
pip install --upgrade numpy
```

### Database Lock
```bash
# Delete and recreate
rm kyst_monitor.db
python -c "from src.db.database_manager import DatabaseManager; DatabaseManager()"
```

### Forecast Accuracy Low
- Check if 7+ days of data available
- Verify data quality from Admin Agent
- Try different method (ARIMA vs Exponential)

### Tests Failing
- Verify database populated with test data
- Check import paths
- Ensure all dependencies installed

---

## SUCCESS CONFIRMATION

**ML Agent Complete When**:
- [x] All 4 core modules built
- [x] 12 API endpoints working
- [x] 20/20 tests passing
- [x] Database tables created & populated
- [x] Integration with main.py successful
- [x] Response times < 2 seconds
- [x] Documentation updated

---

**Ready to build?** Load PROJECT_STATE.md and start building! 🚀

