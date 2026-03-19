# Data Integrity Policy - Kyst Monitor

**Version**: 1.0  
**Date**: January 20, 2026  
**Status**: ACTIVE

---

## Core Principle

**NO SYNTHETIC DATA IN PRODUCTION**

- Real data only in production databases
- Synthetic data only in test scripts (clearly marked)
- Never mix real and fake data in ML models
- "NO DATA" message better than false predictions

---

## Data Classification

### REAL DATA ✅
- BarentsWatch API data (1,777 facilities)
- AIS vessel tracking data (live positions)
- Risk assessments (101 records in DB)
- Disease data (43 records in DB)
- Ocean currents (when available from Copernicus)

### SYNTHETIC DATA (TEST ONLY) ⚠️
- **File**: `test_ml_endpoints.py`
- **Purpose**: Unit testing ML endpoints
- **Status**: Local test database only, never production
- **Usage**: `python test_ml_endpoints.py`
- **Data scope**: Facility ID 10001 with 30 days synthetic history

### NO DATA HANDLING ❌
- Insufficient data: Return `"status": "insufficient_data"`
- Missing facility: Return HTTP 404
- Empty results: Return empty arrays `[]`, not defaults
- Never interpolate, extrapolate, or estimate

---

## API Endpoint Data Policies

### `/api/predictions/risk`
```json
{
  "facility_id": 14746,
  "status": "insufficient_data",
  "message": "Less than 7 historical records available",
  "predictions": []
}
```
- **Requirement**: Minimum 7 historical records
- **Fallback**: None - returns "insufficient_data"
- **No defaults**: Empty array when no data

### `/api/anomalies/detect`
```json
{
  "facility_id": 14746,
  "status": "insufficient_data",
  "anomalies_detected": 0,
  "anomalies": []
}
```
- **Requirement**: Minimum 5 lice data records
- **No synthetic**: Real disease_data only
- **Message**: "insufficient_data" status

### `/api/forecasts/outbreaks`
```json
{
  "facility_id": 14746,
  "status": "insufficient_data",
  "outbreak_probability": null
}
```
- **Requirement**: Real risk history + disease data
- **No estimates**: Returns null, not estimate

### `/api/recommendations/interventions`
```json
{
  "facility_id": 14746,
  "status": "insufficient_data",
  "recommendations": []
}
```
- **Requirement**: Real assessment data
- **No generic tips**: Empty array if no data

### `/api/data/historical`
```json
{
  "facility_id": 30,
  "count": 0,
  "status": "no_data",
  "risk_assessments": [],
  "disease_data": []
}
```
- **Source**: SQLite database only
- **No interpolation**: Returns actual records only
- **Empty when empty**: `[]` arrays

### `/api/data/ocean-currents`
```json
{
  "count": 0,
  "status": "no_data",
  "ocean_currents": []
}
```
- **Source**: Copernicus CMEMS data
- **Status**: Currently empty (not implemented yet)
- **No defaults**: Returns empty array

---

## ML Model Training

### PRODUCTION MODELS
✅ Only trained on real data from:
- Risk assessments (real facility data)
- Disease data (real lice counts)
- Vessel tracking (real positions)
- Historical patterns (real observations)

### TEST MODELS
⚠️ Can use synthetic data in:
- `test_ml_endpoints.py` - unit tests
- Model development/tuning scripts
- Feature engineering validation

### NEVER:
❌ Mix synthetic + real data in training  
❌ Deploy test models to production  
❌ Use fallback predictions in reports  
❌ Publish estimated data as real  

---

## Database Integrity

### Current Data Status (Jan 20, 2026)

| Table | Records | Source | Status |
|-------|---------|--------|--------|
| facilities | ~1,777 | BarentsWatch | ✅ Real |
| risk_assessments | 101 | System | ✅ Real |
| disease_data | 43 | BarentsWatch | ✅ Real |
| vessel_positions | varies | AIS API | ✅ Real |
| ocean_currents | 0 | Copernicus | ⚠️ Empty |
| alerts | varies | System | ✅ Real |
| vessel_facility_exposure | varies | Computed | ✅ Real |

### What To Do With Each
- **Real data**: Use as-is, no modifications
- **Empty tables**: Display "NO DATA", not defaults
- **Computed data**: Recalculate from real data, never cache fake

---

## Testing Strategy

### Unit Tests (SYNTHETIC OK)
```python
# test_ml_endpoints.py
def create_synthetic_data():
    """Create synthetic data for testing endpoints."""
    # Creates facility 10001 with 30 days fake history
    # Used ONLY in test environment
```

### Integration Tests (REAL DATA)
```python
# Against production database
# Test with real facilities (14746, etc)
# Returns "NO DATA" when appropriate
```

### Load Tests (REAL DATA)
```python
# Use real dataset of 1,777 facilities
# Don't multiply or generate extras
# Test performance, not data accuracy
```

---

## Reporting & Visibility

### Dashboard Messages
- ✅ "Risk Score: 65" - real data
- ✅ "Insufficient Data" - no data
- ❌ "Risk Score: ~65 (estimated)" - never this
- ❌ "Risk Score: 65" - when synthetic data

### Export/Reports
- ✅ Export only real data
- ✅ Mark missing values as "N/A"
- ❌ Never fill gaps with averages
- ❌ Never show "typical" defaults

### API Documentation
```
Returns: Real data or 404/empty
Never returns: Estimates, defaults, synthetic
```

---

## Compliance Checklist

### For Each API Endpoint
- [ ] Only uses real data from database/APIs
- [ ] Returns 404 or empty array if missing
- [ ] Never generates default values
- [ ] Never interpolates data
- [ ] Never uses test data in production
- [ ] Logs "NO DATA" status clearly

### For Each ML Model
- [ ] Trained only on real data
- [ ] Requires minimum samples (7, 5, etc)
- [ ] Returns "insufficient_data" below threshold
- [ ] Never estimates when data missing
- [ ] Confidence intervals are real, not fabricated

### For Each Dashboard
- [ ] Shows "NO DATA" when appropriate
- [ ] Never shows synthetic in real view
- [ ] Clear distinction real vs incomplete
- [ ] Links to data sources
- [ ] Shows data refresh timestamps

---

## Incident Response

### If Synthetic Data Detected in Production

1. **Immediate**: Stop data ingestion
2. **Verify**: Which datasets contaminated
3. **Document**: What, when, impact
4. **Purge**: Remove synthetic records
5. **Retrain**: Models with clean data only
6. **Test**: Before redeployment
7. **Report**: Log all changes

---

## Future Data Sources (When Ready)

| Source | Status | When |
|--------|--------|------|
| Copernicus CMEMS | Configured | Ready (needs data) |
| Temporal data | Partial | Historical available |
| Sensor networks | Not yet | Planned Phase 6 |
| Feed quality | Not yet | Planned Phase 6 |
| Fish health | Not yet | Planned Phase 6 |

---

## Summary

**Kyst Monitor data policy is simple:**
- Real data only
- No data is OK (show "NO DATA")
- Never fake it
- Trust the data or improve collection

**This ensures:**
✅ ML models stay accurate  
✅ Decisions based on facts  
✅ No corruption over time  
✅ Regulatory compliance  
✅ Scientific integrity  

---

**Approved by**: System Architecture  
**Last Updated**: January 20, 2026  
**Next Review**: March 20, 2026
