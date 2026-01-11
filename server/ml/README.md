# 🤖 ML Training Pipeline - Aqua Shield

Machine learning pipeline for predicting fish disease outbreak risk based on historical BarentsWatch data and vessel movement patterns.

## Overview

This pipeline:
1. **Collects** historical outbreak data from BarentsWatch Fishhealth API (2012-present)
2. **Analyzes** vessel movements during outbreak periods
3. **Trains** a risk prediction model
4. **Generates** predictions for facility risk assessment
5. **Exports** training data and trained models

## Components

### 1. `history-crawler.js`
Fetches outbreak history from BarentsWatch Fishhealth API.

**Features:**
- Retrieves 10+ years of outbreak data
- Calculates disease duration and severity
- Generates synthetic vessel movement data during outbreaks
- Exports to CSV for training

**Usage:**
```bash
node server/ml/history-crawler.js
```

**Output:**
- `data/ml-outbreaks-history.csv` - Raw outbreak records
- `data/ml-vessel-movements.csv` - Vessel positions during outbreaks
- `data/ml-training-data.csv` - Combined training examples

### 2. `risk-model.js`
Trains risk prediction model from collected data.

**Features:**
- Loads training data from CSV
- Calculates disease statistics by type
- Builds predictive model
- Makes risk predictions for facilities

**Usage:**
```bash
node server/ml/risk-model.js
```

**Output:**
- `data/risk-model.json` - Trained model (JSON format)

### 3. `pipeline.js`
Orchestrator that runs complete workflow.

**Features:**
- Runs data collection → training → evaluation in sequence
- Tests predictions on sample cases
- Generates comprehensive report
- Handles all errors gracefully

**Usage:**
```bash
node server/ml/pipeline.js
```

## Model

### Risk Scoring
Risk is calculated as 0-100 score based on:
- **Historical Prevalence** (0-30 points): How common is this disease?
- **Vessel Contact** (0-40 points): How many vessels were nearby?
- **Severity** (0-30 points): How severe was outbreak historically?

### Risk Levels
- **Lav** (Low): 0-29
- **Moderat** (Moderate): 30-49
- **Høy** (High): 50-69
- **Kritisk** (Critical): 70+

### Confidence
Confidence = min((historical_count / 10) × 100, 95%)

## Data Schema

### Training Data (ml-training-data.csv)
```
outbreakId,facilityNo,facilityName,diseaseCode,diseaseName,startDate,endDate,durationDays,severity,latitude,longitude,vesselContactCount,avgVesselDistance,...
```

### Trained Model (risk-model.json)
```json
{
  "trainingSize": 150,
  "timestamp": "2026-01-11T...",
  "diseases": {
    "ISA": {
      "count": 45,
      "avgDuration": 32,
      "minDuration": 5,
      "maxDuration": 120,
      "avgVesselContact": "2.3",
      "prevalence": "30.0%"
    },
    "PD": { ... }
  }
}
```

## Example Prediction

```javascript
const RiskPredictionModel = require('./risk-model');
const model = new RiskPredictionModel();
model.load('data/risk-model.json');

const prediction = model.predictRisk({
  diseaseCode: 'ISA',
  vesselContactCount: 3,
  latitude: 65.0,
  longitude: 12.0
});

console.log(prediction);
// Output:
// {
//   risk: 'høy',
//   riskScore: 62,
//   confidence: 85.5,
//   historicalDuration: 32,
//   prevalence: '30.0%',
//   avgVesselContact: '2.3'
// }
```

## Integration with Backend

The trained model can be integrated with the Express API:

```javascript
// server/index.js
const RiskPredictionModel = require('./ml/risk-model');

const riskModel = new RiskPredictionModel();
riskModel.load('data/risk-model.json');

app.post('/api/predict-risk', (req, res) => {
  const { diseaseCode, vesselContactCount, latitude, longitude } = req.body;
  const prediction = riskModel.predictRisk({
    diseaseCode, 
    vesselContactCount, 
    latitude, 
    longitude
  });
  res.json(prediction);
});
```

## Data Flow

```
BarentsWatch Fishhealth API
           ↓
    history-crawler.js
           ↓
    CSV files (raw data)
           ↓
    risk-model.js (training)
           ↓
    JSON model
           ↓
    Backend API predictions
           ↓
    Frontend risk display
```

## Files Structure

```
server/ml/
├── history-crawler.js    # Data collection
├── risk-model.js         # Model training & prediction
├── pipeline.js           # Orchestrator
└── README.md            # This file

server/data/
├── ml-outbreaks-history.csv
├── ml-vessel-movements.csv
├── ml-training-data.csv
├── risk-model.json
└── ml-results/
    └── report-*.json     # Execution reports
```

## Next Steps

1. ✅ Collect historical data
2. ✅ Train initial model
3. ✅ Test predictions
4. ⏳ Integrate with backend API
5. ⏳ Display predictions in AdminMVP
6. ⏳ Retrain model monthly with new data
7. ⏳ Fine-tune model parameters based on accuracy

## Performance

- Data collection: ~5-10 seconds (depends on BarentsWatch API)
- Model training: ~1-2 seconds
- Single prediction: <1ms
- Memory: ~10-50MB

## Troubleshooting

### BarentsWatch API timeout
- API may be temporarily unavailable
- Model handles gracefully, returns empty data
- Retry with `node server/ml/pipeline.js` again

### Missing data files
- Ensure `server/data/` directory exists
- Run pipeline to generate files

### Model not loading
- Check that `data/risk-model.json` exists
- Verify JSON format is valid

## Future Improvements

- [ ] Use numpy/scikit-learn for advanced ML
- [ ] Add time-series analysis (ARIMA)
- [ ] Integrate environmental factors (temperature, currents)
- [ ] Add facility capacity correlation
- [ ] Build confidence intervals for predictions
- [ ] Implement A/B testing for model variants
