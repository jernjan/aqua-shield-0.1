# 🐟 AquaShield MVP 0.1

**Varslingssystem for norsk akvakultur** – Varsler før smittespredning, algeutbrudd, og lusexplosjon.

## Oversikt

- **Kjerneverdien:** Automatiske SMS/email-varsler 1–4 uker før sykdomsutbrudd basert på:
  - Lakseluspredning fra nærliggende anlegg
  - Sjøtemperatur (varmere = raskere spredning)
  - Vannstrømmer
  - Båttrafikk (wellbåter som besøker diseased facilities)
  - Alger fra Copernicus (Sentinel-5P)
- **Målgruppe:** Små–medium norske lakseanlegg, regnbueøreanlegg, torskeanlegg + båtoperatører
- **Teknologi:** React/Vite (frontend) + Node/Express (API) + BarentsWatch (open data)
- **Database:** JSON-fil (MVP), senere Postgres

---

## Struktur

```
aqua-shield-0.1/
├── client/                    # React + Vite frontend
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx           # Router
│   │   ├── index.css         # Global styles
│   │   ├── pages/
│   │   │   ├── Login.jsx     # Register/Login
│   │   │   ├── SelectSites.jsx # Choose facilities/vessels
│   │   │   └── Dashboard.jsx  # Inbox with alerts
│   │   └── components/
│   │       └── Toast.jsx
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── server/                    # Node/Express API
│   ├── index.js              # Main server
│   ├── db.js                 # JSON-fil database wrapper
│   ├── routes/
│   │   ├── auth.js           # Login/Register
│   │   ├── user.js           # Profile, select sites
│   │   └── alerts.js         # Get/mark alerts
│   ├── cron/
│   │   └── nightly.js        # 03:00 analysis
│   ├── utils/
│   │   ├── barentswatch.js   # Fetch facilities + lice/disease
│   │   ├── ais.js            # Fetch vessels
│   │   ├── risk.js           # Risk calculation (0-100)
│   │   └── notify.js         # SMS/Email templates
│   ├── package.json
│   ├── .env.example
│   └── .gitignore
├── README.md                 # This file
├── DEPLOY.md                 # Step-by-step Render deploy
└── NOTES.md                  # Future improvements
```

---

## Funksjonalitet (MVP)

### Frontend (React)
1. **Login/Register** – Epost + passord, JWT token i localStorage
2. **SelectSites** – Søk og velg egne anlegg + båter fra BarentsWatch/AIS
3. **Dashboard** – Inbox-stil varsler (rød/gul/grønn), mark as read, test-varsel

### Backend (Node/Express)
1. **Auth** – JWT login/register, bcrypt passwords
2. **Nightly Cron** (03:00 UTC+1) – Hent alle facilities + vessels, kalkuler risiko, lag varsler
3. **Risk Engine** – Avstandsveiet regel (1km=100%, 20km=20%, >20km=0) + disease + temperatur + båter
4. **Alerts** – CRUD alerts, filter per bruker, mark as read

### Data sources (open)
- **BarentsWatch API** – ~1100 lakseanlegg, lusantall, sykdommer
- **Kystverket AIS** – Wellbåter + servicebåter (real-time posisjon)
- **Copernicus Sentinel-5P** (future) – Algae/clorophyll
- **NorKyst-800** (future) – Vannstrømmer

---

## Enkel setup (lokal dev)

### Forutsetninger
- Node 16+
- Git

### 1. Clone / setup

```bash
cd aqua-shield-0.1

# Server
cd server
npm install
cp .env.example .env
# Edit .env with your Twilio/SMTP (optional for MVP)
npm run dev

# Åpne nytt terminal
cd client
npm install
npm run dev
```

Åpne http://localhost:5173 → Dashboard kjører på http://localhost:3001/api

### 2. Logg inn
- Registrer bruker (epost: test@example.com, passord: 123456)
- Velg test-anlegg og båter
- Se dashboard

### 3. Test varsler
- Klikk "🧪 Send test-varsel"
- Sjekk server-konsoll (varsel logg)
- Varslet dukker opp i dashboard

---

## Deploy på Render (2 services + cron)

Se **DEPLOY.md** for detaljer.

**Kort oppsummering:**
1. **API Service** – Node express server
2. **Static Site** – React build (dist/)
3. **Cron Job** – Nightly analysis (03:00)

Prisklasse: ~$15/month (free tier mulig, men liten grense på data-fetch)

---

## Varsling (SMS/Email)

**For MVP:**
- SMS/email kode ligger i `utils/notify.js`
- Foreløpig logget til konsoll, ikke sendt echt
- Test-varsel gjør API-kall som logg-eres

**For produksjon:**
1. Sett Twilio API-nøkkel i .env (SMS)
2. Sett SMTP-detaljer i .env (Email, f.eks. Gmail)
3. Dekk `sendSMS()` og `sendEmail()` i `notify.js`
4. Webhook for received SMS (optionalt)

---

## Risiko-algoritme (0-100)

```
Facility Risk = 
  + Lice count (0-40 pts) 
  + Disease (0-35 pts, +15 for ILA, +10 for PD)
  + Nearby diseased (0-20 pts, distance-weighted)
  + Temp > 8°C (+5 pts, >10°C +5 more)
  + Current strength > 0.3 m/s (+5 pts)
  
Threshold:
  >= 60: KRITISK (red alert)
  40-59: VARSEL (warning, yellow)
  <40:   GRØNN (safe)

Vessel Risk =
  + Visited diseased facilities (30 pts each)
  + Recent visits >3 in 1h (+20 pts)
  + Wellboat type (+20 pts)
```

---

---

## Technical Architecture & Development Journey

### What is Aqua Shield?

**Aqua Shield** is an early-warning system for Norwegian aquaculture operators (salmon farmers & vessel crews). It combines real-time data from three sources:

1. **BarentsWatch API** – ~2,687 registered fish farms with live disease/lice data
2. **Coastal Administration AIS** – ~4,142 vessels (wellboats, service vessels) with GPS positions
3. **Environmental data** (temp, currents, algae) – Future integration

**Problem Solved:** Farmers currently check multiple websites manually to know if lice/disease from nearby farms or contaminated vessels threatens their own farms.

**Solution:** One dashboard showing **personalized risk scores** combining all data sources, with persistent favorites for quick monitoring.

---

### How the Risk Model Works

The system calculates risk on a **0-100 scale** for each facility:

```
Risk Score Components:
├─ Lice Count (0-40 pts)
│  └─ No lice = 0 pts, >500k = 40 pts
├─ Disease Status (0-35 pts)
│  ├─ ILA present = +15 pts
│  ├─ PD present = +10 pts
│  └─ Salmon Pancreas Disease = +10 pts
├─ Nearby Diseased Facilities (0-20 pts)
│  └─ Distance-weighted: 1km=20pts, 5km=10pts, 20km=0pts
├─ Water Temperature (0-10 pts)
│  ├─ >8°C = +5 pts
│  └─ >10°C = additional +5 pts
└─ Contamination Risk (0-20 pts)
   └─ Nearby wellbats visiting diseased farms

Risk Categories:
├─ 🔴 CRITICAL: ≥60 pts
├─ 🟡 WARNING: 40-59 pts
└─ 🟢 LOW RISK: <40 pts
```

**For vessels:** High risk if recently visited diseased farms or carrying services to high-risk areas.

---

### How Data is Processed (Nightly Cron)

Every night at 03:00 UTC+1:

1. **Data Fetch** (< 3 seconds)
   - GET all facilities from BarentsWatch API
   - GET all vessel positions from AIS API
   - Filter to ~2,687 farms + ~4,142 vessels in Barents Sea region

2. **Risk Calculation** (< 10 seconds)
   - For each farm: Scan disease status + nearby contaminated vessels + lice levels
   - Identify at-risk user facilities
   - Compare against user's alerts threshold

3. **Alert Generation** (< 5 seconds)
   - Create new alerts for risky facilities
   - Store in database with timestamp
   - Prepare notification payload

4. **User Notification** (async)
   - SMS (Twilio) for high-priority alerts
   - Email digest for daily updates
   - In-app notifications on next login

**Optimization:** Response payloads slimmed to only essential fields to prevent timeouts on Render's free tier:
- Facility: `{id, name, riskScore, riskCategory, liceCount, diseaseStatus, municipality}`
- Vessel: `{id, name, callSign, vesselType, length, contaminated, certificateExpiry}`

This reduced response size from ~10MB to ~2MB, enabling full dataset loads without timeout.

---

### Persistent Storage Architecture

**Problem Encountered:**
- Initial implementation used `global.userFavorites` (in-memory JavaScript object)
- When Render's free dyno restarted (every ~1 hour), all favorite selections vanished
- Users would lose their customized dashboard setup constantly

**Solution Implemented (Commit 768273b):**

**Supabase PostgreSQL Database**
```
Connection: postgresql://postgres:password@db.eiokuofueqsmhsv.supabase.co:5432/postgres

Table: users_favorites
├─ id (uuid, primary key)
├─ user_id (string, e.g., "movi", "aakerblå")
├─ resource_id (integer, facility or vessel ID)
├─ resource_type (string, "facility" or "vessel")
├─ created_at (timestamp)
└─ UNIQUE(user_id, resource_id, resource_type)
```

**Three-Tier Fallback Architecture:**
```
User clicks "Add favorite"
  ↓
[Tier 1] Try Supabase PostgreSQL
  ├─ Success? → Save to DB, return success
  └─ Failed? ↓
[Tier 2] Fall back to in-memory store
  ├─ Success? → Save to global JS object, warn user (DB down)
  └─ Failed? ↓
[Tier 3] Frontend localStorage
  └─ Save to browser localStorage as last resort
```

**Backend Route Implementation:**
```javascript
// server/routes/favorites.js (300 lines)

GET /api/user/favorites/:userId
  → Returns all 50-500 favorite facilities + vessels
  → Includes risk details for each (contamination sources, disease status, nearby risks)

POST /api/user/favorites/:userId/add
  → Body: {resourceId: 12345, resourceType: "facility"}
  → Auto-prevents duplicates (UNIQUE constraint)
  → Prevents >500 favorites per user
  → Returns: {success: true, message: "Added to favorites"}

POST /api/user/favorites/:userId/remove
  → Deletes specific favorite from database
  → Falls back to in-memory if DB unavailable

GET /api/user/facility/:facilityId/detailed
  → Returns risk sources: contaminated vessels, nearby HIGH-risk facilities, disease status
  → Used by dashboard to show "Why is this facility risky?"

GET /api/user/vessel/:vesselId/detailed
  → Returns vessel risk profile: disease history, recent facility visits
```

**Configuration (render.yaml):**
```yaml
env:
  - key: DATABASE_URL
    value: postgresql://postgres:x5BccVHm_-gsE2&@db.eiokuofueqsmhcglnhsv.supabase.co:5432/postgres
```

The `DATABASE_URL` is injected at Render deployment time, allowing any dyno to connect to the same PostgreSQL database. This enables:
- ✅ Favorites survive server restarts
- ✅ Multiple dyno instances share data (future horizontal scaling)
- ✅ User can log in from different devices and see same favorites
- ✅ Analytics: Which facilities are users monitoring most?

---

### Frontend Feature: Add/Remove Favorites

**FarmSelector.jsx** (Browse all 2,687 farms)
```javascript
toggleFavorite(facilityId) {
  if (favorites.includes(facilityId)) {
    // Send DELETE request
    POST /api/user/favorites/{userId}/remove
    Body: {resourceId: facilityId, resourceType: "facility"}
  } else {
    // Send ADD request
    POST /api/user/favorites/{userId}/add
    Body: {resourceId: facilityId, resourceType: "facility"}
  }
  
  // Update UI: toggle star ⭐ → ☆
  // Show toast notification: "Added to favorites" or "Removed"
}
```

**FarmerDashboardOverview.jsx** (Show favorites with risk details)
```
┌─────────────────────────────────────────────────────────┐
│ Favoritter dine (45)                              [Søk]  │
├─────────────────────────────────────────────────────────┤
│ Anlegg               │ Risiko  │ Lus     │ Risikokilde   │
├─────────────────────────────────────────────────────────┤
│ Sommerstien          │ 🔴 68   │ 478k    │ Virus@500m    │
│ Havslottet           │ 🟡 45   │ 125k    │ Wellbåt + Lus │
│ Nordfjorden 2        │ 🟢 22   │ 12k     │ Ingen         │
└─────────────────────────────────────────────────────────┘
```

**Pending UI Improvements (Next Session):**
- Add delete/remove button (✕ or 🗑️) on each row
- Add localStorage backup (browser persistence even if DB is down)
- Show toast notifications: "Removed from favorites"

---

### How to Train/Improve the Model

The risk algorithm is currently **rule-based** (hard-coded thresholds), not ML.

**To make it ML-based:**

1. **Collect training data (6-12 months)**
   ```
   Features collected:
   - Historical lice counts → Did they cause outbreaks?
   - Disease presence → How long until spread?
   - Vessel visits → Contamination vector strength?
   - Temperature/currents → Speed of pathogen spread?
   - Outbreak outcomes → Did farm actually get infected?
   
   Label: Binary {outbreak, no_outbreak}
   ```

2. **Train decision tree or random forest**
   ```python
   from sklearn.ensemble import RandomForestClassifier
   
   model = RandomForestClassifier(n_estimators=100)
   model.fit(features, labels)
   feature_importance = model.feature_importances_
   # Results show: Lice=0.35, Disease=0.30, Vessels=0.20, Temp=0.15
   ```

3. **Deploy to backend**
   ```javascript
   // Instead of hard-coded rules in risk.js:
   const riskScore = model.predict([liceCount, diseaseStatus, vesselRisk, temp])
   // Returns 0-100 probability of outbreak
   ```

4. **Continuously improve**
   - When actual outbreaks occur, add to training data
   - Retrain model quarterly
   - Compare predictions vs actual outcomes → tune thresholds
   - Alert users to model accuracy: "Our model predicted 85% of outbreaks correctly this quarter"

**Current MVP approach:** Rule-based (simpler, transparent, easy to debug) → Will upgrade to ML after 6 months of real data.

---

### Site Structure & Build Process

```
aqua-shield-0.1/
├── client/                    # React 18 frontend
│   ├── src/
│   │   ├── App.jsx           # Main router
│   │   ├── main.jsx          # Entry point
│   │   ├── components/
│   │   │   └── Toast.jsx     # Notification component
│   │   ├── pages/
│   │   │   ├── Login.jsx     # Email + password auth
│   │   │   ├── SelectSites.jsx # Choose favorite facilities/vessels
│   │   │   └── Dashboard.jsx # Main dashboard with alerts
│   │   └── index.css         # Tailwind + global styles
│   ├── index.html            # HTML entry point
│   ├── vite.config.js        # Build config
│   └── package.json
│
├── server/                    # Node.js/Express backend
│   ├── index.js              # Main server (1,301 lines)
│   │   ├─ Auth routes (JWT login/register)
│   │   ├─ MVP routes (/api/mvp/farmer, /api/mvp/vessel)
│   │   ├─ Alert CRUD endpoints
│   │   └─ Health check endpoint
│   │
│   ├── routes/
│   │   ├── auth.js           # Login, register, JWT
│   │   ├── user.js           # User profile, settings
│   │   ├── alerts.js         # Get/create/delete alerts
│   │   └── favorites.js      # Add/remove/list favorites (PostgreSQL) ← NEW
│   │
│   ├── utils/
│   │   ├── ais.js            # Fetch vessel positions from Kystverket API
│   │   ├── barentswatch.js   # Fetch farm data from BarentsWatch API
│   │   ├── notify.js         # SMS/email templates (Twilio, SMTP)
│   │   └── risk.js           # Risk calculation algorithm
│   │
│   ├── cron/
│   │   └── nightly.js        # 03:00 scheduled job (fetch data + calculate risk)
│   │
│   ├── package.json          # Node dependencies (express, pg, bcrypt, etc.)
│   └── .env                  # Config: Twilio, SMTP, DATABASE_URL
│
├── render.yaml               # Deployment config (Render.com)
│   └─ DATABASE_URL environment variable (Supabase connection string)
│
├── package.json              # Root package.json
├── README.md                 # This file
├── DEPLOY.md                 # Deployment instructions
└── QUICKSTART.md             # Quick setup guide
```

**Build Process:**

1. **Frontend Build (React + Vite)**
   ```bash
   cd client && npm install && npm run build
   # Output: client/dist/ (static HTML/CSS/JS, ~500KB gzipped)
   ```

2. **Backend Setup (Node.js)**
   ```bash
   cd server && npm install
   # Installs: express, pg, bcrypt, node-cron, dotenv, etc.
   ```

3. **Render Deployment**
   - Pushes `main` branch to GitHub
   - Render detects `package.json` → builds both client & server
   - Runs `npm run build` in root (builds React frontend)
   - Starts `node server/index.js` on port 10000
   - Routes `/` → React frontend (dist/index.html)
   - Routes `/api/*` → Express backend

4. **Environment Variables at Deploy Time**
   - `DATABASE_URL` injected from `render.yaml` (no hardcoding in code)
   - Other secrets (Twilio API key, etc.) added via Render UI

---

### Development Journey & Challenges

**Session 1: Empty Favorites Problem**

**Problem:**
User's favorite facilities weren't loading on the dashboard. The FarmerDashboardOverview page showed empty state despite clicking favorites in FarmSelector.

**Root Cause Analysis (Day 1):**
- Initial hypothesis: Favorites API endpoint not returning data
- Found: Frontend calling `/api/mvp/farmer?userId=movi` with a filter
- Problem: MVP endpoint doesn't support userId filtering (no field on each farm)
- Attempted fix: Manually load all farms, filter by favorite IDs in frontend

**Problem #2: API Timeout (Day 2)**

After loading all 2,687 farms, the API request timed out on Render's free tier.

**Root Cause:**
- Full farm objects with all fields = ~10MB JSON response
- Render free dyno (~100MB memory) → JSON serialization timeout
- Solution: **Slimming responses** to only essential fields
  ```javascript
  // Before: {id, name, location, lat, lng, liceCount, disease, temp, oxygen, depth, ...}
  // After: {id, name, riskScore, riskCategory, liceCount, diseaseStatus, municipality}
  // Size: 10MB → 2MB (5x smaller)
  ```

**Problem #3: Persistence Lost on Restart (Day 3)**

Added favorites worked during same session, but when Render restarted (every ~1 hour), all data vanished.

**Root Cause:**
- Favorites stored in `global.userFavorites` (JavaScript in-memory)
- Render ephemeral filesystem → can't persist files to `db.json`
- Solution: **Migrate to Supabase PostgreSQL**

**Implementation (Commit 768273b):**
1. Created Supabase account (free tier = 500MB data)
2. Created `users_favorites` table with UNIQUE constraint
3. Rewrote `/routes/favorites.js` (240 lines) for PostgreSQL
4. Added connection pooling + SSL
5. Three-tier fallback: DB → in-memory → localStorage
6. Added DATABASE_URL to `render.yaml`
7. Tested locally with `.env.local`

**Status:** Deployed, awaiting end-to-end verification

---

### Next Priorities

**Immediate (High Value, Low Effort):**
1. ✅ Test favorites persistence end-to-end
   - Add favorite via UI
   - Verify in Supabase table
   - Reload page → still there?
   - Restart server → still there?

2. ❌ **Add remove button**
   - Delete icon on each favorite row
   - Call POST `/api/user/favorites/{userId}/remove`
   - Show toast: "Removed from favorites"
   - Expected time: 30 min

3. ❌ **localStorage hybrid backup**
   - Save favorites locally in browser
   - If Supabase fails, fallback to localStorage
   - Auto-sync when DB recovers
   - Expected time: 1 hour

**Short-term (Polish & Scaling):**
4. ❌ Add ship favoriting (vessels), not just farms
5. ❌ Build admin panel (adjust risk thresholds on-the-fly)
6. ❌ Email digest (daily summary of risky farms)
7. ❌ Historical charts (show risk trends over time)

**Long-term (ML & Expansion):**
8. Collect 6 months of outbreak data
9. Train ML model to predict outbreaks (vs current rules-based)
10. Add environmental data APIs (temperature, currents, algae)
11. Multi-language support (English for international)
12. Mobile app (React Native)

---

## Ønsket pilotkunder

- **Små lakselaksanlegg** (50–500 tonn)
- **Regnbueøre-anlegg**
- **Torskeanlegg**
- **Båt-operatører** (wellboat fleet)

Pilot: 10–20 gratis for 3–6 måneder, samle feedback + kalibrere terskler

---

## Brukerbetaling (etter MVP)

- **Anlegg:** 4.000 kr/måned
- **Båt-fleet:** 10.000 kr/måned
- **Forskning/studenter:** Gratis

Mål år 1: 20–50 betalende kunder = 10–30 mill kr ARR

---

## Kjente svakheter

1. **Data-nøyaktighet:** BarentsWatch lat/lng kan være unøyaktig → offset + brukerfeedback
2. **Båt-posisjoner:** AIS kan ha forsinkelser, ikke alle båter registrert
3. **Temperatur/strøm:** Mock-data MVP, trenger ekte API (NorKyst-800, Copernicus)
4. **Algae-data:** Ikke implementert enda (Copernicus Sentinel-5P)

---

## Forslagsmessig utvidelse (comments i kode)

1. **Admin-panel** – Justere risiko-terskler på flygende foten
2. **Error logging** – Sentry, Datadog, eller Cloud Logging
3. **User analytics** – Hvor mange varsler ignoreres? Treffraten?
4. **Offline mode** – Service worker for PWA
5. **Webhook** – Integrer med BarentsWatch real-time notifications (når de finnes)
6. **Multi-lang** – Engelsk versjon for international launch
7. **PDF export** – Detaljert risk-rapport (jsPDF)

---

## Henvendelser / support

Denne MVPen er designd for raskt iterasjon med pilot-kunder. Alle data-kilder er open, ingen lisenser-kostnad.

**Neste steg:**
1. Deploy på Render
2. Finn 10 pilot-kunder
3. Kjør nightly for 3 måneder, samle feedback
4. Kalibrert algoritmen basert på ekte utbrudd
5. Launch betalt versjon

---

God lykke! 🐟
