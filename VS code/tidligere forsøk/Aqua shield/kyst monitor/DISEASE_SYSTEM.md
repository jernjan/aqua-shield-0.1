# AquaShield - Disease Risk Management System

## 🦠 Overview

Complete disease and lice transmission monitoring system for aquaculture farms with:
- Real-time disease occurrence tracking
- Infection zone mapping with water current modeling  
- ML-based transmission probability predictions
- Automated vessel and farm alerts
- Public research/insurance data export

## 🏗️ Architecture

### Backend (FastAPI)
```
backend/app/
├── db/
│   ├── models.py              # User, Farm, Alert, Risk Assessment
│   ├── models_vessel.py       # Vessel, Observation, Proximity
│   └── models_disease.py      # Disease tracking (NEW)
├── services/
│   ├── barentswatch_service.py  # BarentsWatch API integration
│   ├── disease_risk_service.py  # Risk analysis & propagation (NEW)
│   └── ml_service.py          # ML predictions (NEW)
├── api/
│   ├── disease.py             # Disease endpoints (NEW)
│   ├── research.py            # Research/export endpoints (NEW)
│   └── [existing routers]
└── main.py                    # FastAPI app entry point
```

### Frontend (React)
```
frontend/src/
├── pages/
│   ├── DashboardPage.tsx
│   ├── FarmsPage.tsx
│   ├── VesselsPage.tsx
│   ├── AlertsPage.tsx
│   └── DiseaseRiskPage.tsx    # Disease monitoring (NEW)
├── components/
│   └── Header.tsx             # Updated navigation
└── api/
    └── client.ts              # API client
```

---

## 🔑 Key Features

### 1. Disease Occurrence Tracking
Report and track disease/lice outbreaks:
- **Disease Types**: sea_lice, amoebic_gill_disease, pancreas_disease, etc.
- **Severity Levels**: LOW, MEDIUM, HIGH, CRITICAL
- **Attributes**: Lice count, mortality rate, treatment applied, location
- **Transmission Vector**: water_current, vessel_contact, escaped_fish

**API:**
```bash
POST   /api/disease/occurrences              # Report new disease
GET    /api/disease/occurrences              # List diseases
GET    /api/disease/occurrences/{id}         # Get disease details
PUT    /api/disease/occurrences/{id}/resolve # Mark resolved
```

### 2. Infection Zone Mapping
Geographic zones with confirmed disease presence:
- **Risk Propagation**: Models water current-based spread
- **Zone Radius**: Calculated from disease cluster analysis
- **Water Current Data**: Integrated with oceanographic APIs
- **Auto-expiration**: Zones expire after 14 days

**API:**
```bash
GET    /api/disease/zones                    # List active zones
GET    /api/disease/zones/{zone_id}          # Zone details
POST   /api/disease/update-zones             # Recalculate zones
```

### 3. Vessel Disease Exposure
Track when vessels enter infection zones:
- **Exposure Detection**: Automatic geofencing
- **Alert Generation**: Alerts vessels with recommended actions
- **Recommendations**: Disinfection, quarantine, inspection

**API:**
```bash
GET    /api/disease/vessel-exposures         # Get exposures
POST   /api/disease/check-vessel-exposures   # Scan all vessels
```

### 4. Farm Risk Analysis
Real-time disease transmission risk per farm:
- **Vessel Risk**: Proximity to infected vessels
- **Zone Risk**: Distance to active infection zones
- **Overall Score**: Combined risk probability (0-1)
- **Risk Levels**: LOW, MEDIUM, HIGH, CRITICAL

**API:**
```bash
GET    /api/disease/farm-risk/{farm_id}      # Single farm analysis
GET    /api/disease/all-farms-risk           # All farms analysis
```

### 5. ML-Based Predictions
Machine learning model for disease transmission prediction:
- **Training Data**: Historical disease propagation with outcomes
- **Features**: Distance, water current, vessel speed, historical rates
- **Predictions**: Probability of transmission farm-to-farm
- **Accuracy Tracking**: Model validation against actual outcomes

**API:**
```bash
GET    /api/research/predictions             # Current predictions
POST   /api/research/train-model             # Retrain model
POST   /api/research/predict-outbreaks       # Generate predictions
```

### 6. Research/Insurance Data Export
Public-facing data export for research companies:
- **Aggregated Statistics**: Disease types, severity distribution
- **Anonymized Details**: Geographic data without farm identifiers
- **Time Series**: Temporal disease patterns
- **Predictions**: Model confidence and accuracy metrics

**API:**
```bash
GET    /api/research/export-research-data    # Summary export
GET    /api/research/export-research-data/detailed  # Full export
GET    /api/research/statistics              # Statistics
```

---

## 🚀 Getting Started

### 1. Install & Setup Backend

```bash
cd backend
python -m venv venv
.\venv\Scripts\activate  # Windows
source venv/bin/activate  # Mac/Linux

pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

### 2. Add Example Disease Data

```bash
cd backend
python add_disease_data.py
```

This adds sample disease occurrences to test the system.

### 3. Start Frontend

```bash
cd frontend
npm install
npm run dev
```

Access at `http://localhost:5175`

### 4. Navigate to Disease Risk Page
In the header navigation, click "Disease Risk" to view:
- Active disease occurrences
- Infection zones
- Farm risk analysis
- ML predictions (when available)

---

## 📊 Data Models

### DiseaseOccurrence
```python
{
  "id": 1,
  "farm_id": 1,
  "disease_type": "sea_lice",           # sea_lice, agd, pd, etc
  "severity": "HIGH",                   # LOW, MEDIUM, HIGH, CRITICAL
  "location_lat": 60.5,
  "location_lon": 5.5,
  "detected_at": "2026-01-15T10:00:00",
  "lice_count": 850,
  "mortality_rate": 0.12,
  "treatment_applied": "mechanical_delousing",
  "source_vessel_mmsi": "123456789",    # if from vessel
  "transmission_vector": "water_current",
  "confidence_score": 0.95,
  "is_resolved": false
}
```

### InfectionZone
```python
{
  "id": 1,
  "disease_type": "sea_lice",
  "center_lat": 60.5,
  "center_lon": 5.5,
  "radius_km": 15.0,
  "severity": "HIGH",
  "water_current_direction": "NE",      # compass direction
  "water_current_speed_knots": 1.2,
  "is_active": true,
  "active_until": "2026-01-29T10:00:00"
}
```

### RiskPropagation
```python
{
  "id": 1,
  "disease_occurrence_id": 1,
  "source_type": "farm",                # farm, vessel, unknown
  "source_farm_id": 1,
  "target_type": "farm",
  "target_farm_id": 2,
  "propagation_vector": "water_current",
  "transmission_probability": 0.65,    # 0-1
  "estimated_arrival_time": "2026-01-17T10:00:00",
  "alert_sent": false
}
```

### ModelPrediction
```python
{
  "id": 1,
  "source_farm_id": 1,
  "target_farm_id": 2,
  "disease_type": "sea_lice",
  "transmission_probability": 0.72,
  "predicted_arrival": "2026-01-18T00:00:00",
  "model_version": "v1.0",
  "model_accuracy": 0.82,
  "prediction_active": true,
  "verified": false
}
```

---

## 🧮 Risk Calculation Algorithm

### Farm Risk Score (0-1)
```
overall_risk = (vessel_risk * 0.4) + (zone_risk * 0.6)

vessel_risk = Σ(distance_factor * speed_factor * course_factor * current_factor)
zone_risk = Σ(zone_proximity * zone_severity * current_alignment)
```

### Distance Factor
```python
# Decreases with distance, max range 50km
distance_risk = max(0.0, 1.0 - (distance_km / 50))
```

### Course Factor
```python
# Higher if vessel courses toward farm
bearing_diff = abs(vessel_course - bearing_to_farm)
bearing_diff = min(bearing_diff, 360 - bearing_diff)
course_risk = max(0.0, 1.0 - (bearing_diff / 180))
```

### Water Current Factor
```python
# Considers current direction toward farm
current_bearing = water_current_direction
bearing_to_farm = calculate_bearing(farm_lat, farm_lon, target_lat, target_lon)
direction_diff = abs(current_bearing - bearing_to_farm)
current_risk = max(0.0, 1.0 - (direction_diff / 180)) * (current_speed_knots / 2)
```

---

## 🔗 BarentsWatch Integration

The system integrates with BarentsWatch APIs for real-time data:

### OAuth2 Credentials (in .env)
```
BARENTZWATCH_CLIENT_ID=your_email@example.com
BARENTZWATCH_CLIENT_SECRET=your_secret
BARENTZWATCH_TOKEN_URL=https://id.barentswatch.no/connect/token
BARENTZWATCH_API_BASE_URL=https://www.barentswatch.no/bwapi/v1
```

### Available Endpoints
- `/vessels` - Get vessels by geographic bounds
- `/fishing-activity` - Get fishing activity data
- `/ais` - Get AIS positioning data

---

## 📈 ML Model Training

### Features Used
1. **Disease characteristics**
   - Source disease type
   - Source severity
   - Lice count
   - Mortality rate

2. **Geographic factors**
   - Distance between farms
   - Water current speed & direction
   - Propagation vector type

3. **Historical patterns**
   - Historical transmission rates
   - Season (month)
   - Time since source detection

### Model Output
- **Transmission Probability**: 0-1 score
- **Confidence Level**: baseline, low, medium, high
- **Predicted Arrival**: Estimated time of disease arrival

### Training
```bash
# Retrain model on latest data
curl -X POST http://localhost:8000/api/research/train-model

# Generate new predictions
curl -X POST http://localhost:8000/api/research/predict-outbreaks
```

---

## 📊 Research Data Export

### Public Data Available
- Disease occurrence statistics
- Infection zone locations and characteristics
- Temporal patterns and trends
- Model accuracy metrics
- Propagation vector effectiveness

### Privacy Considerations
- Farm names and IDs anonymized in detailed export
- Personal vessel identifiers optional
- User data never exported
- Research usage watermarked

### Export Formats
```bash
# Summary statistics
GET /api/research/export-research-data

# Detailed anonymized data
GET /api/research/export-research-data/detailed?anonymize=true

# Full statistics report
GET /api/research/statistics?days=90
```

---

## ⚠️ Alert System

### Alert Types Generated

#### 1. Disease Occurrence
```
Alert: New disease occurrence at [Farm]
Severity: [CRITICAL/HIGH/MEDIUM/LOW]
Message: [Disease type] detected at [Location]
Action: [Treatment recommendations]
```

#### 2. Vessel Disease Exposure
```
Alert: Vessel [Name] exposed to [Disease]
Severity: HIGH
Message: Vessel has been in infection zone for [Disease]
Recommended actions:
- Desinfeksjon (Disinfection)
- Karantene (Quarantine)
- Inspeksjon (Inspection)
```

#### 3. High Risk Farm
```
Alert: High transmission risk for [Farm]
Severity: HIGH/CRITICAL
Risk Factors:
- Nearby vessel: [Vessel] at [Distance]km
- Infection zone: [Disease] at [Distance]km
Recommendations: Increase biosecurity measures
```

---

## 🔄 Background Tasks

### Scheduled Operations
- **Every hour**: Update infection zones from disease data
- **Every 6 hours**: Check vessel disease exposures
- **Every 12 hours**: Analyze farm risks and generate alerts
- **Daily**: Generate ML predictions
- **Weekly**: Retrain ML models

---

## 🧪 Testing

### Example API Calls

#### Report Disease
```bash
curl -X POST http://localhost:8000/api/disease/occurrences \
  -H "Content-Type: application/json" \
  -d '{
    "farm_id": 1,
    "disease_type": "sea_lice",
    "severity": "HIGH",
    "location_lat": 60.5,
    "location_lon": 5.5,
    "lice_count": 850,
    "mortality_rate": 0.12,
    "reported_by": "farm_operator"
  }'
```

#### Get Farm Risk Analysis
```bash
curl http://localhost:8000/api/disease/farm-risk/1 \
  -H "Authorization: Bearer demo-token-test"
```

#### Export Research Data
```bash
curl http://localhost:8000/api/research/export-research-data \
  -H "Authorization: Bearer demo-token-test"
```

---

## 📝 Environment Variables

```bash
# .env file
DATABASE_URL=sqlite:///./app.db
ENVIRONMENT=development
DEBUG=true

# BarentsWatch OAuth2
BARENTZWATCH_CLIENT_ID=your_email@example.com
BARENTZWATCH_CLIENT_SECRET=your_secret
BARENTZWATCH_TOKEN_URL=https://id.barentswatch.no/connect/token
BARENTZWATCH_API_BASE_URL=https://www.barentswatch.no/bwapi/v1

# Frontend
VITE_API_BASE_URL=http://localhost:8000
```

---

## 🐛 Troubleshooting

### Disease data not appearing
1. Ensure backend is running: `http://localhost:8000/health`
2. Check CORS is configured for frontend port
3. Verify example data was added: `python add_disease_data.py`

### ML predictions not generating
1. Ensure training data exists: `GET /api/research/training-data`
2. Retrain model: `POST /api/research/train-model`
3. Check backend logs for errors

### Vessel exposure alerts not triggering
1. Verify vessels have active status
2. Check infection zones are marked `is_active = true`
3. Run: `POST /api/disease/check-vessel-exposures`

---

## 📚 Documentation

- [API Documentation](/docs) - Swagger UI at `/docs`
- [Database Schema](/SCHEMA.md)
- [Installation Guide](/INSTALLATION.md)
- [Deployment Guide](/DEPLOYMENT.md)

---

## 🤝 Contributing

1. Create feature branch: `git checkout -b feature/your-feature`
2. Commit changes: `git commit -am 'Add feature'`
3. Push to branch: `git push origin feature/your-feature`
4. Submit pull request

---

## 📄 License

Proprietary - AquaShield 2026

---

**Last Updated**: 2026-01-15
**Version**: 1.0.0-disease-beta
