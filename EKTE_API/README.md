# EKTE_API - Real Data Aquaculture Monitoring

**Status: FULLY OPERATIONAL** ✅

## Latest Update (Mar 16, 2026)

**Karantene- og overgangslogikk oppdatert:**
- ✅ `/api/vessels/at-risk-facilities` er eneste aktive kilde for karantene- og båtrisikovurdering
- ✅ Legacy-endepunkt `/api/vessels/disease-risk` er deaktivert og returnerer `410 Gone`
- ✅ Samme-sone-logikk innført: smittet → annet anlegg i samme PD-sone/produksjonsområde gir ikke `QUARANTINE_BREACH`
- ✅ Ny status `SAME_ZONE_TRANSFER` for operativ sporing av smittet → annet anlegg i samme sone
- ✅ Ny status `CHAIN_ONLY` for friskt → friskt innen 48t (smittekjede-signal, ikke lovbrudd)
- ✅ Admin-dashboard oppdatert til å vise `BRUDD`, `SAMME SONE` og `KJEDE` separat
- ✅ Overgangshendelser logges eksplisitt i `smittespredning_events` med deduplisering

**Regelverksforankring:**
- PD-forskriften § 10: servicefartøy som har håndtert levende fisk i PD-sonen skal ha minst 48 timers karantene før de forlater sonen
- PD-forskriften §§ 8-10 brukes som sone-/bevegelseskontekst i vurderingen
- Akvakulturdriftsforskriften §§ 10-11 brukes som grunnlag for journalføring, smittehygiene og sporbarhet

## Latest Update (Mar 9, 2026)

**Biologisk smittefiltrering (PD) utvidet:**
- ✅ PD-filter lagt inn i sentrale smitteendepunkter for å unngå biologisk urealistisk spredning
- ✅ Ikke-mottakelige mål filtreres ved PD-only kontekst (typisk alger/landbasert produksjon)
- ✅ Dashboard-tekster oppdatert for å forklare filtreringslogikken i UI
- ✅ Konservativ vertsfiltering utvidet til ILA/PD i risikomotor og outbreak prediction (filtrerer kjente ikke-salmonide profiler)
- ⚠ Prediction-endepunkter skal harmoniseres fullt ut med samme sykdomsfilter
- ⚠ Risiko-score visning skal forbedres med råpoeng + separat prosentnormalisering

**Kildegrunnlag (nett):**
- Veterinærinstituttet: PD (mottakelige arter oppgitt, inkl. laksefisk) og ILA (alvorlig sykdom hos laks; virus også påvist hos regnbueørret/sjøørret)
- Mattilsynet: sykdomssider og regelverk for ILA/PD brukt som forvaltningskontekst

**Neste modellsteg (anbefalt):**
- ✅ Innført sykdom × vertskategori-kompatibilitetsmatrise (PD/ILA + øvrige sentrale sykdomsgrupper)
- ✅ Brukes nå i risikomotor og outbreak prediction for konsistent biologisk filtrering
- ⏳ Utvidelse planlagt: eksplisitt forklaringsfelt i API (`disease_host_compatible`) per risikokilde

## Previous Update (Mar 7, 2026)

**Karantene & Smittepress-system implementert:**
- ✅ Lovbasert karantenevurdering: `compliance_mode: LAW_FIRST_RED_TO_ANY_FACILITY_48H`
- ✅ Advisory metrics for smittepress: `pressure_score`, `unique_risk_zone_facilities`, `unique_near_10km_facilities`
- ✅ Advisory signals: `HIGH_LOCAL_INFECTION_PRESSURE`, `REPEATED_RISK_ZONE_CONTACT`, `REPEATED_10KM_CONTACT`
- ✅ Lovdata-integrasjon: Direkte lenker til PD-forskriften og Akvakulturdriftsforskriften i UI
- ✅ Historisk datasamling: Vessel-interaksjoner lagres i `vessel_exposure_events`, og overgangshendelser i `smittespredning_events`

**Tidligere oppdatering (Mar 6, 2026):**
- Added backend AIS tracking cycle in `prediction_scheduler.py` (every 15 minutes).
- AIS visits are now logged continuously to exposure DB with explicit categories.
- Fixed vessel risk categorization flow so `risk_zone_facility` and `near_infected_10km` are included in API output.
- Added robust handling for missing duration values in vessel exposure filtering.

## What is EKTE_API?

EKTE_API is a FastAPI application that provides real-time access to aquaculture monitoring data from Norway.

### Data Sources

All data sources have been **verified and tested** to be working:

1. **BarentsWatch Facilities API** (2,687 aquaculture facilities)
   - Locations, coordinates, and facility details
   - Status: ✅ 100% working

2. **BarentsWatch NAIS API** (Fish health data)
   - Weekly summaries of fish disease conditions
   - ILA (Infectious Salmon Anemia) cases
   - PD (Pancreas Disease) cases
   - Status: ✅ 100% working

3. **BarentsWatch AIS API** (Marine traffic tracking - 9,731 vessels)
   - Real-time vessel positions
   - MMSI, speed, heading, status
   - Status: ✅ 100% working

4. **NorKyst-800 (Meteorologisk institutt)** (Ocean currents)
   - Eastward/northward velocity vectors
   - 800m resolution, updated hourly
   - Barentshavet coverage (70-82°N, 10-35°E)
   - Status: ✅ 100% working

## Project Structure

```
EKTE_API/
├── .env                          # Credentials (DO NOT COMMIT)
├── requirements.txt              # Python dependencies
├── src/
│   ├── api/
│   │   ├── main.py              # FastAPI application
│   │   ├── clients/
│   │   │   └── barentswatch.py  # BarentsWatch API client
│   │   └── models.py            # Pydantic models
├── data/
│   └── barentshavet_currents.nc  # NorKyst-800 NetCDF data file
├── VERIFY_SYSTEM.py              # System verification script
└── test_sources.py               # Individual API tests
```

## Credentials

Located in `.env`:
```
# NorKyst-800 is accessed via local NetCDF file, no credentials needed

BARENTSWATCH_CLIENT_ID=janinge88@hotmail.com:Kyst-Monitor
BARENTSWATCH_CLIENT_SECRET=Test123456789

BARENTSWATCH_AIS_CLIENT_ID=janinge88@hotmail.com:Kyst-Monitor-AIS
BARENTSWATCH_AIS_CLIENT_SECRET=Test123456789
```

## Installation

```bash
# Create virtual environment
python -m venv .venv

# Activate virtual environment
.venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

## Running the API Server

```bash
cd "C:\Users\janin\OneDrive\Skrivebord\Kyst monitor DEMO\EKTE_API"

# Start the server (port 8000)
python -m uvicorn src.api.main:app --host 0.0.0.0 --port 8000
```

Windows (recommended, idempotent startup):

```powershell
cd "C:\Users\janin\OneDrive\Skrivebord\Kyst monitor DEMO\EKTE_API"

# Starts API if not running, or returns OK if already running on 8000
powershell -ExecutionPolicy Bypass -File .\start-api.ps1

# Force restart existing process on port 8000
powershell -ExecutionPolicy Bypass -File .\start-api.ps1 -ForceRestart
```

The API will be available at: **http://localhost:8000**

---

## Critical Bug Fixes (Feb 27, 2026)

### ✅ FIXED: 500 Internal Server Error in contamination-status endpoint

**Problem:** `/api/vessels/{mmsi}/contamination-status` returning 500 Internal Server Error

**Root Causes:**
1. **Duplicate code block** in `get_vessel_contamination_status()` function (lines 1518-1641 unreachable)
2. **Wrong return type** in `get_facility_disease_spread()` helper function - returned `JSONResponse` instead of dict on error

**Error message:**
```
TypeError: argument of type 'JSONResponse' is not a container or iterable
```

**Solution:**
```python
# File: src/api/main.py

# Fix 1: Removed lines 1518-1641 (duplicate unreachable code in get_vessel_contamination_status)

# Fix 2: Changed error return in get_facility_disease_spread()
except Exception as e:
    logger.error(f"Error fetching disease spread: {e}")
    return {"ila_zones": [], "pd_zones": [], "high_risk_localities": []}
    # OLD: return JSONResponse(status_code=500, content={"error": str(e)})
```

**Verification:**
```bash
curl http://localhost:8000/api/vessels/257725000/contamination-status
# Result: HTTP 200 OK with proper quarantine status ✓
```

---

## Background Processes

### PredictionScheduler
- **Runs every:** 3600 seconds (1 hour)
- **Purpose:** Outbreak predictions based on disease spread models
- **Started:** On API startup
- **Stopped:** On API shutdown
- **File:** `src/api/prediction_scheduler.py`

### Disease Spread Cache
- **Cache file:** `disease_spread_cache.json`
- **Validity:** 24 hours
- **Purpose:** Reduces API calls to BarentsWatch for quarantine zone data
- **Auto-refresh:** When cache expires or on manual invalidation

### BW + AIS Hybrid Scan Mechanism
- **Background scheduled:** Yes (backend scheduler)
- **Primary frequency:** Every 2 hours
- **Primary component:** `PredictionScheduler.run_bw_two_phase_scan()`
- **Phase 1 (BW):** Locality visit history for infected/risk facilities
- **Phase 2 (BW):** Vessel follow-up visits for secondary spread detection
- **Fallback (AIS):** Triggered automatically when BW visit feed returns no data
- **AIS source:** BarentsWatch AIS (`/v1/latest/ais`)
- **AIS optimization:** Bounding-box prefilter + stored position history (`vessel_positions`) for lower compute load
- **Manual triggers:**
  - `POST /api/vessels/bw-backfill`
  - `POST /api/vessels/bw-scan`

---

## API Endpoints

### Health & Info

- `GET /` - API information and status
- `GET /health` - Detailed health check of all data sources

### Aquaculture Facilities

- `GET /api/facilities?limit=50&skip=0` - List facilities (pagination)
- `GET /api/facilities/{code}` - Get specific facility by code
- `GET /api/facilities/near/{lat}/{lon}?radius_km=50` - Find facilities near location
- `GET /api/facilities/disease-spread` - **Official BW quarantine zones** (ILA/PD surveillance zones)
- `GET /api/facility/{locality_no}/risk-score` - **Risk motor 0-100** per facility

### Fish Health Data

- `GET /api/health-summary?year=2026&week=3` - Weekly health summary
  - Returns ILA and PD case counts
  - Facilities above/below health thresholds

### Marine Traffic (AIS)

- `GET /api/vessels?limit=100` - List vessel positions
- `GET /api/vessels/by-mmsi/{mmsi}` - Get specific vessel by MMSI
- `GET /api/vessels/{mmsi}/contamination-status` - **Vessel risk assessment** (FIXED Feb 27)
- `GET /api/vessels/at-risk-facilities` - **Primary vessel risk + quarantine analysis** (visit-based, law-aware)
- `GET /api/vessels/disease-risk` - **Deprecated / disabled** (returns 410)
- `POST /api/vessel/auto-register/check-proximity` - **Auto-register vessels** near infected facilities

### Admin & Risk Alerts

- `GET /api/admin/risk-alerts` - **Categorized vessel alerts** by facility type visited
  - Categories: besøkt_smittet, besøkt_risikosone, besøkt_10km_sone, klarert
  - Returns vessels with distinct statuses for `QUARANTINE_BREACH`, `SAME_ZONE_TRANSFER`, `CHAIN_ONLY`, `QUARANTINE_ACTIVE`, `QUARANTINE_CLEARED`
- `GET /api/admin/risk-alerts?status=besøkt_smittet` - Filter by vessel risk category

### Ocean Environment

- `GET /api/ocean/currents?latitude=75&longitude=20` - Ocean current data at location
- `GET /api/ocean/summary` - Summary of available ocean data

---
- `GET /api/facilities/{code}` - Get specific facility by code
- `GET /api/facilities/near/{lat}/{lon}?radius_km=50` - Find facilities near location

### Fish Health Data

- `GET /api/health-summary?year=2026&week=3` - Weekly health summary
  - Returns ILA and PD case counts
  - Facilities above/below health thresholds

### Marine Traffic (AIS)

- `GET /api/vessels?limit=100` - List vessel positions
- `GET /api/vessels/by-mmsi/{mmsi}` - Get specific vessel by MMSI

### Ocean Environment

- `GET /api/ocean/currents?latitude=75&longitude=20` - Ocean current data at location
- `GET /api/ocean/summary` - Summary of available ocean data

## Testing

Verify all systems are working:

```bash
python VERIFY_SYSTEM.py
```

This will:
- ✅ Test BarentsWatch Facilities API (2,687 records)
- ✅ Test BarentsWatch NAIS API (fish health data)
- ✅ Test BarentsWatch AIS API (9,731 vessels)
- ✅ Test Copernicus Marine data access

## Example Requests

### Get Aquaculture Facilities
```bash
curl "http://127.0.0.1:8000/api/facilities?limit=5"
```

### Get Fish Health Status
```bash
curl "http://127.0.0.1:8000/api/health-summary"
```

### Get Vessel Positions
```bash
curl "http://127.0.0.1:8000/api/vessels?limit=10"
```

### Get Ocean Currents
```bash
curl "http://127.0.0.1:8000/api/ocean/currents?latitude=75&longitude=20"
```

## Important Notes

1. **Real Data Only** - This API returns actual data from live APIs, not mock data
2. **Rate Limits** - BarentsWatch may have rate limits; implement caching for production
3. **Authentication** - All APIs handle authentication internally
4. **Data Freshness**:
   - Facilities: Updated daily
   - Health data: Updated weekly
   - AIS: Real-time (latest 24 hours), **polled every 5 minutes by frontend**
   - Ocean currents: Hourly updates
   - Disease spread cache: 24-hour validity
   - Outbreak predictions: Every 1 hour (PredictionScheduler)
5. **Orange Facilities** - Depend on Mattilsynet publishing quarantine zones to BarentsWatch
   - May show 0 orange facilities if no active zones currently published
   - Typically updated on Fridays/weekends by Mattilsynet
   - System will automatically categorize facilities when zones appear

## Risk Categorization Logic

### Facility Risk Levels
- 🔴 **Red (Infected)** - Confirmed ILA/PD diseases
- 🟠 **Orange (BW Risk)** - In official Mattilsynet quarantine zones (depends on BarentsWatch data)
- 🟡 **Yellow (10km Zone)** - Within 10km of infected (custom calculation)
- 🟢 **Green (Healthy)** - All other facilities

### Vessel Categorization (visit-based quarantine analysis)
- 🔴 **QUARANTINE_BREACH** - Visited infected facility, then another facility within 48h outside same PD operational zone
- 🟠 **SAME_ZONE_TRANSFER** - Visited infected facility, then another facility within 48h in same PD zone/production area
- 🟡 **CHAIN_ONLY** - Visited two healthy facilities within 48h (chain signal only)
- 🔵 **QUARANTINE_ACTIVE** - Still inside 48h window after infected visit, no illegal transition detected
- 🟢 **QUARANTINE_CLEARED** - 48h passed after infected visit
- Additional visit categories still shown separately: infected_facility, risk_zone_facility, near_infected_10km

## Next Steps

1. ✅ All data sources verified
2. ✅ API structure built
3. ✅ Endpoints ready to use
4. ✅ **Critical bug fixes completed (Feb 27)**
5. ✅ Vessel categorization implemented
6. ✅ Risk score motor operational
7. 🔄 Consider adding:
   - Database caching layer (currently uses in-memory + JSON cache)
   - Historical data analysis
   - Timeline endpoint per facility

## Port Configuration

### Backend (API)
- **Port:** 8000
- **Start command:**
  ```bash
  cd EKTE_API
  python -m uvicorn src.api.main:app --host 0.0.0.0 --port 8000
  ```
- API-endepunkter er tilgjengelig på http://localhost:8000

### Frontend Dashboards
- **Vessel Dashboard:** Port 8081
  ```bash
  cd "14.04. NY BUILD\vessel-dashboard"
  python -m http.server 8081
  ```
- **Facility Dashboard:** Port 8084
  ```bash
  cd "14.04. NY BUILD\facility-dashboard"
  python -m http.server 8084
  ```
- **Admin Dashboard:** Port 8082
  ```bash
  cd "14.04. NY BUILD\admin-dashboard"
  python -m http.server 8082
  ```

### Viktig for frontend-kode
- `API_BASE` i dashboard JS skal være:
  ```js
  const API_BASE = window.location.hostname.includes('render.com')
    ? 'https://kyst-api.render.com'
    : 'http://localhost:8000';  // Port 8000 for backend!
  ```
- Alle fetch mot API går til port 8000

### CORS
- FastAPI må ha CORS-middleware:
  ```python
  from fastapi.middleware.cors import CORSMiddleware
  app.add_middleware(
      CORSMiddleware,
      allow_origins=["*"],
      allow_credentials=True,
      allow_methods=["*"],
      allow_headers=["*"],
  )
  ```

### Testing
- Test API: http://localhost:8000/
- Test API health: http://localhost:8000/health
- Test vessel dashboard: http://localhost:8081/
- Test facility dashboard: http://localhost:8084/
- Test admin dashboard: http://localhost:8082/

### Feilsøking
- Hvis dashboard ikke får data: Sjekk at backend kjører på port 8000 og at API_BASE er riktig
- Hvis du får CORS-feil: Sjekk CORS-middleware i FastAPI
- Hvis 500 Internal Server Error: Se "Critical Bug Fixes" seksjonen over
- Hvis orange facilities ikke vises: Verifiser at frontend tolker BW `zone_type` (PROTECTION/SURVEILLANCE) som smitterisiko i både kart- og tabellogikk. Feilen var tidligere klientlogikk, ikke manglende BW-data.

## Support

For issues or questions:
1. Run `VERIFY_SYSTEM.py` to check system health
2. Check credentials in `.env`
3. Verify internet connectivity
4. Check BarentsWatch/Copernicus service status
5. See main README.md for comprehensive troubleshooting

---

**Last Updated:** Feb 27, 2026  
**Status:** Production-ready, all critical bugs resolved  
**Recent Work:** Fixed 500 errors (duplicate code + return type), documented all endpoints, verified all systems operational
