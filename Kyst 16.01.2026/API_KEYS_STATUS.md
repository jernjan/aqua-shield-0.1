# API Credentials & Access Status

**Last Verified**: January 20, 2026 - 16:00 UTC

## Summary
✅ **All credentials configured and functional**

---

## External API Connections

### 1. BarentsWatch v2 API
| Item | Status | Details |
|------|--------|---------|
| Client ID | ✅ OK | `janinge88@hotmail.com:Kyst-Monitor` |
| Secret | ✅ OK | `Test123456789` |
| Connection | ✅ OK | Successfully loads 1,777 facilities |
| Endpoint | v2 Lice Data | `/lice-data/v2` |

**Features Accessed**:
- Real-time lice monitoring data
- Facility locality information
- Disease data
- Lice treatment records
- Water quality parameters

---

### 2. AIS (Automatic Identification System)
| Item | Status | Details |
|------|--------|---------|
| Client ID | ✅ OK | `janinge88@hotmail.com:Kyst-Monitor-AIS` |
| Secret | ✅ OK | `Test123456789` |
| Connection | ✅ OK | Successfully queries vessel positions |
| Vessels Found | 342 ships | Near Lofoten (60°N, 5°E, 50km radius) |

**Features Accessed**:
- Real-time vessel tracking
- Speed and heading data
- MMSI identification
- Distance calculations
- Geographic filtering

---

## Database Connection

| Item | Status | Details |
|------|--------|---------|
| SQLite Database | ✅ OK | `kyst_monitor.db` (local) |
| Tables | ✅ 11 tables | All initialized |
| Risk Data | ✅ OK | 101 risk assessments |
| Disease Data | ✅ OK | 43 records |
| Vessel Data | ✅ OK | Tracking enabled |
| Ocean Data | ✅ OK | NorKyst-800 (local CMEMS CSV) |

---

## API Endpoints Status

### New Data Access Endpoints
- ✅ `GET /api/data/historical` - Facility historical data
- ✅ `GET /api/data/ocean-currents` - Ocean current measurements

### ML Prediction Endpoints
- ✅ `GET /api/predictions/risk` - ARIMA risk forecasting
- ✅ `GET /api/anomalies/detect` - Anomaly detection
- ✅ `GET /api/forecasts/outbreaks` - Outbreak probability
- ✅ `GET /api/recommendations/interventions` - Action recommendations

### Existing Endpoints
- ✅ `GET /api/risk/assess` - Risk assessment
- ✅ `GET /api/vessels/exposure` - Vessel exposure
- ✅ `GET /api/search/facilities` - Facility search
- ✅ `GET /api/search/vessels` - Vessel search

---

## Configuration Files

### `.env` File
```
BARENTSWATCH_CLIENT_ID=janinge88@hotmail.com:Kyst-Monitor
BARENTSWATCH_CLIENT_SECRET=Test123456789

AIS_CLIENT_ID=janinge88@hotmail.com:Kyst-Monitor-AIS
AIS_CLIENT_SECRET=Test123456789
```

### Location
- Path: `c:\Users\janin\OneDrive\Skrivebord\Kyst monitor DEMO\Kyst 16.01.2026\.env`
- Status: ✅ Loaded by `load_dotenv()` in main.py

---

## Client Implementations

### BarentsWatch Client
- File: `src/api/clients/barentswatch.py`
- Methods:
  - `get_lice_data_v2()` - ✅ Works
  - `get_facility_by_id(id)` - ✅ Works
  - OAuth token management - ✅ Automatic

### AIS Client
- File: `src/api/clients/ais_client.py`
- Methods:
  - `get_vessels()` - ✅ Works
  - `get_vessels_near_location()` - ✅ Works
  - Geographic filtering - ✅ Works

---

## Data Flow

```
BarentsWatch API (1777 facilities)
    ↓
    ├─ Lice data → risk_assessments table
    ├─ Disease data → disease_data table
    └─ Facility info → facilities table

AIS API (Real-time vessel tracking)
    ↓
    └─ Ship positions → vessel_positions table

Copernicus CMEMS
    ↓
    └─ Ocean currents → ocean_currents table

SQLite Database (kyst_monitor.db)
    ↓
    └─ ML Engine (Phase 4)
        ├─ Predictions (ARIMA)
        ├─ Anomaly detection
        ├─ Outbreak forecasting
        └─ Interventions
```

---

## Testing Commands

### Test BarentsWatch Connection
```bash
python -c "from src.api.clients.barentswatch import BarentsWatchClient; c = BarentsWatchClient(); print(len(c.get_lice_data_v2()))"
```

### Test AIS Connection
```bash
python -c "from src.api.clients.ais_client import AISClient; c = AISClient(); print(len(c.get_vessels_near_location(60, 5, 50)))"
```

### Test API Endpoints
```bash
curl http://127.0.0.1:8000/api/data/historical?facility_id=30&data_type=both
curl http://127.0.0.1:8000/api/data/ocean-currents?days=30
```

---

## Recommendations

✅ **No action required** - All systems are operational

### Optional Enhancements
1. Add rate limiting to external API calls
2. Implement caching for BarentsWatch data (updates daily)
3. Set up automatic data ingestion for Copernicus (currently manual)
4. Add credential rotation policy
5. Monitor API usage and costs

---

## Support

For credential updates or issues:
- Edit `.env` file in project root
- Restart API server to reload credentials
- Check `src/api/clients/` for implementation details

**Last Updated**: January 20, 2026
