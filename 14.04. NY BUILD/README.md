# Admin Dashboard - System Architecture & Data Flow

**Last Updated:** March 19, 2026  
**Version:** 14.04 (NEW BUILD)  
**Status:** ✅ Operational with complete rewrite

## 🔌 Port Policy (Canonical)

- **Admin Dashboard:** http://localhost:8080
- **Båtside (Vessel Dashboard):** http://127.0.0.1:8082
- **Facility Dashboard:** http://127.0.0.1:8084
- **Backend API (primary):** http://127.0.0.1:8000
- **Pilot Lite (isolert):** http://127.0.0.1:8085

---

## 🆕 Latest Changes (March 4, 2026)

**UI Improvement: Eliminated Column Redundancy in "Boats at Risk" Table**

| Before | After | Change |
|--------|-------|--------|
| **Risk Score:** 🦠 Infected | **Smittede besøkt:** 🦠 3 | Shows **count** of infected facilities (not just yes/no) |
| **Infected:** ⚠️ YES | **Risk Zone/10km:** ⚠️ Risk Zone (2), 📍 <10km (1) | Shows **secondary risks** separately |

**Problem Solved:** Three columns (Risk Level/Risk Score/Infected) all showed "high/infected/yes" - redundant and confusing.  
**Solution:** Separated primary infection count from secondary proximity risks with numerical values.

📍 **Files Changed:**
- `admin-dashboard/index.html` (lines 806-815) - Column headers
- `admin-dashboard/app.js` (lines 2650-2683) - Data processing logic

📖 **See:** "Recent Changes" section below for full technical details.

### Pilot Lite status (March 19, 2026)

Pilot Lite on port `8085` has been expanded from a lightweight profile viewer into a connected demo workflow between facility and vessel operations.

**What is now covered in Pilot Lite:**
- Facility-side creation of job requests, booking windows and operator policy per facility
- Vessel-side intake of incoming requests, accept flow and safer 2-step matching
- Quick planning to first available day in the route planner
- Shared calendar/routing flow between `facility-dashboard-lite.html` and `vessel-dashboard-lite.html`
- Confirmed routes, clearance signing and local/API fallback behavior
- Demo-focused vessel status with AIS, route status, contact, crew and health certificate metadata
- Export/import and audit-oriented flows on the facility side for policy and interoperability

**Pilot Lite purpose now:**
- Pre-sales demo of a full operational chain from facility need to vessel execution
- Fast onboarding with static `profile.json`
- Isolated validation of workflow changes without touching the main dashboards

For the detailed March 2026 overview of Pilot Lite, see `pilot-lite/README.md`.

---

## Purpose

The Admin Dashboard is the **system nerve center** - designed for administrative monitoring, disease prediction, and operational planning. It separates:

- **Regulatory Status** (BarentsWatch Zones): What the government says IS infected
- **Predictive Forecasts** (Outbreak Predictions): What the ML model predicts WILL BE infected
- **Operational Data** (Vessels, Facilities, Plans): Supporting information for decision-making

## Key Distinction: Regulatory vs. Predictive

### BarentsWatch Zones (Regulatory)
- **Data Source:** BarentsWatch API / Norwegian Directorate of Fisheries
- **What it shows:** Official disease zone declarations (225 facilities as of March 2026)
- **Risk Level Assignments:**
  - **EKSTREM (Red):** Restriction Zone - disease confirmed, strict movement prohibitions
  - **HØY (Orange):** Surveillance Zone - monitoring zone around infected sites
- **NOT a prediction:** Shows regulatory status only
- **Update frequency:** Changes when FKA issues new zone declarations

### Outbreak Predictions (ML Model)  
- **Data Source:** Internal 7-day predictive model
- **What it shows:** Calibrated outbreak probability forecasts (3,315 facilities analyzed)
- **Risk Distribution:**
  - **Critical (>25%):** 10 facilities at high transmission risk
  - **Medium (10-25%):** 44 facilities at moderate risk
  - **Low (<10%):** 3,261 facilities at lower risk
- **Calculation Method:** Multivariate analysis including:
  - Distance to nearest infected facility (0-100 score)
  - Boat visits (count, time since last visit)
  - Ocean current direction/magnitude
  - Disease type (ILA vs. PD transmission rates)
  - Quarantine boat visits (separate tracking)
- **Visualization:** Shows transmission factors and risk breakdown

## Dashboard Tabs & Functions

### System Overview
| Tab | Purpose | Data Source | Update Frequency |
|-----|---------|-------------|------------------|
| **Overview** | System KPIs, health status, data freshness | API aggregation | Real-time |
| **Outbreak Predictions** | 7-day disease spread forecast | ML model / internal | Hourly |
| **Infection Paths** | Network visualization of disease transmission | Exposure events DB | On-demand |
| **BarentsWatch Zones** | Official regulatory zones (recently renamed) | BarentsWatch API | When FKA updates |
| **Boats at Risk** | Vessels near infected zones | AIS tracking + API | Real-time |
| **Vessel Clearing** | Quarantine and disinfection plans | Internal DB | On-demand |
| **Confirmed Plans** | Official confirmed intervention plans | Internal DB | On-demand |
| **Audit Log** | System access & change log | Internal audit DB | Real-time |
| **Facilities** | Complete facility database browser | BarentsWatch + internal | Hourly |
| **Vessels** | Complete vessel database with positions | AIS feeds | Real-time |
| **Health** | System component status | Internal health checks | Real-time |
| **Ocean** | Ocean current & wave data | NorKyst-800 (Meteorologisk institutt) | Hourly |

## Facility and Vessel Dashboards

### Overview
The system includes two dedicated dashboards for end-users and vessel operators:

- **Facility Dashboard** (Port 8084):
  - URL: http://127.0.0.1:8084
  - Target users: Facility managers, site operators
  - Features: Real-time risk status, outbreak predictions, facility-specific data, and regulatory zone overlays
  - Data sources: Same backend API as admin dashboard, filtered for facility-relevant views
  - Typical use: Daily monitoring, compliance, and rapid response to risk changes

- **Vessel Dashboard** (Port 8082):
  - URL: http://127.0.0.1:8082
  - Target users: Vessel captains, crew
  - Features: Vessel-specific risk alerts, visit history, proximity to infected zones, and quarantine requirements
  - Data sources: Backend API, with focus on vessel movement and risk chain
  - Typical use: Route planning, compliance checks, and risk mitigation during operations

### Pilot Lite (Port 8085)
- URL: http://127.0.0.1:8085
- Target users: Customer demos, new onboarding
- Features: Isolated, lightweight demo package — `vessel-dashboard-lite`, `facility-dashboard-lite`, `ops-lite`, `calendar-lite`
- Current scope: shared facility↔vessel job flow, route planning, policy handling, clearance flow and demo metadata for vessel operations
- Data sources: Static `profile.json`, optionally enriched via `expand-nearby-facilities.py` against live API
- Typical use: Pre-sales demos, pilot trials, portable package delivery (`package-pilot-lite.ps1 -CreateZip`)
- See: `pilot-lite/README.md` for full onboarding

### Notes
- Main dashboards (Admin, Facility, Vessel) are static HTML/JS and require backend API on port 8000.
- Facility dashboard is optimized for site-level risk/compliance; vessel dashboard for operational risk/route planning.
- Pilot Lite is independent and can run without backend unless profile enrichment is needed.

## API Integration

### Ports
- **Backend API:** `http://127.0.0.1:8000` (FastAPI, Python)
- **Admin Dashboard:** `http://localhost:8080` (Static HTML/JS server)
- **Facility Dashboard:** `http://127.0.0.1:8084` (End-user view)
- **Vessel Dashboard (Båtside):** `http://127.0.0.1:8082` (Captain view)
- **Backend API (secondary):** `http://127.0.0.1:8002` (same EKTE_API codebase, secondary parallel instance — documented in 14.02 README)
- **Pilot Lite:** `http://127.0.0.1:8085` (Isolated customer demo — see `pilot-lite/README.md`)

### Key Endpoints Used

```
GET /api/facilities/disease-spread
├─ Returns: 225 facilities in BarentsWatch zones
├─ Fields: facility_name, facility_code, risk_level, risk_score, 
│          disease, zone_type (RESTRICTION|SURVEILLANCE), 
│          assessment_date, position, source
└─ Used by: "BarentsWatch Zones" tab

GET /api/outbreak/predictions
├─ Returns: 7-day forecast with ~3,315 facilities
├─ Fields: facility_code, risk_percentage, risk_level (CRITICAL|MEDIUM|LOW),
│          risk_factors (distance, visits, time, current, quarantine_visits)
└─ Used by: "Outbreak Predictions" tab

GET /api/vessels/at-risk-facilities
├─ Returns: Vessels with facility visit history
├─ Fields: vessel_name, mmsi, highest_risk_level, visited_infected,
│          has_48h_chain, visits[] (with visit_category field)
├─ Visit Categories: infected_facility, risk_zone_facility, near_infected_10km
└─ Used by: "Boats at Risk" tab
    └─→ Table displays:
        - Smittede besøkt: Count from visits.filter(visit_category='infected_facility')
        - Risk Zone/10km: Badges from risk_zone_facility + near_infected_10km counts

GET /api/health
├─ Returns: System component status
└─ Used by: "Health" tab overlay
```

## Data Flow Architecture

```
BarentsWatch API
├─ Facility list + disease status
└─→ API /api/facilities/disease-spread
    └─→ Admin Dashboard "BarentsWatch Zones" tab
        └─→ Displays regulatory zones + zone type + assessment date

AIS Vessel Tracking + Exposure Events DB
├─ Vessel positions + facility visit history
└─→ API /api/vessels/at-risk-facilities
    └─→ Admin Dashboard "Boats at Risk" tab
        └─→ Displays vessel risk levels + nearby infected zones

NorKyst-800 Ocean Currents + Exposure Events DB + Facility Database
├─ Ocean circulation + transmission chain history
└─→ ML Model (internal 7-day forecast)
    └─→ API /api/outbreak/predictions
        └─→ Admin Dashboard "Outbreak Predictions" tab
            └─→ Displays risk % + risk factors (distance, current, visits, etc.)

Facility + Vessel Database
├─ Complete facility/vessel records
└─→ API /api/facilities + /api/vessels
    └─→ Admin Dashboard "Facilities" + "Vessels" tabs
        └─→ Browse + filter + search database
```

## Key Implementation Notes

### 1. BarentsWatch Zones Tab (Regulatory Only)
- **Shows:** Only official FKA zones, NOT risk predictions
- **Visual Cues:**
  - 🔴 Red (RESTRICTION): Movement prohibited
  - 🟠 Orange (SURVEILLANCE): Enhanced monitoring required
- **No Warnings:** Removed "IMMEDIATE ACTION" text (was misleading)
- **Data Labels:** Shows disease name, zone type, assessment date, coordinates, data source
- **Transparency:** Clearly states "This facility is in a BarentsWatch-declared disease zone"

### 2. Outbreak Predictions Tab (Predictive)  
- **Shows:** 7-day probabilistic forecast, not current status
- **Visualization:** Risk % breakdown by level (Critical/Medium/Low)
- **Risk Factors Modal:** Click facility to see transmission probability breakdown
  - Distance factor (km to nearest infected)
  - Boat visit factor (frequency + time decay)
  - Ocean current risk (magnitude × direction)
  - Time since last visit (exponential decay)
  - Quarantine boat visits (separate pathway)

### 3. Vessel Tracking ("Boats at Risk" Tab)
- **Summary Cards:** Display 4/0/2 format (ekstrem/høy/moderat at-risk vessels)
- **Reads API field:** `highest_risk_level` (not empty `risk_level`)
- **Shows:** Which vessel near which zone
- **Table Columns:**
  - **MMSI:** Vessel identifier
  - **Vessel Name:** Ship name
  - **Risk Level:** Overall risk assessment (🔴 EKSTREM / 🟠 HØY / 🟡 MODERAT / 🟢 LAV)
  - **Smittede besøkt:** Count of infected facilities visited (🦠 icon with count)
  - **Visits (7d):** Total facility visits in last 7 days
  - **Risk Zone/10km:** Badges for risk zone visits (⚠️) and <10km proximity (📍)
  - **48h Chain:** Indicates if vessel is part of 48-hour transmission chain
  - **Actions:** View detailed vessel history
- **Column Logic:**
  - "Smittede besøkt" shows numerical count with prominent red styling when >0
  - "Risk Zone/10km" separates secondary risk factors from primary infected count
  - Previous "Infected" YES/NO column removed to eliminate redundancy

### 4. Admin Console Features
- County-based filtering (Troms, Nordland, etc.)
- Disease type filtering (ILA/PD dynamic)
- Risk level filtering
- Search by facility name/code
- Expandable facility cards with detailed info

## Configuration & Startup

### Start Services (in order)

```powershell
# 1. API Server (Port 8000)
cd "EKTE_API"
python -m uvicorn src.api.main:app --host 127.0.0.1 --port 8000

# 2. Admin Dashboard (Port 8080)
cd "14.04. NY BUILD\admin-dashboard"
python -m http.server 8080

# 3. (Optional) Facility Dashboard (Port 8084)
cd "14.04. NY BUILD\facility-dashboard"
python -m http.server 8084

# 4. (Optional) Vessel Dashboard / Båtside (Port 8082)
cd "14.04. NY BUILD\vessel-dashboard"
python -m http.server 8082

# 5. (Optional) Pilot Lite — isolated customer demo (Port 8085)
cd "14.04. NY BUILD\pilot-lite"
.\start-pilot-lite.ps1   # or: python -m http.server 8085
```

### Access Dashboard
- **Admin Console:** http://localhost:8080
- **Facility Dashboard:** http://127.0.0.1:8084
- **Vessel Dashboard (Båtside):** http://127.0.0.1:8082
- **Pilot Lite:** http://127.0.0.1:8085

## Recent Changes

### Session: March 4, 2026 - UI Column Redundancy Fix

**Problem Identified:**  
User reported that the "Boats at Risk" table had 3 columns showing essentially the same information:
- **Risk Level:** HØY (high risk assessment)
- **Risk Score:** 🦠 Infected (category badge)
- **Infected:** ⚠️ YES (boolean flag)

All three columns indicated "this vessel visited infected facility" in different ways, creating confusion.

**Root Cause Analysis:**
- Column 4 ("Risk Score") built category badges from `visit.visit_category` field
- Column 6 ("Infected") showed boolean `visited_infected` flag
- Both used the same underlying data (`visit_category === 'infected_facility'`)
- Result: Information redundancy across multiple columns

**Solution Implemented:**

**Files Modified:**
1. `14.04. NY BUILD\admin-dashboard\index.html` (lines 806-815)
   - Changed column headers for better semantic meaning
   
2. `14.04. NY BUILD\admin-dashboard\app.js` (lines 2650-2683)
   - Restructured data processing logic
   - Separated primary infected count from secondary risk factors

**Changes Made:**

✅ **Column 4: "Risk Score" → "Smittede besøkt"**
- Now displays: Numerical count of infected facilities visited
- Visual: `🦠 3` (prominent red styling when >0)
- Logic: `visits.filter(v => v.visit_category === 'infected_facility').length`
- Purpose: Shows **how many** infected facilities, not just YES/NO

✅ **Column 6: "Infected" → "Risk Zone/10km"**  
- Now displays: Secondary risk factor badges
- Visual: `⚠️ Risk Zone (2)` and `📍 <10km (1)` badges
- Logic: Separate counts for `risk_zone_facility` and `near_infected_10km` categories
- Purpose: Shows **proximity risks** separate from direct infection

✅ **Removed redundancy:**
- Previous: 3 columns all indicated "high risk + infected"
- Current: Clear separation between:
  1. Overall risk level (column 3)
  2. Direct infected facility visits with count (column 4)
  3. Secondary proximity risks (column 6)

**Technical Implementation:**

```javascript
// Before (app.js lines 2650-2665)
const categories = new Set();
categories.add('infected'); // Just boolean flag
categoryBadges = '🦠 Infected'; // Generic badge

// After
const infectedCount = visits.filter(v => v.visit_category === 'infected_facility').length;
const riskZoneCount = visits.filter(v => v.visit_category === 'risk_zone_facility').length;
const near10kmCount = visits.filter(v => v.visit_category === 'near_infected_10km').length;

// Display numerical count
infectedDisplay = infectedCount > 0 ? `🦠 ${infectedCount}` : '—';

// Separate secondary risks
riskBadges = riskZoneCount > 0 ? `⚠️ Risk Zone (${riskZoneCount})` : '';
```

**Result:**
- ✅ Eliminated UI confusion
- ✅ More informative data display (counts vs boolean)
- ✅ Clear semantic separation of risk factors
- ✅ Better user understanding of vessel risk profile

**Documentation Updated:**
- ✅ README.md (this file) - Section 3 "Vessel Tracking" expanded with full column descriptions
- ✅ API Integration section updated to show `visit_category` mapping to columns

### Previous Session Changes

✅ Renamed "Facility Risks" tab → "BarentsWatch Zones"  
✅ Updated panel header with regulatory explanation  
✅ Restructured facility display to show zone type + assessment date  
✅ Removed misleading "IMMEDIATE ACTION" warnings  
✅ Fixed vessel summary card display (ekstrem/høy/moderat counts)  
✅ Fixed vessel risk level field mapping  
✅ Created admin-dashboard README documenting architecture

## For Next Session / Agent

### Current System State (March 4, 2026)

**Admin Dashboard Status:** ✅ Fully operational  
**Backend API:** ✅ Running on port 8000  
**Admin UI:** ✅ Running on port 8080  

**Table Configuration:**
- **"Boats at Risk" tab:** 8 columns total
  - Column 4: "Smittede besøkt" (infected facilities count)
  - Column 6: "Risk Zone/10km" (secondary risk badges)
  - Data source: `/api/vessels/at-risk-facilities` endpoint
  - Field mapping: `visits[].visit_category` → column display

**Key Files & Line Numbers:**
- `admin-dashboard/index.html`: Lines 806-815 (table headers)
- `admin-dashboard/app.js`: Lines 2650-2683 (table row generation)
- `EKTE_API/src/api/main.py`: Vessel risk endpoints

**Testing:**
- Test vessels: 37 total (33 quarantine + 4 exposure events)
- All vessels correctly categorized with `visit_category` field
- Categories: `infected_facility`, `risk_zone_facility`, `near_infected_10km`

**Known Working:**
- ✅ Facility master integration
- ✅ Vessel categorization logic
- ✅ Distance calculations (facility-to-facility, not vessel-to-facility)
- ✅ Admin dashboard column display with counts

**If Issues Arise:**
1. Check backend API is running: `curl http://127.0.0.1:8000/health`
2. Verify admin dashboard: http://localhost:8080
3. Check browser console for JavaScript errors
4. Verify `visit_category` field exists in API response

---

## Known Limitations & Future Improvements

### Current Limitations
- Outbreak Predictions model doesn't show **transmission chain causality** (which infected facility → which boat → which at-risk facility)
- Zone update lag: Depends on FKA declaration timing
- Test vessel data only (6 vessels, not full fleet)

### Planned Improvements
- **Transmission Chain Visualization:** Show which specific infected facility drives each forecast
- **Boat Vector Tracking:** Display which vessel could transmit from source to at-risk facility
- **Time-Indexed Predictions:** Show risk evolution over the 7-day window
- **Alert Automation:** Notify on-call staff when facilities exceed threshold

## Troubleshooting

### API Connection Failed
```powershell
# Check if API is running
curl http://127.0.0.1:8000/health

# If port 8000 is in use
Get-NetTCPConnection -LocalPort 8000 | Stop-Process -Force
```

### BarentsWatch Tab Shows No Data
1. Click "Load BarentsWatch Zones" button first
2. Check API /api/facilities/disease-spread returns 225 facilities
3. Verify BarentsWatch data source is connected

### Outbreak Predictions Tab Shows 0 Risk
- This is a forecast model; test with 7-30 day historical data window
- Ensure exposure_events.db has recent transmission records

## Contact & Support

**System Admin:** Kyst Monitor Team  
**Last Update:** March 3, 2026  
**Next Review:** When new ML model version deployed
