# Phase 2 Tasks - Tier 1.5 & 2 Features (Mar 3, 2026)

## Session Start Checklist
```bash
# Verify system still running
curl http://127.0.0.1:8000/api/health

# Check database state (should show ~9 smittespredning events)
curl http://127.0.0.1:8000/api/exposure/smittespredning

# Start dashboards if needed
cd "c:\Users\janin\OneDrive\Skrivebord\Kyst monitor DEMO"
.\start-dashboard.ps1
```

---

## Priority 1: Auto-Detection Service Integration (Est. 2 hours)

### Goal
Move `SmittespredningDetector` from template to active background service that **automatically logs infection paths** when:
1. Vessel visits an infected facility (disease + proximity confirmed)
2. Vessel later arrives at other facilities within 48h window

### Current State
- Template class exists: `EKTE_API/src/api/smittespredning_detector.py`
- Has 2 async methods: `check_for_new_infections()` and `check_for_downstream_delivery()`
- Not integrated into startup flow

### Implementation Steps

#### Step 1.1: Integrate into `PredictionScheduler` (15 min)
- **File:** `EKTE_API/src/api/prediction_scheduler.py`
- **What to do:**
  - Import `SmittespredningDetector`
  - Create instance in scheduler startup
  - Add `check_for_new_infections()` call in main loop (every 15 min alongside disease_spread)
  - Add `check_for_downstream_delivery()` in same loop
- **Validation:** Scheduler logs show detection running

#### Step 1.2: Fix detector's disease lookup logic (30 min)
- **File:** `EKTE_API/src/api/smittespredning_detector.py`
- **Current issue:** `check_for_new_infections()` needs to:
  - Fetch current NAIS disease status (ILA/PD affected facilities)
  - Check which vessels are currently <1km from infected facilities
  - Log event if not already in database
- **What to check:**
  - Does it call BarentsWatch AIS endpoint? (use existing `get_vessel_details()`)
  - Does it fetch NAIS status? (use existing disease methods)
  - Does it avoid duplicate events? (check DB before logging)
- **Validation:** Manually run detector against test data, confirm events logged

#### Step 1.3: Implement downstream detection (30 min)
- **What it does:** Scans all smittespredning events from last 7 days, checks if origin vessel has since visited other facilities
- **Implementation:**
  - Get all smittespredning events with status="DETECTED"
  - For each, check AIS timeline for vessel in next 48h
  - If vessel arrives at new facility: create new event or update existing with destination
- **Validation:** Create test data with manual event, run detector, verify downstream event created

#### Step 1.4: Add email/log alerts (15 min)
- **File:** `EKTE_API/src/api/main.py` → new POST endpoint (or extend existing `/api/admin/alerts`)
- **What to do:**
  - When detector creates event, log to application logs with severity=ALERT
  - Optional: Send email to admin (use placeholder for now)
  - Format: `[BIOSECURITY ALERT] Vessel {mmsi} visited diseased facility {f1} on {date}, later arrived at {f2}`
- **Validation:** Check logs show alert messages when detector runs

---

## Priority 2: Admin Event Logging UI (Est. 1.5 hours)

### Goal
Add **"Log Smittespredning Event"** button + modal form to admin-dashboard so operators can manually log infection paths **without API calls**.

### Current State
- API endpoint exists: `POST /api/exposure/smittespredning`
- Admin dashboard exists but no UI form for event creation
- Only programmatic creation possible (scripts/curl)

### Implementation Steps

#### Step 2.1: Design modal form (20 min)
- **File:** `14.04. NY BUILD/admin-dashboard/index.html`
- **Form fields (minimal):**
  - Vessel MMSI (text input + validation for 9-digit)
  - Facility A (dropdown, fetched from `/api/facilities`)
  - Facility B (dropdown, optional - for downstream)
  - Disease type (radio: ILA / PD / UNKNOWN)
  - Detection method (radio: AIS_PROXIMITY / MANUAL / INSPECTION)
  - Status (dropdown: DETECTED / CONFIRMED_HEALTH / CONFIRMED_INFECTED)
  - Notes (textarea, optional)
- **Modal trigger:** "➕ Log Event" button in "Infection Paths" tab header

#### Step 2.2: Build modal HTML (20 min)
- **File:** `14.04. NY BUILD/admin-dashboard/index.html`
- **Structure:**
  ```html
  <div id="eventModal" class="modal" style="display:none;">
    <div class="modal-content" style="width: 500px;">
      <span class="modal-close" onclick="closeEventModal()">&times;</span>
      <h2>Log Smittespredning Event</h2>
      <form id="eventForm">
        <!-- form fields here -->
      </form>
      <button onclick="submitEventForm()">Create Event</button>
      <button onclick="closeEventModal()">Cancel</button>
    </div>
  </div>
  ```
- **Styling:** Add .modal, .modal-content, .modal-close to styles.css (use existing admin dashboard pattern)

#### Step 2.3: Implement form validation (15 min)
- **File:** `14.04. NY BUILD/admin-dashboard/app.js`
- **Validation logic in `submitEventForm()`:**
  - MMSI: must be 9 digits, check if vessel exists in `/api/vessels/{mmsi}`
  - Facility A/B: must be selected, check exist in facility list
  - Disease type: required
  - Status: required
  - If validation fails: show error message in modal, don't submit
- **Validation tool:** Use `validateMMSI()` helper function (create if needed)

#### Step 2.4: Connect to API + refresh (20 min)
- **File:** `14.04. NY BUILD/admin-dashboard/app.js`
- **Implementation:**
  ```javascript
  async function submitEventForm() {
    const formData = getFormValues(); // collect form input
    if (!validateFormData(formData)) return; // show errors
    
    const response = await fetch(`${API_BASE}/api/exposure/smittespredning`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(formData)
    });
    
    if (response.ok) {
      closeEventModal();
      loadSmittespredning(); // refresh table
      alert('✓ Event logged');
    } else {
      alert('✗ Failed to log: ' + (await response.text()));
    }
  }
  ```
- **Validation:** Create test event via form, verify appears in table

---

## Priority 3: Incoming Traffic Enhancement (Est. 2 hours)

### Goal
Overlay smittespredning paths on facility's **"🚢 Incoming Vessels"** widget so operators see "**This boat was at diseased facility 48h ago**"

### Current State
- Facility dashboard shows "Nearby vessels within 15km" (blue markers on map + list)
- Timeline exists but is separate view
- No smittespredning risk indicator in vessel list

### Implementation Steps

#### Step 3.1: Extend facility API response (20 min)
- **File:** `EKTE_API/src/api/main.py` → `get_facility_nearby_vessels()` endpoint
- **Current behavior:** Returns vessels within 15km radius
- **What to add:**
  - For each vessel: check if in smittespredning_events as origin in last 48h
  - Add field: `risk_path: {"detected_at": "FRØ", "detected_status": "DETECTED", "timestamp": 1234567890}`
  - If no risk path: return `risk_path: null`
- **Validation:** Check endpoint response includes new field

#### Step 3.2: Update nearby vessels list HTML (20 min)
- **File:** `14.04. NY BUILD/facility-dashboard/index.html` → Nearby Vessels panel
- **Current structure:** Likely a table or list showing vessel name, MMSI, distance, ETA
- **Add column:** "⚠️ Risk Path" after distance column
- **Validation:** HTML structure unchanged, just adds new column

#### Step 3.3: Render risk indicator (20 min)
- **File:** `14.04. NY BUILD/facility-dashboard/app.js` → function that renders nearby vessels
- **What to add:**
  ```javascript
  // In vessel row rendering
  if (vessel.risk_path) {
    riskCell.innerHTML = `
      <span class="risk-badge risk-${vessel.risk_path.detected_status}">
        ⚠️ Was at ${vessel.risk_path.detected_at}
      </span>
    `;
  } else {
    riskCell.innerHTML = '<span class="risk-badge risk-clear">✓ Clear</span>';
  }
  ```
- **Color coding:** Red for INFECTED, yellow for DETECTED, green for HEALTHY/CLEAR

#### Step 3.4: Add CSS styling (20 min)
- **File:** `14.04. NY BUILD/facility-dashboard/styles.css`
- **Add classes:**
  ```css
  .risk-badge {
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: bold;
  }
  .risk-badge.risk-INFECTED {
    background-color: #ffcccc;
    color: #cc0000;
  }
  .risk-badge.risk-DETECTED {
    background-color: #ffffcc;
    color: #cc6600;
  }
  .risk-badge.risk-HEALTHY {
    background-color: #ccffcc;
    color: #009900;
  }
  .risk-badge.risk-clear {
    background-color: #d0f0c0;
    color: #006600;
  }
  ```
- **Validation:** No visual regression, badges display correctly

#### Step 3.5: Add hover tooltip (20 min)
- **Optional enhancement:** Show full smittespredning details on hover
  ```javascript
  riskCell.title = `Last disease contact: ${vessel.risk_path.detected_at} 
                     Status: ${vessel.risk_path.detected_status}
                     Time: ${new Date(vessel.risk_path.timestamp * 1000).toLocaleString()}`;
  ```
- **Validation:** Hover shows tooltip

---

## Optional Tier 2 Items (If Time Permits)

### T2.1: Risk Score Recalculation (Est. 1 hour)
- **Goal:** When smittespredning event logged, recalculate all downstream facility risk scores
- **Implementation:**
  - In `submit_smittespredning_event()` API endpoint, call `recalculate_facility_risk()` for destination facility
  - Risk increases based on: origin facility disease type + timestamp proximity + vessel type

### T2.2: Alerts & Notifications (Est. 2 hours)
- **Goal:** Email/SMS alerts when infection path detected
- **Implementation:**
  - Add admin email list to config
  - When detector finds new infection path: send email with vessel/facility/time details
  - Optional: SMS for high-confidence CONFIRMED_INFECTED events

### T2.3: Historical Data Cleanup (Est. 30 min)
- **Goal:** Archive smittespredning events older than 90 days
- **Implementation:**
  - Add scheduler task to run weekly
  - Move old events to `smittespredning_events_archive` table or JSON export
  - Keep active database lean

### T2.4: Batch Event Upload (Est. 1.5 hours)
- **Goal:** Let operators upload CSV of vessel visits for bulk logging
- **Implementation:**
  - CSV format: vessel_mmsi, facility_from_id, facility_to_id, disease, date
  - Admin dashboard: "Upload Events" button → file picker → validation → batch create
  - Return summary: "X events created, Y skipped (duplicates), Z errors"

---

## Testing & Validation Strategy

### After Completing Each Priority:

**Priority 1 (Auto-Detection):**
```bash
# Verify detector running
curl http://127.0.0.1:8000/api/exposure/smittespredning | wc -l  # should increase

# Check logs for detection messages
# Admin dashboard: Infection Paths tab should show new events
```

**Priority 2 (Admin UI):**
```bash
# Open admin dashboard
http://127.0.0.1:8080

# Click "Infection Paths" tab → "➕ Log Event" button
# Fill form with test data (MMSI 259234000, FRØ → HJØRNEVIK, ILA)
# Verify event appears in table immediately

# Check raw API
curl http://127.0.0.1:8000/api/exposure/smittespredning | jq '.[0]'
```

**Priority 3 (Incoming Traffic):**
```bash
# Open facility dashboard
http://127.0.0.1:8002

# Select "Frøy" facility
# Check "Nearby Vessels" section for new "⚠️ Risk Path" column
# Verify icons show: ⚠️ for risk, ✓ for clear
# Hover tooltip shows facility details
```

---

## Summary
- **Total Estimated Time:** 5.5 hours (Priority 1-3)
- **Deliverables:** 3 major features + optional 4 enhancements
- **Resource:** Backend + Frontend changes across 2 main files per priority
- **Risk:** Low (all API endpoints already exist, just UI/integration)
- **Start Time:** Recommend 09:00 with priority 1, can complete 1-2 by EOD

---

## Quick Reference: File Locations

| File | Purpose | Modification Type |
|------|---------|-------------------|
| `EKTE_API/src/api/prediction_scheduler.py` | Detector integration | Import + loop add |
| `EKTE_API/src/api/smittespredning_detector.py` | Detection logic | Enhanced existing |
| `EKTE_API/src/api/main.py` | API response update | Function extension |
| `14.04. NY BUILD/admin-dashboard/index.html` | Event form modal | New section |
| `14.04. NY BUILD/admin-dashboard/app.js` | Form validation + submit | New functions |
| `14.04. NY BUILD/facility-dashboard/index.html` | Risk column | Single column add |
| `14.04. NY BUILD/facility-dashboard/app.js` | Risk rendering | Function enhancement |
| `14.04. NY BUILD/admin-dashboard/styles.css` | Modal styling | New classes |
| `14.04. NY BUILD/facility-dashboard/styles.css` | Badge styling | New classes |

---

## Session Transition Notes
- All test data (9 smittespredning events) preserved in database
- No breaking changes to existing APIs or dashboards
- Can test features incrementally as they're built
- Full documentation in TIER1_IMPLEMENTATION.md (reference for patterns)
