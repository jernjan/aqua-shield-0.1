# ML Agent API Reference - Phase 4

Complete API documentation for Kyst Monitor ML prediction endpoints.

---

## Base URL
```
http://127.0.0.1:8000
```

---

## Endpoint 1: Risk Predictions (ARIMA)

### Request
```http
GET /api/predictions/risk?facility_code=XXXX&days_ahead=21
```

### Query Parameters
| Parameter | Type | Required | Default | Range | Description |
|-----------|------|----------|---------|-------|-------------|
| `facility_code` | string | YES | - | - | Facility locality ID from BarentsWatch |
| `days_ahead` | integer | NO | 21 | 1-28 | Days to forecast |

### Response (Success: 200)
```json
{
  "facility_id": "10001",
  "facility_name": "Test Facility",
  "forecast_date": "2026-01-20",
  "days_ahead": 21,
  "model_accuracy": "~0.80 (80% for 2-4 week horizons)",
  "predictions": [
    {
      "forecast_date": "2026-01-21",
      "predicted_risk_score": 42.5,
      "risk_level": "MEDIUM",
      "confidence_lower": 38.2,
      "confidence_upper": 47.1,
      "confidence_level": 0.95,
      "days_ahead": 1,
      "model_type": "ARIMA(1,1,1)"
    },
    {
      "forecast_date": "2026-01-22",
      "predicted_risk_score": 45.2,
      "risk_level": "MEDIUM",
      "confidence_lower": 40.1,
      "confidence_upper": 50.3,
      "confidence_level": 0.95,
      "days_ahead": 2,
      "model_type": "ARIMA(1,1,1)"
    }
  ]
}
```

### Response (Insufficient Data: 200)
```json
{
  "facility_id": "10001",
  "facility_name": "Test Facility",
  "status": "insufficient_data",
  "message": "Less than 7 historical records available. Requires at least 7 data points.",
  "predictions": []
}
```

### Response (Error: 404/500)
```json
{
  "error": "Facility 10001 not found"
}
```

### Example Usage

**curl**
```bash
curl "http://127.0.0.1:8000/api/predictions/risk?facility_code=10001&days_ahead=14"
```

**Python**
```python
import requests

resp = requests.get(
    "http://127.0.0.1:8000/api/predictions/risk",
    params={"facility_code": "10001", "days_ahead": 14}
)
data = resp.json()
for pred in data["predictions"]:
    print(f"{pred['forecast_date']}: {pred['predicted_risk_score']}")
```

**JavaScript**
```javascript
fetch("/api/predictions/risk?facility_code=10001&days_ahead=14")
  .then(r => r.json())
  .then(data => {
    data.predictions.forEach(pred => {
      console.log(`${pred.forecast_date}: ${pred.predicted_risk_score}`);
    });
  });
```

---

## Endpoint 2: Anomaly Detection

### Request
```http
GET /api/anomalies/detect?facility_code=XXXX&sensitivity=0.1
```

### Query Parameters
| Parameter | Type | Required | Default | Range | Description |
|-----------|------|----------|---------|-------|-------------|
| `facility_code` | string | YES | - | - | Facility locality ID |
| `sensitivity` | float | NO | 0.1 | 0.05-0.20 | Detection sensitivity (lower = more sensitive) |

### Response (Success: 200)
```json
{
  "facility_id": "10001",
  "facility_name": "Test Facility",
  "detection_date": "2026-01-20T15:30:00",
  "sensitivity": 0.1,
  "anomalies_detected": 2,
  "anomalies": [
    {
      "detection_date": "2026-01-18",
      "anomaly_type": "lice_spike",
      "severity_score": 68.3,
      "baseline_value": 25.5,
      "observed_value": 52.1,
      "deviation_percent": 104.3,
      "recommended_action": "Increase monitoring frequency and consider treatment intervention"
    },
    {
      "detection_date": "2026-01-16",
      "anomaly_type": "unexpected_jump",
      "severity_score": 50.0,
      "baseline_value": 20.3,
      "observed_value": 35.2,
      "deviation_percent": 73.4,
      "recommended_action": "Acceleration in lice growth detected - review treatment protocols"
    }
  ]
}
```

### Response (No Anomalies: 200)
```json
{
  "facility_id": "10001",
  "facility_name": "Test Facility",
  "status": "insufficient_data",
  "anomalies_detected": 0,
  "anomalies": []
}
```

### Example Usage

**curl**
```bash
curl "http://127.0.0.1:8000/api/anomalies/detect?facility_code=10001&sensitivity=0.1"
```

**Python**
```python
import requests

resp = requests.get(
    "http://127.0.0.1:8000/api/anomalies/detect",
    params={"facility_code": "10001", "sensitivity": 0.1}
)
data = resp.json()
for anom in data["anomalies"]:
    print(f"{anom['detection_date']}: {anom['anomaly_type']} (Severity: {anom['severity_score']})")
```

---

## Endpoint 3: Outbreak Forecasting

### Request
```http
GET /api/forecasts/outbreaks?facility_code=XXXX
```

### Query Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `facility_code` | string | YES | Facility locality ID |

### Response (Success: 200)
```json
{
  "facility_id": "10001",
  "facility_name": "Test Facility",
  "forecast_date": "2026-01-20",
  "current_risk_score": 52.3,
  "outbreak_probability": 35.2,
  "outbreak_probability_decimal": 0.352,
  "probability_level": "MODERATE (30-50%)",
  "contributing_factors": [
    "High current risk score",
    "2 nearby diseased facilities",
    "Rapid risk increase trend"
  ],
  "days_to_critical": 8,
  "recommended_interventions": [
    "Continue regular monitoring and assessments",
    "Prepare contingency response plans",
    "Improve water quality management",
    "Enforce strict biosecurity protocols",
    "Consider temporary isolation measures"
  ]
}
```

### Probability Levels
- **0-30%**: LOW - Standard monitoring protocols
- **30-50%**: MODERATE - Enhanced monitoring and contingency prep
- **50-70%**: HIGH - Immediate intervention protocols
- **70-100%**: CRITICAL - Emergency response activation

### Example Usage

**curl**
```bash
curl "http://127.0.0.1:8000/api/forecasts/outbreaks?facility_code=10001"
```

**Python**
```python
import requests

resp = requests.get(
    "http://127.0.0.1:8000/api/forecasts/outbreaks",
    params={"facility_code": "10001"}
)
data = resp.json()
print(f"Outbreak Probability: {data['outbreak_probability']}%")
print(f"Risk Level: {data['probability_level']}")
for intervention in data["recommended_interventions"]:
    print(f"  - {intervention}")
```

---

## Endpoint 4: Intervention Recommendations

### Request
```http
GET /api/recommendations/interventions?facility_code=XXXX
```

### Query Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `facility_code` | string | YES | Facility locality ID |

### Response (Success: 200)
```json
{
  "facility_id": "10001",
  "facility_name": "Test Facility",
  "timestamp": "2026-01-20T15:30:00",
  "current_risk_score": 52.3,
  "priority_level": "HIGH",
  "immediate_actions": [
    "Increase lice treatment to weekly",
    "Optimize treatment method for this facility",
    "Review stocking density - consider temporary reduction"
  ],
  "short_term_actions": [
    "Continue regular monitoring and assessments",
    "Prepare contingency response plans",
    "Improve water quality management",
    "Review recent operational changes"
  ],
  "medium_term_actions": [
    "Risk trending down - continue current protocols",
    "Maintain standard lice management protocol",
    "Document conditions for future reference"
  ],
  "monitoring_recommendations": [
    "Daily lice count monitoring at current risk level",
    "Water quality assessment 2x weekly",
    "Fish health observations - watch for ILA/PD symptoms",
    "Vessel movement notifications - alert on proximity events"
  ],
  "estimated_impact": {
    "risk_reduction_if_actions_taken": "15%",
    "timeline_to_improvement": "2-4 weeks",
    "success_probability_with_compliance": 0.85
  }
}
```

### Priority Levels
- **CRITICAL**: Risk ≥ 80 - Emergency protocols
- **HIGH**: Risk 60-79 - Enhanced interventions
- **MEDIUM**: Risk 40-59 - Standard interventions
- **LOW**: Risk < 40 - Maintenance protocols

### Example Usage

**curl**
```bash
curl "http://127.0.0.1:8000/api/recommendations/interventions?facility_code=10001"
```

**Python**
```python
import requests

resp = requests.get(
    "http://127.0.0.1:8000/api/recommendations/interventions",
    params={"facility_code": "10001"}
)
data = resp.json()
print(f"Priority: {data['priority_level']}")
print("\nImmediate Actions:")
for action in data["immediate_actions"]:
    print(f"  - {action}")
print(f"\nEstimated Impact: {data['estimated_impact']['risk_reduction_if_actions_taken']} reduction")
```

---

## Error Handling

### Common Errors

**404 - Facility Not Found**
```json
{"detail": "Facility 10001 not found"}
```
Solution: Verify facility_code exists in BarentsWatch data

**400 - Invalid Parameters**
```json
{"detail": "Invalid days_ahead: must be 1-28"}
```
Solution: Check parameter ranges

**500 - Server Error**
```json
{"error": "Prediction failed: <error details>"}
```
Solution: Check server logs, may need more historical data

### Graceful Degradation

If ARIMA modeling fails:
- Risk Predictions falls back to exponential smoothing
- Response includes `model_type: "ExponentialSmoothing"`
- Quality is slightly reduced but still functional

If insufficient historical data (< 7 records):
- Returns status: "insufficient_data"
- Empty predictions array
- Message explaining minimum requirements

---

## Rate Limiting & Performance

### Latency by Endpoint
- Predictions: 200-500ms (ARIMA fitting)
- Anomalies: 100-200ms
- Outbreaks: 50-100ms
- Recommendations: 100-150ms

### Data Requirements
- Minimum: 7 historical risk assessments
- Optimal: 30+ days of continuous data
- Anomalies require: 5+ lice data points

### Concurrent Requests
- No rate limiting enforced
- All endpoints fully concurrent
- Database handles up to 1,000 concurrent connections

---

## Integration Examples

### Dashboard Integration
```javascript
async function loadFacilityML(facilityCode) {
  const [pred, anom, outbreak, rec] = await Promise.all([
    fetch(`/api/predictions/risk?facility_code=${facilityCode}`).then(r => r.json()),
    fetch(`/api/anomalies/detect?facility_code=${facilityCode}`).then(r => r.json()),
    fetch(`/api/forecasts/outbreaks?facility_code=${facilityCode}`).then(r => r.json()),
    fetch(`/api/recommendations/interventions?facility_code=${facilityCode}`).then(r => r.json())
  ]);
  
  displayPredictions(pred);
  displayAnomalies(anom);
  displayOutbreak(outbreak);
  displayRecommendations(rec);
}
```

### Mobile App Integration
```python
class KystMonitorAPI:
    BASE_URL = "http://127.0.0.1:8000"
    
    def get_predictions(self, facility_code, days=14):
        url = f"{self.BASE_URL}/api/predictions/risk"
        params = {"facility_code": facility_code, "days_ahead": days}
        return requests.get(url, params=params).json()
    
    def get_anomalies(self, facility_code):
        url = f"{self.BASE_URL}/api/anomalies/detect"
        return requests.get(url, params={"facility_code": facility_code}).json()
    
    def get_interventions(self, facility_code):
        url = f"{self.BASE_URL}/api/recommendations/interventions"
        return requests.get(url, params={"facility_code": facility_code}).json()
```

---

## Support & Documentation

- **Main Dashboard**: `http://127.0.0.1:8000/static/ml_dashboard.html`
- **API Spec**: See this document
- **ML Details**: See `PHASE4_ML_AGENT.md`
- **Implementation**: See `src/ml/ml_engine.py`

---

**API Version**: 1.0.0  
**Last Updated**: January 20, 2026  
**Status**: Production Ready ✅
