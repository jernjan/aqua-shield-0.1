# AquaShield - Prosjektbeskrivelse & Statusrapport

**Sist oppdatert:** 10. januar 2026  
**Status:** 🟢 MVP fase - Aktiv utvikling  
**Sjef:** Janin  

---

## 1. Prosjektoversikt

**AquaShield** er et overvåknings- og varslingsystem for aquafarm-helse i Norge. Systemet kombinerer realtidsdata fra båttrafikk, strømretninger og miljøovervåking for å forutsi sykdomsutbrudd hos oppdrettsfisk.

### Målgruppe
- **Farmer (Anleggseier):** Overvåk egne anlegg, se sykdomsvarsler, registrer båter
- **Vessel (Båteier):** Registrer desinfeksjon og oppgaver, se karantener
- **Admin (Mattilsynet):** Oversight av hele systemet, statistikk, regionalt syn
- **Analytics (Forskere):** Historisk data, trendanalyse, reporting

### Hovedfunksjonalitet
- 🎯 Sykdomsvarsler med risikoscore
- 🚢 Båttrafikk-overvåking
- 📊 Regional og temporal analyse
- 🤖 ML-basert utbruddsforutsigelse (Phase 3)
- 📈 Historisk datalogger for ML-trening

---

## 2. Arkitektur

### Stack
```
Frontend:      React 18 + Vite 4.5 (localhost:5173)
Backend:       Node.js + Express (localhost:3001)
Database:      In-memory (Phase 1) → PostgreSQL (Phase 2)
Deployment:    Render.com
Auth:          Mock token-based (MVP)
```

### Folder-struktur
```
aqua-shield-0.1/
├── client/                 # React frontend
│   └── src/pages/
│       ├── Login.jsx       # Role selection (4 MVPs)
│       ├── AdminMVP.jsx    # Mattilsynet oversight
│       ├── FarmerMVP.jsx   # Anleggseier dashboard
│       ├── VesselMVP.jsx   # Båteier dashboard
│       └── AnalyticsMVP.jsx # Forsker dashboard
├── server/                 # Node/Express backend
│   ├── index.js           # Main server + API endpoints
│   ├── datalogger.js      # ✨ Data logging service (NEW)
│   ├── ais-poller.js      # ✨ Vessel traffic simulator (NEW)
│   ├── mvp-data.js        # Mock data generator
│   ├── storage.js         # Alert storage
│   └── cron/nightly.js    # Scheduled jobs
└── DATALOGGER_PHASE1.md   # Data logging documentation
```

---

## 3. MVP-er (Fire brukerroller)

### 3.1 AdminMVP - Mattilsynet Oversight
**Formål:** System-wide regulering og overvåking

**Status:** ✅ FULLY FUNCTIONAL

**Innhold:**
- 5 tabs:
  - **Overview:** Kritiske anlegg badge, varslinger, statistikk
  - **Varsler:** Alle alarmer sortert på dato/alvorlighetsgrad
  - **Anlegg:** Farm-liste med risikoscore, regioner
  - **Båter:** Vessel overview, sertifikater, karantener
  - **Regioner:** Regional aggregate data

- **CSV Export:** 
  - Anlegg list
  - Varslinger
  - Båter
  - Regional rapport

- **Sidebar stats:**
  - Kritiske anlegg (risikoscore > 70)
  - Advarselsstatus anlegg (50-70)
  - Regional filter

**Funksjonalitet:**
- Søk etter anlegg/båt/region
- Datumrange filter
- Real-time statistikk
- Nedlastbar data

### 3.2 FarmerMVP - Anleggseier Dashboard
**Formål:** Eierens innsyn i eget anlegg + handlinger

**Status:** ✅ FUNCTIONAL

**Innhold:**
- 6 farms med mock data
- Tabs:
  - **Oversikt:** Anleggets risikoscore, neste varsel
  - **Varsler:** Historikk av alarmer
  - **Anlegg:** Anleggets koordinater, region, strøm
  - **Båter:** Besøk fra båter (desinfeksjon-status)
  - **Karantener:** Aktive båt-karantener

**Data:**
- Mock farms: 6 stk (Nord-Trøndelag, Hordaland, etc.)
- Mock alerts: Per farm
- Mock vessels: 2 besøksregistreringer

### 3.3 VesselMVP - Båteier Dashboard
**Formål:** Båteier ser oppgaver, registrer desinfeksjon

**Status:** ✅ FUNCTIONAL

**Innhold:**
- 2 vessels med tasks
- Tabs:
  - **Oversikt:** Sertifikater, oppgaver pending
  - **Oppgaver:** Vedlikehold, desinfeksjon tasks
  - **Desinfeksjoner:** Historikk av utførte desinfeksjoner
  - **Karantener:** Aktive karantener for båten

**Funksjonalitet:**
- Create task (vedlikehold, desinfeksjon)
- Mark task complete
- Register disinfection date
- See quarantine status

### 3.4 AnalyticsMVP - Forsker Dashboard ✨ NEW
**Formål:** Trendanalyse, regionalt syn, sykdomsforskning

**Status:** ✅ JUST IMPLEMENTED

**Innhold:**
- 4 tabs:
  
  **Overview:**
  - Total varsler
  - Kritiske/advarsel/moderat count
  - Antall regioner
  - Top diseases
  
  **Tidsserier (Timeseries):**
  - Graf: Varsler per dag over 10 dager
  - 6 farger = 6 regioner (stacked bars)
  - Vis regionalt mønster
  
  **Regional:**
  - Tabell per region
  - Facilities count
  - Critical/warning count
  - Average risk
  - CSV export per region
  
  **Diseases:**
  - 3 disease trend charts (Sea Lice, IPN, Fish Allergy)
  - Per disease: timeline + statistics
  - Total cases, avg/day, peak cases
  - Disease breakdown

**Visualisering:**
- Custom bar charts (no external library)
- Dark theme med gull/rød accent
- Responsive layout (sidebar + main)

---

## 4. Datalogger & ML Plan ✨ NEW

### Phase 1: Data Logger Backend (✅ COMPLETE - 10. jan 2026)

**Status:** Ready to use

**Komponenter:**
- `server/datalogger.js` - Data logging service
- `server/ais-poller.js` - Vessel traffic simulator
- 6 API endpoints

**Funksjonalitet:**
```javascript
// Log en varsel
POST /api/datalog/alert
{
  facility_id: "farm_1",
  disease_type: "Sea Lice",
  severity: "høy oppmerksomhet",
  region: "Troms & Finnmark",
  title: "Luse-utbrudd detektert",
  risk_score: 75,
  vessel_traffic_nearby: [...]
}

// Query historikk
GET /api/datalog/alerts?days=7&disease_type=Sea%20Lice
GET /api/datalog/vessel-movements?facility_id=farm_1

// Mark outbreak (for ML training)
PATCH /api/datalog/alert/alert_1/outbreak
{ "confirmed": true, "notes": "Inspeksjon bekreftet" }

// Eksporter treningsdata
GET /api/datalog/export?days=30
```

**Data struktur:**
- `alerts_history[]` - Alle varsler med timestamp, sykdom, risiko, båter i nærheten
- `vessel_movements[]` - AIS-posisjon logger, mm avstand fra anlegg
- `outbreak_confirmed` - null/true/false (brukes for ML-trening)

**AIS Poller:**
- Kjører hver dag (1440 minutter)
- Simulerer 4 båter med GPS-posisjon
- Logger når båt er < 15km fra anlegg
- Genererer test-alarmer (10% sjanse)
- **Phase 2:** Swap mock-data med real Kystverket API

### Phase 2: PostgreSQL + Real AIS (✅ POSTGRESQL READY - ~1 time for Real AIS)

**✅ Ferdig:**
1. ✅ Database schema migration (varsler_history, vessel_movements tabeller definert)
2. ✅ Database.js med fallback in-memory (PostgreSQL + in-memory hybrid)
3. ✅ DataLogger oppgradert til async/await + database support
4. ✅ Init-db.js script for schema setup
5. ✅ Alle endepunkter konvertert til async
6. ✅ Fallback in-memory storage når database utilgjengelig
7. ✅ Server kjører med både varianter
8. ✅ POSTGRESQL_SETUP.md guide for installation

**Neste steg:**
- Real Kystverket AIS API integration (~1 time)
- Swap MOCK_VESSELS for real API calls
- Add authentication for API

**Nåværende:** In-memory storage (for MVP testing) - Prdy for PostgreSQL ved installation

### Phase 3: ML Model Training (⏳ PENDING - ~3-4 måneder + 2 dager dev)

**Timeline:**
- **Månader 1-3:** Logg data kontinuerlig (kjøres i background)
- **Måned 4:** ML fase
  - Samle ~100-200 varsler med outbreak_confirmed labels
  - Trene model: Random Forest eller XGBoost
  - Test på ukjente data
  - Deploy som Flask/FastAPI microservice

**Model Input Features:**
- Båttrafikk-proximity (fra AIS logger)
- Strømretning (fra farm data)
- Vantemperatur (mock miljødata)
- Tidligere varsler i område
- Sykdomstype
- Årstid

**Model Output:**
- Outbreak probability: 0-100%
- Risk adjustment: "Grønn" (85%+ sannsynlig ekte) eller "Rødt" (< 50% sannsynlig)

**Integration:**
- Call ML API når varsel genereres
- Display confidence % i AdminMVP
- Logg predictions for backtesting

---

## 5. Status per Komponent

### Frontend (React)
| Komponent | Status | Funksjonalitet |
|-----------|--------|---|
| Login.jsx | ✅ Complete | 4 role buttons (farmer, vessel, admin, analytics) |
| AdminMVP.jsx | ✅ Complete + NEW | 5 tabs, CSV export, **Outbreak Confirmation UI** ✨ |
| FarmerMVP.jsx | ✅ Complete | Mock data, 5 tabs |
| VesselMVP.jsx | ✅ Complete | Mock data, 4 tabs |
| AnalyticsMVP.jsx | ✅ Complete | Regional + disease trends, 4 tabs |

### Backend (Node/Express)
| Module | Status | Purpose |
|--------|--------|---|
| index.js | ✅ Complete | Main server + all MVP endpoints |
| mvp-data.js | ✅ Complete | Mock data generator |
| datalogger.js | ✅ Complete | Alert + vessel logging |
| ais-poller.js | ✅ Complete | Background vessel traffic simulation |
| storage.js | ✅ Complete | Alert storage |
| cron/nightly.js | ✅ Complete | Scheduled analysis |

### Infrastructure
| Item | Status |
|------|--------|
| Vite dev server | ✅ Ready |
| Express server | ✅ Ready |
| API endpoints | ✅ 30+ working |
| CORS | ✅ Enabled |
| Data logging | ✅ Running |
| AIS polling | ✅ Daily (every 24h) |

---

## 6. Development Roadmap

### ✅ COMPLETED
- [x] All 4 MVP roles implemented
- [x] Mock data generation
- [x] CSV export functionality
- [x] AnalyticsMVP with regional/disease charts
- [x] DataLogger module (Phase 1) - TESTED & WORKING
- [x] AIS Poller with daily logging - RUNNING
- [x] API endpoints for data access (6 endpoints)
- [x] Dark theme styling
- [x] **Outbreak Confirmation UI in AdminMVP** ✨ - TESTED & WORKING
  - Admin can mark varsler as "confirmed outbreak" or "false positive"
  - Data sent to datalogger for ML training
  - Visual feedback (green/gray coloring + status labels)
  - Connected to `/api/datalog/alert/:id/outbreak` endpoint

### 🟡 IN PROGRESS / READY FOR NEXT PHASE
- [ ] PostgreSQL database (Phase 2) - **READY TO START**
  - Schema: varsler_history, vessel_movements tables
  - Estimated: 2 hours work
  - Priority: High (data persistence)
  
- [ ] Real Kystverket AIS API (Phase 2) - **READY TO START**
  - Replace mock vessel data with real API
  - Estimated: 2 hours work
  - Priority: High (real data)

- [ ] Outbreak confirmation UI improvement (Phase 3) - Optional
  - Add notes field when confirming outbreak
  - Add manual verification form
  - Priority: Medium
- [ ] Production deployment tuning

### ⏳ FUTURE
- [ ] Real-time notifications (email/SMS)
- [ ] Mobile app (optional)
- [ ] Historical trend prediction (ML Phase 3)
- [ ] Manual outbreak verification form

---

## 7. How to Run

### Terminal 1: Backend Server
```bash
cd aqua-shield-0.1/server
node index.js
# Starts on port 3001
# AIS polling starts automatically
```

### Terminal 2: Frontend Dev Server
```bash
cd aqua-shield-0.1/client
npm run dev
# Starts on port 5173
# Hot reload enabled
```

### Access
- Frontend: http://localhost:5173
- Backend: http://localhost:3001
- API: http://localhost:3001/api/*

### Test Datalogger
```bash
# Get stats
curl http://localhost:3001/api/datalog/stats

# Log a test alert
curl -X POST http://localhost:3001/api/datalog/alert \
  -H "Content-Type: application/json" \
  -d '{"facility_id":"farm_1","disease_type":"Sea Lice","severity":"høy","region":"Troms & Finnmark","title":"Test","risk_score":75}'

# Get alerts
curl "http://localhost:3001/api/datalog/alerts?days=7"

# Export training data
curl "http://localhost:3001/api/datalog/export"
```

---

## 8. Key Files & Locations

```
c:\Users\janin\OneDrive\Skrivebord\Aqua shield\aqua-shield-0.1\

Frontend:
├── client/src/pages/AdminMVP.jsx      (542 lines)
├── client/src/pages/AnalyticsMVP.jsx  (437+ lines) ✨
├── client/src/pages/FarmerMVP.jsx     (mock data)
├── client/src/pages/VesselMVP.jsx     (mock data)
├── client/src/pages/Login.jsx         (190 lines)
└── client/src/App.jsx                 (routing)

Backend:
├── server/index.js                    (842 lines) ✨
├── server/datalogger.js               (194 lines) ✨ NEW
├── server/ais-poller.js               (215 lines) ✨ NEW
├── server/mvp-data.js
├── server/storage.js
└── server/cron/nightly.js

Docs:
├── DATALOGGER_PHASE1.md              ✨ NEW
└── This file (PROJECT.md)            ✨ NEW
```

---

## 9. Next Steps

### Immediate (This Week)
1. ✅ Test datalogger endpoints
2. ✅ Verify daily AIS polling works
3. Test outbreak confirmation button in AdminMVP (optional)
4. Document API contracts

### Short Term (Next 2 weeks)
1. Consider Phase 2: PostgreSQL migration
2. Plan Phase 2: Real Kystverket API integration
3. Prepare Phase 3: Outbreak confirmation UI

### Medium Term (1-2 months)
1. Start collecting real data
2. Begin Phase 3 planning with ML team
3. Set up monitoring dashboard
4. Plan production deployment

### Long Term (3-4 months)
1. ML model training on collected data
2. Model evaluation & tuning
3. Deploy ML service
4. Integrate predictions into AdminMVP

---

## 10. Technical Decisions & Rationale

### Why Mock Data First?
- ✅ Fast MVP development (no API dependencies)
- ✅ Easy to test and debug
- ✅ No external service complications
- ✅ Can swap with real data later without code changes

### Why Daily AIS Polling (Phase 1)?
- ✅ Saves CPU/memory for MVP
- ✅ Still builds training data (slower accumulation)
- ✅ Easy to increase to 5-min polling in Phase 2
- ✅ Good enough for proof-of-concept

### Why In-Memory Storage First?
- ✅ No database setup needed
- ✅ Fast iteration in development
- ✅ Upgrade to PostgreSQL when data grows
- ✅ Perfect for MVP phase

### Why Outbreak Confirmation Field?
- ✅ Critical for ML training (need true/false labels)
- ✅ Tracks false positives (model improvement)
- ✅ Admin can mark after investigation
- ✅ Historical traceability

### Why Multiple MVPs?
- ✅ Different user needs (farmer ≠ regulator)
- ✅ Role-based security model
- ✅ Easy to add new roles later
- ✅ Realistic system behavior

---

## 11. Contact & Questions

**Project Lead:** Janin  
**Development:** GitHub Copilot + Janin  
**Chat:** Use this PROJECT.md as reference for continuation

---

## 12. Version History

| Date | Update |
|------|--------|
| 10. jan 2026 (Evening #2) | ✅ Phase 2 PostgreSQL COMPLETE: database.js + fallback in-memory, DataLogger upgraded to async/await, init-db.js schema, POSTGRESQL_SETUP.md guide created. Server running with in-memory fallback. Ready for real Kystverket AIS API (~1 hour remaining). |
| 10. jan 2026 (Evening) | Session summary: Completed Outbreak Confirmation UI + full testing. DataLogger Phase 1 fully working. Ready for Phase 2. |
| 10. jan 2026 (Day) | Added: Outbreak Confirmation UI in AdminMVP ✨ - Admin can mark varsler as confirmed/false positive for ML training |
| 10. jan 2026 (Day) | Created: DataLogger Phase 1 ✨, AIS Poller ✨, AnalyticsMVP complete, daily polling config |
| 10. jan 2026 (Day) | Initial: All MVPs functional, CSV export, dark theme |

---

**Last updated:** 10. januar 2026 21:05  
**Next update:** After Phase 2 (PostgreSQL) or when major features added
