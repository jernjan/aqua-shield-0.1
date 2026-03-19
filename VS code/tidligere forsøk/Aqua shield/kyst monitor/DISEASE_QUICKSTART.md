# 🚀 Disease Risk System - Quick Start

## Step 1: Start Backend
```bash
cd backend
.\venv\Scripts\activate
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Backend running at: `http://127.0.0.1:8000`

## Step 2: Add Test Disease Data
Open new terminal:
```bash
cd backend
python add_disease_data.py
```

Output:
```
✓ Added disease occurrence at farm Fjord Farm North (sea_lice)
✓ Added disease occurrence at farm Coastal Aqua West (amoebic_gill_disease)
✓ Created infection zone for sea_lice around farm Fjord Farm North
✓ Created risk propagation from Fjord Farm North to Coastal Aqua West

✅ Example disease data added successfully!
```

## Step 3: Start Frontend
Open new terminal:
```bash
cd frontend
npm run dev
```

Frontend running at: `http://localhost:5175`

## Step 4: View Disease Risk Dashboard
1. Go to http://localhost:5175
2. Auto-login via demo mode
3. Click "Disease Risk" in navigation

## 📊 What You'll See

### Diseases Tab
- 2 active disease occurrences
- Sea lice (850 lice count, HIGH severity)
- Amoebic gill disease (MEDIUM severity)
- Timeline and location data

### Zones Tab
- 1 active infection zone for sea_lice
- 15km radius around Fjord Farm North
- Water current: NE @ 1.2 knots
- Severity: HIGH

### Risks Tab
- Farm risk analysis for both farms
- Risk scores calculated (0-1)
- Vessel proximity risks
- Infection zone proximity risks
- Risk level: LOW, MEDIUM, HIGH, or CRITICAL

---

## 🔌 API Endpoints (Test in Browser/Postman)

### Test Data
Frontend URL: http://localhost:5175

### API Base
Backend URL: http://127.0.0.1:8000

### Disease Endpoints
```bash
# Get all disease occurrences
http://127.0.0.1:8000/api/disease/occurrences?days=30

# Get infection zones
http://127.0.0.1:8000/api/disease/zones

# Get all farms risk analysis
http://127.0.0.1:8000/api/disease/all-farms-risk

# Get single farm risk
http://127.0.0.1:8000/api/disease/farm-risk/1
```

### Research Endpoints
```bash
# Export research data
http://127.0.0.1:8000/api/research/export-research-data

# Get statistics
http://127.0.0.1:8000/api/research/statistics?days=90
```

---

## 🧪 Testing Features

### Report New Disease
```bash
curl -X POST http://127.0.0.1:8000/api/disease/occurrences \
  -H "Content-Type: application/json" \
  -d '{
    "farm_id": 3,
    "disease_type": "pancreas_disease",
    "severity": "CRITICAL",
    "location_lat": 61.2,
    "location_lon": 6.8,
    "lice_count": 1200,
    "mortality_rate": 0.25,
    "reported_by": "surveillance"
  }'
```

### Check Vessel Exposures
```bash
curl -X POST http://127.0.0.1:8000/api/disease/check-vessel-exposures
```

### Manually Update Zones
```bash
curl -X POST http://127.0.0.1:8000/api/disease/update-zones
```

---

## 💡 Key Features to Explore

### 1. Disease Tracking
- Report diseases with lice count and mortality
- Track transmission vectors (water current, vessels, escaped fish)
- Mark diseases as resolved

### 2. Risk Analysis
- Automatic risk score calculation per farm
- Considers vessel proximity and water currents
- Identifies transmission pathways

### 3. Infection Zones
- Auto-generated from disease clusters
- Include water current modeling
- Expire after 14 days of inactivity

### 4. Research Export
- Public data available for researchers
- Anonymized farm information
- Statistics and trends
- Disease transmission patterns

---

## 📈 Next Steps

### 1. Integrate with BarentsWatch
Configure OAuth2 credentials in `.env`:
```
BARENTZWATCH_CLIENT_ID=your_email@example.com
BARENTZWATCH_CLIENT_SECRET=your_secret
```

Then system will auto-fetch:
- Vessel positions (BarentsWatch AIS data)
- Fishing activity zones
- Vessel movement patterns

### 2. Train ML Model
```bash
curl -X POST http://127.0.0.1:8000/api/research/train-model
```

This will:
- Analyze historical disease data
- Extract features (distance, water currents, etc)
- Calculate model accuracy

### 3. Generate Predictions
```bash
curl -X POST http://127.0.0.1:8000/api/research/predict-outbreaks
```

Returns predicted disease transmission risks.

### 4. Setup Alerts
- Automatically alerts farms at HIGH risk
- Notifies vessels in infection zones
- Recommends biosecurity measures

---

## 🐛 Debug Info

### Check Backend Status
```bash
curl http://127.0.0.1:8000/health
```

### View API Docs
```
http://127.0.0.1:8000/docs
```

### Check Database
SQLite database at: `backend/app.db`

---

## 📞 Support

For issues or questions:
1. Check logs in terminal running backend
2. Review API documentation at `/docs`
3. Check CORS configuration if frontend can't reach backend
4. Verify ports are not in use (5175 frontend, 8000 backend)

---

**Version**: 1.0.0
**Status**: Beta Release
**Last Updated**: 2026-01-15
