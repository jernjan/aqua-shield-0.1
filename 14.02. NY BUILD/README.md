# Kyst Monitor DEMO - System Status & Quick Start

**Last Updated:** February 14, 2026  
**System Status:** ✅ **FULLY OPERATIONAL**

## Current System State

### ✅ Completed Features

1. **Risk Scoring Engine** - Fixed bug where same scores displayed for different distances
   - Now correctly sorts facilities by risk_score (highest first)
   - Facilities 3.6km away show correctly higher scores than 46km away

2. **Ocean Current Integration** (NEW)
   - Fetches real-time data from Copernicus Marine Service
   - Calculates virus travel direction based on ocean flow
   - Adjusts effective distance between facilities
   - Example: 0.2 m/s current × 5 days = 86km virus travel distance

3. **Enhanced Filtering**
   - County dropdown (Troms, Nordland, Trøndelag, Møre og Romsdal, Sogn og Fjordane, Hordaland, Rogaland, Vestland)
   - Dynamic disease filters (populated from actual data)
   - Facility search by name + code
   - Vessel disease filtering
   - Risk level filtering

4. **Disease Display**
   - Color-coded by type: **ILA (Red)** / **PD (Orange)**
   - Shows ALL nearby infected facilities (not just closest)
   - Displays up to 5 facilities with "...and X more" for additional facilities

5. **UI Improvements**
   - Compressed hero section (60% smaller)
   - Larger, more visible tab buttons
   - Warmed color palette (less blue, more neutral)
   - Clean disease badges with risk levels

---

## Quick Start

### 1. Start API Server

```powershell
cd "C:\Users\janin\OneDrive\Skrivebord\Kyst monitor DEMO\EKTE_API"
.\.venv\Scripts\python.exe -m uvicorn src.api.main:app --host 127.0.0.1 --port 8002
```

**Expected Output:**
```
INFO:     Uvicorn running on http://127.0.0.1:8002
INFO:     Application startup complete
```

Test health: `curl http://127.0.0.1:8002/health`

### 2. Start Dashboard Server

```powershell
cd "C:\Users\janin\OneDrive\Skrivebord\Kyst monitor DEMO\14.04. NY BUILD\admin-dashboard"
python -m http.server 8080
```

### 3. Access Dashboard

Open browser: **http://127.0.0.1:8080**

---

## Port Configuration

| Service | Port | Status |
|---------|------|--------|
| API Server | 8002 | ✅ Running |
| Dashboard | 8080 | ✅ Running |
| Old API (abandoned) | 8001 | ❌ Not used |

---

## Key Data Sources

### BarentsWatch (2,687 facilities)
- All aquaculture facilities in Norway
- Health data: ILA, PD infections
- Lice counts, mortality rates

### AIS Tracking (9,731+ vessels)
- Real-time vessel positions
- Speed, heading, MMSI
- Distance to infected facilities

### Copernicus Marine Service
- Ocean currents & wave data
- 9km resolution, updated hourly
- Integrated into risk calculations

---

## Dashboard Tabs

### 📊 Overview
- KPI summary (facilities at risk by level)
- System health status
- Data freshness indicators

### 🏭 Facility Risks
- All 1,056 at-risk facilities
- **Filters:**
  - Risk level (Ekstrem/Høy/Moderat/Lav)
  - County dropdown (8 Norwegian counties)
  - Disease type (ILA/PD + any detected)
  - Search by name/code
- **Shows:** All nearby infected facilities with color-coded diseases

### ⛵ Vessel Risks
- Vessels near infected facilities
- **Filters:**
  - Risk level
  - Disease type
- **Shows:** Nearby infected facility + its diseases

### 🛠️ Admin
- Advanced filtering
- Database management
- Risk threshold configuration

### 🌊 Ocean Data
- Currents & wave height
- Temperature
- Data source verification

### 🚢 Vessels
- Full vessel database browser
- Position filtering by lat/lon
- Speed filtering

### 🏛️ Facilities
- All facility database
- Geographic search
- Facility details

---

## Common Issues & Solutions

### API Won't Start

**Problem:** `Address already in use` or EADDRINUSE

```powershell
# Kill any existing processes on port 8002
Get-NetTCPConnection -LocalPort 8002 -State Listen -ErrorAction SilentlyContinue | 
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

### Dashboard Shows "API Error"

**Problem:** Dashboard can't reach API

- Check API is running on port 8002
- Dashboard should auto-connect to `http://127.0.0.1:8002`
- If CORS error, check API CORS settings in `main.py`

### Data Not Loading

**Problem:** Filters show but no data displays

1. Click **"Load facility risk"** tab first
2. Dashboard needs to fetch data before filtering
3. Each tab has a **Load** button - click it first

---

## System Architecture

```
Browser (localhost:8080)
    ↓
Dashboard HTML/JS
    ↓ (HTTP requests)
    ↓
FastAPI Server (localhost:8002)
    ↓
Data Sources:
├─ BarentsWatch API (facilities, health, vessels)
└─ Copernicus API (ocean currents)
    ↓
Risk Engine (calculates disease spread)
    ↓
Response to Dashboard
```

---

## Recent Changes (This Session)

✅ Fixed risk score sorting bug  
✅ Integrated ocean current data  
✅ Added county dropdown filter  
✅ Implemented dynamic disease filter population  
✅ Added vessel disease filtering  
✅ Restarted dashboard with all updates  

---

## For If Things Crash

### Complete System Restart

```powershell
# 1. Kill all Python processes
Get-Process python -ErrorAction SilentlyContinue | Stop-Process -Force

# 2. Kill existing servers
Get-NetTCPConnection -LocalPort 8002 -State Listen -ErrorAction SilentlyContinue | 
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue | 
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }

# 3. Wait a moment
Start-Sleep -Seconds 2

# 4. Restart API
cd "C:\Users\janin\OneDrive\Skrivebord\Kyst monitor DEMO\EKTE_API"
.\.venv\Scripts\python.exe -m uvicorn src.api.main:app --host 127.0.0.1 --port 8002

# 5. In another terminal - start dashboard
cd "C:\Users\janin\OneDrive\Skrivebord\Kyst monitor DEMO\14.04. NY BUILD\admin-dashboard"
python -m http.server 8080
```

---

## Contact & Notes

- **Ocean Current Data:** Fetched on-demand for diseased facilities only (caching implemented)
- **Risk Calculation:** Adjusts effective distance based on current direction and vessel survival (5-day window)
- **Filter Population:** Happens automatically when data loads
- **County Filter:** Matches facility name (facility name usually contains county)

---

**Remember:** Always start API (port 8002) BEFORE dashboard (port 8080)!
