# Kalender Feature - Implementering FULLFØURT ✅

**Dato:** 23. februar 2026  
**Status:** KLART FOR TESTING  

## 🎯 Implementerte Komponenter

### 1. **Facility-dashboard Kalender** ✅
- **Fil:** `facility-dashboard/facility-calendar.js` (400+ linjer)
- **Komponenter:**
  - `FacilityCalendar` klasse: Håndterer data (events, greenDays, localStorage)
  - `CalendarUI` klasse: Rendrer UI (week grid, navigation, events)
  - `initCalendar()` funksjon: Entry point med facility-spesifikk data loading

**Nøkkelfunksjoner:**
- `addVesselVisit()` - Legger til båtbesøk
- `approveVisit()` - Godkjenn/avslå besøk
- `setGreenDays()` - Konfigurer tilgjengelige dager
- `getWeekCalendar()` - Hent ukeoversikt
- `getNext3Vessels()` - Vis neste 3 båter
- `getTodaysSummary()` - Daglig oppsummering

**Data Persistering:**
- localStorage med facility-code nøkkel
- Format: `facilityCalendar_[FACILITY_CODE]`
- Automatisk save ved hver endring

### 2. **Kalender CSS Styling** ✅
- **Fil:** `facility-dashboard/styles.css` (400+ linjer)
- **Klassifikasjoner:**
  - `.facility-calendar-sidebar` - Kontainer
  - `.week-calendar` - CSS Grid layout (7 kolonner)
  - `.day-column.green-day` - Tilgjengelig (#f0fdf4 bg)
  - `.day-column.red-day` - Utilgjengelig (#fef2f2 bg)
  - `.event-item.approved` - Grønt event
  - `.event-item.pending` - Gult event
  - `.event-item.rejected` - Rødt event
  - Responsiv design, scroll på små skjermer

### 3. **Facility Dashboard HTML** ✅
- **Fil:** `facility-dashboard/index.html`
- **Endring:** Lagt til `<div id="calendarContainer"></div>` i sidebar
- **Rekkefølge:** Etter anleggsdetaljer-seksjon
- **Script loading:** facility-calendar.js lastes før app.js

### 4. **Dashboard Application Integration** ✅
- **Fil:** `facility-dashboard/app.js`
- **Endring:** Kalender initialiseres når anlegg velges
- **Location:** `updateDashboard()` funksjon, etter risikoevaluering
- **Kall:** `initCalendar(facility.code)` sender facility-kode
- **Data:** Kalender bruker facility-spesifikk data fra localStorage

### 5. **"Del Rute" Button på Båtsiden** ✅
- **Fil:** `vessel-dashboard/routes-planner.js`
- **UI:** Blå knapp (📤 Del rute) i facility listing
- **Posisjon:** Før flytt-dag knapene
- **Stil:** `background: #3b82f6; color: white;`

**Implementering:**
```javascript
`<button class="btn" onclick="RoutePlanner.shareFacilityRoute(${batchIdx}, ${idx})" 
  style="...">📤 Del rute</button>`
```

### 6. **Route Sharing Functions** ✅
- **Fil:** `vessel-dashboard/routes-planner.js` (New functions)
- **Funktioner:**
  - `shareFacilityRoute(batchIndex, facilityIndex)` - Åpner modal
  - `confirmShareRoute(facilityCode, facilityName)` - Lagrer i localStorage

**Modal UI:**
- Båtnavn (readonly)
- Dato picker
- Tid input
- Kontaktperson (valgfri)
- Notater (valgfri)
- Send/Avbryt knapper

**Data Lagring:**
```javascript
localStorage.setItem(
  `calendarRouteShare_${facilityCode}`,
  JSON.stringify({
    vesselName,
    date,
    time,
    contact,
    notes,
    sharedAt: ISO timestamp,
    status: 'pending'
  })
)
```

### 7. **Modal Management** ✅
- **Fil:** `vessel-dashboard/vessel.js`
- **Nye funksjoner:**
  - `showModal(content)` - Vis modal dialog
  - `closeModal()` - Lukk modal
- **Style:** Fixed overlay, semi-transparent background, centered

### 8. **Test Side** ✅
- **Fil:** `facility-dashboard/test-calendar.html`
- **Formål:** Standalone testing av kalender
- **Funksjoner:**
  - Initialize
  - Add boat
  - Approve visit
  - Toggle green day
  - Re-render
  - Clear all
- **Debug output:** Real-time logging

## 📊 Data Flow Diagram

```
BÅTSIDEN (vessel-dashboard)
  ↓
  [Planner lager rute for flere dager]
  ↓
  [Brukker klikker "📤 Del rute"]
  ↓
  shareFacilityRoute() åpner modal
  ↓
  [Bruker fyller: dato, tid, kontakt, notater]
  ↓
  confirmShareRoute() lagrer til localStorage
  ↓
  localStorage.setItem('calendarRouteShare_[FACILITY_CODE]', ...)

ANLEGGSIDA (facility-dashboard)
  ↓
  [Bruker velger anlegg]
  ↓
  updateDashboard() kalles
  ↓
  initCalendar(facility.code) aktivert
  ↓
  FacilityCalendar lastes fra localStorage
  ↓
  [Kalender viser ukesvisning + båtbesøk]
  ↓
  Bruker godkjenner/avslår besøk
  ↓
  approveVisit() oppdaterer status
  ↓
  localStorage.setItem('facilityCalendar_[FACILITY_CODE]', ...)
```

## 🧪 Testing Instructioner

### Test 1: Kalender Widget
1. Åpne http://localhost:8081/test-calendar.html
2. Klikk "➤ Initialize Calendar"
3. Verify: Ukesvisning vises med grønne/røde dager
4. Klikk "➕ Add Test Boat"
5. Verify: Båt legges til i kalender
6. Klikk "✓ Approve Visit"
7. Verify: Event status endres fra pending til approved
8. Klikk "🟢 Toggle Green Day"
9. Verify: Dager endrer fra rød til grønn
10. Refresh siden
11. Verify: Data persister fra localStorage

### Test 2: Dashboard Integration
1. Åpne http://localhost:8081
2. Søk etter anlegg (f.eks. "Balsfjord")
3. Klikk på anlegget
4. Verify: Kalender vises i sidebar
5. Kalender skal vise ukesvisning med grønne dager (Man-Fre)
6. Verify: Møteplanen samsvarer med anlegget midt I week view

### Test 3: "Del Rute" Button
1. Åpne http://localhost:8082 (båtsiden)
2. Planlegg en rute:
   - Søk etter anlegg
   - Velg flere anlegg
   - Klikk "Optimal rute"
3. Verify: "📤 Del rute" knapp vises for hver anlegg
4. Klikk "📤 Del rute" på et anlegg
5. Verify: Modal åpnes med:
   - Båtnavn (forhåndsutfylt)
   - Dato (foreslått neste dag)
   - Tid (tom/blank)
   - Kontaktperson (tom)
   - Notater (tom)
6. Fyller: Tid = 14:30, Kontakt = "Eirik Hansen", Noter = "Fra planner"
7. Klikk "✓ Send forespørsel"
8. Verify: Toast vises "✓ Rute sendt til [ANLEGG]"
9. Åpne DevTools → Application → localStorage
10. Verify: `calendarRouteShare_[FACILITY_CODE]` lagret med data

### Test 4: Modal Closing
1. Åpne modal ("📤 Del rute")
2. Klikk "Avbryt"
3. Verify: Modal lukkes
4. Klikk "📤 Del rute" igjen
5. Klikk overlay utenfor modal
6. Verify: Modal lukkes (overlay click handler)

## 🔌 API Endpoints (Fremtid)

Disse vil bli implementert senere for å persistere data på backend:

```
POST /api/calendar/events
{
  "facility_code": "FK-12345",
  "date": "2026-02-25",
  "time": "14:30",
  "vessel_name": "BERGSFJORD",
  "contact": "Eirik Hansen",
  "notes": "Fra ruteplanlegger",
  "status": "pending"
}

GET /api/calendar/events?facility_code=FK-12345&week_start=2026-02-24
Response:
[
  {
    "id": "evt-001",
    "vessel_name": "BERGSFJORD",
    "date": "2026-02-25",
    "time": "14:30",
    "status": "approved",
    "contact": "Eirik Hansen"
  },
  ...
]

GET /api/facilities/{facility_code}/green-days
Response:
{
  "facility_code": "FK-12345",
  "green_days": [0, 1, 2, 3, 4],  // Man-Fri
  "updated_at": "2026-02-23T10:00:00Z"
}
```

## 📝 Implementeringsdetaljer

### Storage Schema
```javascript
// Facility calendar events (per facility)
facilityCalendar_[FACILITY_CODE] = [
  {
    id: 1708606200000,
    date: "2026-02-24",
    time: "10:30",
    vessel: "BERGSFJORD",
    contact: "Eirik Hansen",
    notes: "Fra ruteplanlegger",
    approved: true,
    status: "approved",
    type: "vessel-visit"
  },
  ...
]

// Green days (per facility)
facilityGreenDays_[FACILITY_CODE] = [0, 1, 2, 3, 4]  // [Mon, Tue, Wed, Thu, Fri]

// Route share requests (per facility)
calendarRouteShare_[FACILITY_CODE] = {
  vesselName: "BERGSFJORD",
  date: "2026-02-25",
  time: "14:30",
  contact: "Eirik Hansen",
  notes: "Fra planner",
  sharedAt: "2026-02-23T12:00:00Z",
  status: "pending"
}
```

### CSS Grid Layout
```css
.week-calendar {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 10px;
  margin: 15px 0;
}

.day-column {
  min-height: 200px;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  padding: 10px;
  background: white;
}

.day-column.green-day {
  background: #f0fdf4;
  border-color: #86efac;
}

.day-column.red-day {
  background: #fef2f2;
  border-color: #fca5a5;
}
```

## 🎨 UI Komponenter

### Kalender Sidebar
- Tittel: "🗓️ Kalender for [ANLEGGNAVN]"
- Uke navigasjon: "← Forrige uke" | "Uke 08" | "Neste uke →"
- 7-dags grid med events
- Grønn dag toggle (checkbox per dag)
- Event approval UI (grønn/rød/gul styling)

### "Del Rute" Modal
- Tittel: "📤 Del rute med [ANLEGGNAVN]"
- Input fields:
  - Båt (readonly)
  - Dato (date picker)
  - Tid (time picker)
  - Kontaktperson (text)
  - Notater (textarea, 80px)
- Buttons:
  - "✓ Send forespørsel" (grønn, 10b981)
  - "Avbryt" (grå, e5e7eb)

## ✨ Neste Fase (Ikke Implementert Ennå)

1. **Backend API integration**
   - POST `/api/calendar/events` for opprettelse
   - GET `/api/calendar/events` for lasting
   - PATCH `/api/calendar/events/{id}` for godkjenning

2. **Real-time sync**
   - WebSocket for instant calendar updates
   - Multi-device sync

3. **PDF Export**
   - Week calendar PDF for Mattilsynet
   - Includes vessel visits + approvals

4. **Ruteplanlegger Integration**
   - Lese facility's grønne dager
   - Optimalisere ruter rundt approved days
   - Avoid red (unavailable) days

5. **Notifikasjoner**
   - Facility får varsel når båt deler rute
   - Båt får varsel når besøk godkjent/avslått
   - Email/SMS notifikasjoner

## 📁 Modifiserte Filer

1. `facility-dashboard/facility-calendar.js` - NEW
2. `facility-dashboard/styles.css` - Updated (400+ lines added)
3. `facility-dashboard/index.html` - Updated (calendarContainer added)
4. `facility-dashboard/app.js` - Updated (initCalendar() call)
5. `vessel-dashboard/routes-planner.js` - Updated (shareFacilityRoute, button)
6. `vessel-dashboard/vessel.js` - Updated (showModal, closeModal)
7. `facility-dashboard/test-calendar.html` - NEW

## 🔍 Debug Info

Kalender data kan debugges via browser console:
```javascript
// Last alle events for et anlegg
JSON.parse(localStorage.getItem('facilityCalendar_FK-12345'))

// Last greenDays
JSON.parse(localStorage.getItem('facilityGreenDays_FK-12345'))

// Sjekk route share requests
JSON.parse(localStorage.getItem('calendarRouteShare_FK-12345'))

// Clear all for a facility
localStorage.removeItem('facilityCalendar_FK-12345')
localStorage.removeItem('facilityGreenDays_FK-12345')
localStorage.removeItem('calendarRouteShare_FK-12345')
```

## ✅ Verifisering Checklist

- [x] Calendar data model (FacilityCalendar klasse)
- [x] Calendar UI rendering (CalendarUI klasse)
- [x] Calendar CSS styling (responsive, green/red days)
- [x] HTML container in sidebar
- [x] Dashboard integration (initCalendar on select)
- [x] localStorage persistence (facility-specific)
- [x] "Del rute" button on båtsiden
- [x] Modal dialog for sharing route
- [x] showModal/closeModal functions
- [x] Test HTML page
- [x] Data flow documentation

---

**Implementert av:** GitHub Copilot  
**Dato:** 23. februar 2026  
**Status:** KLART FOR BRUKERTESTING
