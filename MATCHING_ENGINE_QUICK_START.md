# Pilot Lite Matching-Engine - Quick Start Guide

## 🚀 Start the System

### Prerequisites
- Node.js compatible browser (Chrome, Firefox, Safari, Edge)
- API running on port 8000 (optional - works offline)
- Dashboard on port 8085

### Step 1: Verify Files Created
```powershell
# Check job-store.js exists
ls "c:\Users\janin\OneDrive\Skrivebord\Kyst monitor DEMO\14.04. NY BUILD\pilot-lite\app\job-store.js"

# Output: Should show file size ~12,689 bytes
```

### Step 2: Open Dashboards
```
Facility Dashboard: http://127.0.0.1:8085/facility-dashboard-lite.html
Vessel Dashboard:   http://127.0.0.1:8085/vessel-dashboard-lite.html
```

---

## 📋 Test Scenario 1: Facility Creates Job

### Step A: Facility Dashboard - Create Job
1. Open http://127.0.0.1:8085/facility-dashboard-lite.html
2. **Left panel**: Click on any facility in "Mine anlegg" list
   - Example: "Aarsand" or any facility name
3. **Right panel**: Scroll to "Opprett jobbforespørsel" section
   - Should be visible when facility selected
4. **Fill form**:
   - Jobbtype: Select "Desinfeksjon"
   - Startdato: Select today's date (calendar widget)
   - Sluttdato: Select same date
   - Foretrukket tidspunkt: Keep default "10:00"
   - Estimert timer: Keep "4"
   - Prioritet: Select "Normal"
5. **Click**: "Opprett jobbrequest"
6. **Expect Toast**: "Job opprettet med forslag" OR "Ingen forslag" (depends on vessels available)

### Step B: Check Job List
- Below form in "Mine jobber" section, new job should appear as card:
  ```
  Desinfeksjon
  [Today's date] · Normal
  [X] forslag · Status: opprettet
  ```

### Step C: Check 7-Day Calendar
- Right panel lower section: "7-dagers plan"
- Should show 7 cards (one per day)
- Today's card shows: "1 job planlagt" (red/warn styling)
- Other 6 days show: "Ledig" (green/ok styling)

---

## ⛵ Test Scenario 2: Vessel Sees Job Suggestions

### Step A: Vessel Dashboard - View Suggestions
1. Open http://127.0.0.1:8085/vessel-dashboard-lite.html
2. **Left panel**: Select vessel from list
   - Example: Any boat in "Mine båter" dropdown
3. **Right panel**: Look for NEW section "Jobbforslag fra anlegg"
   - Should appear near top, before "Mine forespørsler"
4. **If job was created**: Section shows job cards

### Step B: Examine Job Proposal Card
Card should display:
```
[Facility Name] · [Job Type]              ← Title
[Start Date] til [End Date] · Prioritet: [priority]  ← Dates
Matchscore: [0-100] · ETA: [timestamp]    ← Match quality
[Reason 1] • [Reason 2]                   ← Why it matches
[Godta] [Avslå]                          ← Action buttons
```

Examples of reasons:
- "Nær anlegg (15.2 km)"
- "Riktig båttype (servicefartøy)"
- "Ledig 2/2 dager"
- "Karantene og desinfeksjon fullført"

### Step C: Accept Job
1. **Click "Godta"** button
2. **Expect Toast**: "Godtatt! Du har godtatt jobben. Anlegget er notifisert."
3. **Job disappears** from suggestions (status changed to "godtatt")

---

## 🧪 Test Scenario 3: Matching Algorithm

### Verify Location Scoring

**Setup:**
- Facility A at coordinates (60.5, 5.3) [example: Bergen area]
- Vessel B at coordinates (60.6, 5.2) [15 km away, example: nearby]
- Create job at Facility A
- Check if Vessel B gets suggested

**Expected Behavior:**
- Vessel within 20 km = GREEN badge (score >70)
- Vessel within 50 km = ORANGE badge (score 50-70)
- Vessel >100 km = NOT suggested (removed)

### Verify Boat Type Matching

**Setup:**
- Create job requiring "servicefartøy" (service vessel)
- If vessel category = "servicefartøy" → +25 pts
- Display reason: "Riktig båttype (servicefartøy)"

### Verify Availability Checking

**Setup:**
- Create job for 3 days (Mon-Wed)
- If vessel has calendar events on 1 of those days:
  - Score reduced: 25 * (2/3) = ~17 pts instead of 25 pts
  - Display: "Ledig 2/3 dager" (conflicts flagged)
  - Issue shown: "Opptatt på en av de ønskede dagene"

### Verify Clearance Status

**Setup:**
- Vessel with clearance record:
  - `quarantineCompleted: true`
  - `disinfectionCompleted: true`
  - → +20 pts
- Display: "Karantene og desinfeksjon fullført"

---

## 🐛 Debugging Checklist

### Browser Console (F12 → Console tab)

**Check for errors:**
```javascript
// Should see no red errors about:
// - "job-store.js not found"
// - "undefined function createJob"
// - "localStorage quota exceeded"
```

**Verify job was created:**
```javascript
// Paste in console:
localStorage.getItem('pilotLiteJobsV1')

// Output should show JSON with jobs:
// {"jobs":{"JOB_1_TIMESTAMP":{...}}, "jobIdCounter":1, "matches":{}}
```

**Check proposals generated:**
```javascript
// Paste in console:
const store = JSON.parse(localStorage.getItem('pilotLiteJobsV1'));
Object.values(store.jobs)[0].proposals

// Output should show array of proposal objects:
// [{vesselId: "...", matchScore: 85, eta: "..."}]
```

### Network Tab (F12 → Network)

**Verify no failed requests:**
- Should NOT see red HTTP errors for:
  - `/app/job-store.js` (404)
  - `/api/pilot/clearances` should succeed or timeout gracefully
- SUCCESS: Job created without network requests (all client-side)

---

## 📊 Performance Expectations

| Operation | Expected Time |
|-----------|----------------|
| Create job + matching | <500ms |
| Render 7-day calendar | <100ms |
| Accept job | <200ms |
| Load suggestions on page | <1s |

**Monitor:**
- F12 → Performance tab → Record
- Click "Opprett jobbrequest"
- Check timeline for blue/green/yellow operations

---

## ❌ Troubleshooting

### Problem: Job form doesn't appear

**Solution:**
1. Click facility in left panel again (selection lost?)
2. Check console: `document.getElementById('jobRequestPanel')`
3. Verify `facility-dashboard-lite.html` loaded without errors

### Problem: No suggestions appear on vessel dashboard

**Possible Causes:**
- No jobs created yet → Go back to Facility Dashboard, create one first
- Job created but vessel too far away (>100km radius)
- Vessel type doesn't match job requirements
- Browser localStorage limit reached

**Solution:**
```javascript
// Check jobs exist:
const jobs = JSON.parse(localStorage.getItem('pilotLiteJobsV1')).jobs;
console.log("Total jobs:", Object.keys(jobs).length);

// Check if vessel has any proposals:
Object.values(jobs).forEach(job => {
  if (job.proposals?.length > 0) {
    console.log("Job:", job.id, "Proposals:", job.proposals.length);
  }
});
```

### Problem: Accept button doesn't work

**Solution:**
1. Open F12 Console
2. Look for errors when clicking "Godta"
3. Check if toast appears (message at bottom right)
4. Verify: `localStorage.getItem('pilotLiteJobsV1')` → job status should change to "godtatt"

### Problem: 7-day calendar shows wrong dates

**Solution:**
- Calendar runs relative to TODAY's date
- If system date is wrong, adjust in OS
- Future work: Add manual date override in settings

---

## 📝 Data Inspection

### View All Jobs
```javascript
const store = JSON.parse(localStorage.getItem('pilotLiteJobsV1'));
console.table(Object.values(store.jobs).map(job => ({
  id: job.id,
  facility: job.facilityName,
  type: job.jobType,
  dates: `${job.startDate} to ${job.endDate}`,
  status: job.status,
  proposals: job.proposals?.length || 0
})));
```

### View All Proposals for a Job
```javascript
const store = JSON.parse(localStorage.getItem('pilotLiteJobsV1'));
const job = Object.values(store.jobs)[0]; // First job
console.table(job.proposals || []);
```

### Clear All Data (RESET)
```javascript
localStorage.removeItem('pilotLiteJobsV1');
localStorage.removeItem('pilotLiteJobsV1');
location.reload();
```

---

## 🎯 Success Criteria

### Green Light (Working Correctly)
✅ Job created at facility  
✅ Toast confirms with proposal count  
✅ Job appears in "Mine jobber" list  
✅ 7-day calendar updates (today = red)  
✅ Vessel dashboard shows suggestions within 2 sec  
✅ Match score displays (0-100)  
✅ Accept button works + status changes  
✅ No errors in browser console  

### Yellow Light (Partial)
⚠️ Job created but "Ingen forslag" (no vessels in 100km radius)  
⚠️ Suggestions appear but after 3+ sec delay  
⚠️ Form has validation errors (missing required fields)  

### Red Light (Issues)
❌ Job form doesn't appear  
❌ Errors in F12 console about undefined functions  
❌ Accept button vanishes entire job instead of updating status  
❌ localStorage quota exceeded  

---

## 📞 Support

**For issues, check:**
1. [MATCHING_ENGINE_IMPLEMENTATION.md](../MATCHING_ENGINE_IMPLEMENTATION.md) - Technical Architecture
2. [job-store.js](14.04. NY BUILD/pilot-lite/app/job-store.js) - Source Comments
3. Browser F12 Console - Error Messages
4. localStorage contents - Data Validation

---

**Last Updated:** March 17, 2026  
**Version:** 1.0 (MVP - Matching Engine)
