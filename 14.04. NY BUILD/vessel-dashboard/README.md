# 🚢 Båt-Dashboard (Vessel Monitoring)

Sanntids overvåking av fartøy, risiko-vurdering og smittepass-kontroll.

> Canonical port policy (14.04 NEW BUILD): Vessel Dashboard `8082`, Admin `8080`, Facility `8084`, API primary `8000`.

**Status: OPERASJONELT** ✅ (27. februar 2026)
- Null pointer errors fikset ✅ (API/AIS status checks)
- showVesselDashboard() fikset ✅ (fjernet manglende element refs)
- BarentsWatch risiko-matching: Fikset ✅
- Backend API: Fullt fungerende ✅
- Dashboardet: Operasjonelt ✓
- **NYTT**: 10km-risiko feature implementert og fungerer ✅
- **NYTT**: Toggle bug fikset (CSS-only approach) ✅
- **NYTT**: Route planning error fikset ✅

---

## 🎯 Hva Gjør Dette Dashboardet?

### Hovedfunksjoner
- **Båt-Sporing**: Real-time fartøysposisjoner fra AIS
- **Risiko-Vurdering**: Beregner smitte-risiko per anlegg
- **Smittepass**: Fargestatus for hver anlegg (Grønn/Gul/Rød)
- **Hva-Hvis Simulering**: Simulerer endringer i rute
- **Nærliggende Anlegg**: Viser anlegg innen 15km av fartøyet

### Data-Kilder
- **AIS-Data**: Real-time fartøysposisjoner fra Kystverket
- **BarentsWatch**: Offisielle risiko-soner for ILA/PD
- **Prediksjon**: ML-modell for smitte-risiko

---
## 🔧 OPPDATERINGER 27. Februar 2026 (Major Feature & Bug Fixes)

### ✅ Route Planning Error Fixed
**File**: `routes-planner.js` (linje 235-255)  
**Problem**: `batches.sort is not a function` - koden kalte `.sort()` på object istedenfor array  
**Løsning**: Ekstraher `.batches` property fra returnobjekt før sortering  
**Status**: FIXED ✅

### ✅ 10km Proximity Safety Feature (NY!)
**Hva**: Viser anlegg som ligger 0-10km fra bekreftet smittet anlegg (og IKKE i offisiell BarentsWatch-sone)  
**Implementasjon**:
- Beregner avstand for ALLE 2,689 anlegg fra hver smittet facility
- Flagg: `localZoneRisk = true` + `bwRisk = false` (ekskluderer BW-anlegg)
- Resultat: **217 anlegg** flagget som 10km-risiko
- Toggle: 🟡 "Anlegg innen 10km" (default OFF ved oppstart)

**Fargesystem**:
- 🔴 **RED** (#ef4444): Bekreftet smittet
- 🟠 **ORANGE** (#f59e0b): BarentsWatch-sone (Moderat/Høy/Ekstrem)
- 🟡 **GUL** (#facc15): Innenfor 10km av smittet (toggle ON)
- 🟢 **GREEN** (#10b981): Frisk / 10km med toggle OFF

**Toggle-oppførsel** (VIKTIG):
- ON → Anlegg vises som PINK
- OFF → Anlegg vises som GREEN (original fargen)
- **ALDRI forsvinner anlegg** når toggle endres (kun fargeendring)

**Implementasjon**: vessel-map.js linje 375-397 (beregning) + 760-780 (farger)
**Status**: FULLY OPERATIONAL ✅

### ✅ CRITICAL: Toggle Bug Fixed (Markers Disappearing)
**Problem**: Når 10km-toggle gikk OFF, forsvant markørene fra kartet. Når toggle gikk ON igjen, kom de ALDRI tilbake.  

**Root Cause**: Koden brukte `map.removeLayer(marker)` til å skjule markører. Dette korrupterer Leaflet.js sitt interne state. Etter removal kunne ikke `marker.getElement()` brukes til å re-render markøren.

**Løsning**: **ALDRI** bruke `map.removeLayer()` for toggle-operasjoner. Istedenfor bruker vi CSS `display: none` / `visibility: hidden`:
```javascript
// FØR (BROKEN):
if (shouldShow) marker.addTo(map);
else map.removeLayer(marker);  // ❌ Leaflet state corrupted

// ETTER (FIXED):
if (shouldShow) {
  element.style.display = '';
  element.style.visibility = 'visible';
} else {
  element.style.display = 'none';  // ✅ Markør består på map
  element.style.visibility = 'hidden';
}
```
**Implementasjon**: vessel-map.js linje 785-795  
**Status**: VERIFIED WORKING ✅

### ✅ Filter Logic Rewrite (Show by Default)
**Endring**: Invertert visibility-logikk fra "show if matches" til "hide if toggle OFF"

**Før** (problemet):
- Viste anlegg KUN hvis de matchet spesifikke betingelser
- 10km-anlegg uten BW-risk forsvant når toggle gikk OFF

**Etter** (løsningen):
- Viser ALLE anlegg per default
- Skjuler BARE hvis toggle for DEN RISIKOENS-TYPE er OFF
- 10km-anlegg blir aldri skjult pga 10km-toggle (kun fargeendring)

**Logikk**:
1. Hide infected if 🔴-toggle OFF
2. Hide BW if 🟠-toggle OFF  
3. Hide healthy/10km if 🟢-toggle OFF
4. Show alt annet (100% av anlegg altid hvist minst en toggle er ON)

**Implementasjon**: vessel-map.js linje 744-757  
**Status**: WORKING CORRECTLY ✅

### ✅ Color System Finalized & Tested
- 🔴 RED (#ef4444): Bekreftet smittet (alltid rød)
- 🟠 ORANGE (#f59e0b): BarentsWatch gul→orange endret (mer distinkt fra rød)
- 🟡 GUL (#facc15): 10km-buffer (ny farge, veldig distinkt)
- 🟢 GREEN (#10b981): Frisk / 10km-off (original farge)

**Fargelogikk** (vessel-map.js 760-780):
```
1. if infected → RED (no matter what)
2. else if (toggle ON + 10km-only) → GUL
3. else if (BW-risk) → ORANGE (no matter what)
4. else if (10km-risk + toggle OFF) → GREEN
5. else → GREEN (frisk)
```

**Resultat**: Anlegg som er BÅDE BW og 10km → vises som ORANGE (BW har prioritet visuelt)  
**Status**: TESTED & VERIFIED ✅

---
## � Bugfixes 25. February 2026

### Null Pointer Errors (Status Checks)
**Problem**: API og AIS status check function krasjet fordi DOM-elementer manget null-sjekk  
**Fix**: La til sjekk `if (!statusDot || !statusText) return;` i `checkAPIStatus()` og `checkAISStatus()`  
**Status**: ✅ FIXED

### Missing Element References  
**Problem**: `showVesselDashboard()` refererte til ikke-eksisterende `vesselCallsign` DOM-element  
**Fix**: Fjernet linjene som prøvde å sette `.textContent` på manglende element  
**Status**: ✅ FIXED

---

## �🔧 KRITISK FIX: BarentsWatch Risiko-Matching

### Problemet ❌
Båt-dashboardet viste feil risiko-data for anlegg med samme navn.
Eksempel: "Kalvøya" lokalitet kunne få orangje fra feil lokality 150km unna.

### Løsningen ✅
**Hierarkisk matching** implementert:
1. **Match by facility_code** (lokalityNo) - BEST
2. **Match by exact name** - KUN hvis unikt
3. **Match by geo-proximity** - SISTE MULIGHET (≤1km)

**Implementert i**: `vessel-map.js` → `enrichWithBarentsWatchData()` (linje 188-256)

**Status**: ✅ Fungerer korrekt

---

## 🚀 Slik Kjører Du Dette

### Rask Oppstart - Full Stack (3 terminalvinduer)

**Terminal 1: Backend API (port 8000)**
```powershell
cd "c:\Users\janin\OneDrive\Skrivebord\Kyst monitor DEMO\EKTE_API"
.\.venv\Scripts\Activate.ps1
python -m uvicorn src.api.main:app --host 127.0.0.1 --port 8000 --reload
```

**Terminal 2: Anleggsidashboardet (port 8084)**
```powershell
cd "c:\Users\janin\OneDrive\Skrivebord\Kyst monitor DEMO\14.04. NY BUILD\facility-dashboard"
python -m http.server 8084
```

**Terminal 3: Båt-dashboard (port 8081)**
```powershell
cd "c:\Users\janin\OneDrive\Skrivebord\Kyst monitor DEMO\14.04. NY BUILD\vessel-dashboard"
python -m http.server 8081
```

### Åpne i Browser
- **API Docs**: http://127.0.0.1:8000/docs
- **Anleggsida**: http://127.0.0.1:8084 (når facility-dashboard kjører)
- **Båtsida**: http://127.0.0.1:8081 (når vessel-dashboard kjører)

> **Merk**: Dashboardene kjører nå på separate porter: anlegg 8084 og båt 8081.

---

## 🔌 API-Endepunkter (Backend)

### Health & Status
```
GET /
  └─ API info og status

GET /health
  └─ Detaljert helse-sjekk av alle data-kilder
```

### Anlegg (Facilities)
```
GET /api/facilities
  └─ Alle ~2,687 akvakulturanlegg i Norge
  └─ Returnerer: kode, navn, lat/lon, type, art, kapasitet

GET /api/facilities/{code}
  └─ Spesifikt anlegg by facility code

GET /api/facilities/near/{lat}/{lon}?radius_km=15
  └─ Anlegg innen X km radius
```

### Sykdom & Risiko ⭐ VIKTIG
```
GET /api/facilities/disease-spread
  └─ OFFISIELLE BarentsWatch risiko-soner
  └─ Inneholder: Karantene-/overvåkingssoner, risiko-nivå
  └─ Datakilde: BarentsWatch ukelege helse-data
  └─ Cache: 24 timer TTL
```

### Fartøy (Vessels)
```
GET /api/vessels?limit=100
  └─ Real-time fartøysposisjoner fra AIS
  └─ Inneholder: MMSI, navn, lat/lon, fart, kurs

GET /api/vessels/{mmsi}
  └─ Spesifikt fartøy by MMSI
```

### Båt-Sikkerhet ⭐ NYTT
```
GET /api/boat/plan/confirmed
  └─ Godkjente båtruter med karantene-status

GET /api/boat/smittepass/{mmsi}
  └─ Smittepass-status per anlegg
  └─ Returnerer: fargestatus (RED/YELLOW/GREEN) per anlegg

GET /api/boat/what-if-scenario/{mmsi}?facility_codes=ID1,ID2,ID3
  └─ Simulerer reise-rute-scenario
  └─ Returnerer risiko-estimat per anlegg
```

### Prediksjon & Risiko
```
GET /api/risk/predictions/all
  └─ Alle fartøyer med risiko-prediksjon
  └─ Returnerer: MMSI, navn, lat/lon, risk_level, components, trend_7d

GET /api/risk/predictions/{mmsi}
  └─ Risiko-prediksjon for spesifikt fartøy
  └─ Inneholder: Komponenter, confidence, trend

GET /api/risk/predictions/all?force_refresh=true
  └─ Force-oppdater cache-data (slett cache-fil)
```

---

## 📊 Datamodeller

### Fartøy-Objekt (fra `/api/vessels`)
```javascript
{
  mmsi: 257123456,                // Unikt ID
  name: "MS Fisherman",
  latitude: 69.5,
  longitude: 19.3,
  speedOverGround: 8.5,           // Knop
  trueHeading: 45,                // Grader
  timestamp: "2026-02-21T12:34:56Z"
}
```

### Smittepass-Response (fra `/api/boat/smittepass/{mmsi}`)
```javascript
{
  mmsi: 257123456,
  name: "MS Fisherman",
  facilities: {
    12371: {                        // facility_code
      name: "Kalvøya",
      status: "GREEN",              // RED/YELLOW/GREEN
      distance_km: 5.2,
      risk_percent: 8.5,
      reason: "Outside protection zone"
    },
    // ... flere anlegg
  },
  summary: {
    total_facilities: 47,
    status_counts: { GREEN: 40, YELLOW: 5, RED: 2 },
    last_updated: "2026-02-21T12:00:00Z"
  }
}
```

### Hva-Hvis Scenario (fra `/api/boat/what-if-scenario/{mmsi}`)
```javascript
{
  mmsi: 257123456,
  name: "MS Fisherman",
  origin_risk: "MEDIUM",
  scenario_results: [
    {
      facility_code: 12371,
      facility_name: "Kalvøya",
      current_status: "GREEN",
      after_visit_status: "YELLOW",
      exposure_days: 3,
      risk_change_pct: +12
    }
  ],
  overall_risk_after_visits: "MEDIUM"
}
```

### Risiko-Prediksjon (fra `/api/risk/predictions/{mmsi}`)
```javascript
{
  mmsi: 257123456,
  name: "MS Fisherman",
  latitude: 69.5,
  longitude: 19.3,
  risk_level: "MEDIUM",           // LOW/MEDIUM/HIGH/CRITICAL
  risk_percent: 18.5,             // 0-100%
  components: {
    proximity_risk: 15.2,          // Er nær smittet anlegg
    disease_zone_risk: 5.0,        // I BarentsWatch karantene-sone
    history_risk: 3.3,             // Besøkt smittede anlegg tidligere
    compliance_risk: 0.0            // Har fulgt karantene
  },
  confidence_score: 0.78,         // 0.5-0.95
  confidence_level: "MEDIUM",     // HIGH/MEDIUM/LOW
  trend_7d: "INCREASING",         // INCREASING/STABLE/DECREASING
  trend_pct: +5.2,                // Endring siste 7 dager
  last_updated: "2026-02-21T12:00:00Z"
}
```

---

## 📁 Filstruktur

```
14.04. NY BUILD/
├── facility-dashboard/
│   ├── index.html
│   ├── app.js
│   ├── facility-data.js
│   ├── facility-logic.js
│   ├── facility-map.js
│   └── README.md
│
└── vessel-dashboard/               ← DENNE MAPPEN
    ├── index.html                 # Hovedside
    ├── app.js                     # Initialisering
    ├── vessel-data.js             # Data-lasting
    ├── vessel-logic.js            # Risiko-beregning
    ├── vessel-map.js    ⭐ VIKTIG # Kartvisning & matching
    ├── vessel-storage.js          # Data-cache
    ├── styles.css                 # Styling
    └── README.md                  # DENNE FILEN
```

---

## 🔍 Nøkkelfiler Forklart

### vessel-map.js (Kartvisning & Matching)
**Viktig funksjon**: `enrichWithBarentsWatchData()` (linje 188-256)
- Implementerer hierarkisk matching (kode → navn → geo)
- Samme matching-logikk som facility-dashboard
- Enriker fartøyer med BarentsWatch risiko-sone-info

**Hva den gjør**:
1. Henter fartøys-posisjoner fra `/api/vessels`
2. Henter BarentsWatch risiko-soner fra `/api/facilities/disease-spread`
3. Matcher hver fartøy-posisjon til risiko-sone
4. Returnerer fartøy-data med risiko-status

### vessel-logic.js (Risiko-Beregning)
**Viktig funksjon**: `assessVesselRisk(vessel)` 
- Vurderer risiko basert på avstand til smittede anlegg
- Sjekker om i offisiell BarentsWatch-sone
- Beregner eksponeringsrisiko

### vessel-data.js (Data-lasting)
- Henter fartøys-data fra `/api/vessels`
- Henter prediksjon-data fra `/api/risk/predictions/all`
- Håndterer caching og oppdateringer

### vessel-storage.js (Data-Cache)
- Lagrer fartøys-data på klient-side
- Håndterer historikk og trend-beregning
- Cache-TTL: Konfigurabel

---

## 🍔 Risiko-Komponenter Forklart

Går på tvers av Båtsida, illustrert i Hva-Hvis og Prediksjon:

### 1. Proximity Risk (Avstandsrisiko)
- Er fartøyet nær et smittet anlegg?
- Basert på AIS-posisjon og kjent smitte-status
- Avstandsfunksjon: Nærmere = Høyere risiko

### 2. Disease Zone Risk (Sone-Risiko)
- Er fartøyet i en BarentsWatch karantene-sone?
- Basert på offisiell ILA/PD karantene-data
- Nivåer: Ekstrem/Høy/Moderat/Lav

### 3. History Risk (Historie-Risiko)
- Har fartøyet besøkt smittede anlegg tidligere?
- Basert på logg over besøk
- Samner av påsmittings-tid fra siste besøk

### 4. Compliance Risk (Overholdelse-Risiko)
- Har fartøyet fulgt karantene-påbud?
- Basert på planlagte ruter vs faktisk kjørte ruter
- Premie for god oppførsel

---

## 🐛 Kjente Problemer

### 🟢 Båt-Dashboard Fungerer Normalt
**Status**: ✅ Fungerer
- All funktionalitet operativ
- Risk matching fungerer riktig
- Smittepass-data returneres korrekt

### 🟡 Prediksjon-Cache Kan Være Treg
**Symptom**: Første load tar lang tid
**Løsning**:
1. Copernicus Marine API kan være treg første gang
2. Cache lagres i `disease_spread_cache.json`
3. Påfølgende kall er raskere

### Hvis Båt-Dashboard Viser "Loading..." evig
**Symptom**: Data kommer aldri
**Debug**:
1. DevTools → Network → Sjekk `/api/vessels`
2. Hvis 404: Backend har ikke implementert endepunktet
3. Hvis 500: Backend-error (sjekk logs)
4. Hvis data men ikke render: Sjekk vessel-map.js viualiseringslogikk

---

## 🛠️ Feilsøking

### Dashboard Viser Ingen Båter
**Løsning**:
1. Sjekk backend kjører på port 8000
2. Test `/api/vessels` i Swagger: http://127.0.0.1:8000/docs
3. Hvis 404: Kontroller backend har vessel-endpoints implementert
4. Hard-refresh: Ctrl+Shift+Delete

### Smittepass Returnerer 404
**Løsning**:
1. Sjekk at `/api/boat/smittepass/{mmsi}` eksisterer i backend
2. Bruk reell MMSI fra en båt i `/api/vessels`
3. Kontroller backend-logs for detaljert error

### Hva-Hvis Scenario Viser Feil Data
**Løsning**:
1. Kontroller `facility_codes` parameter er komma-separert
2. Sjekk facility-kodene eksisterer i `/api/facilities`
3. DevTools → Network → Se request-payload

### Cache Er Stale (Gammelt Data)
**Løsning**:
```powershell
# Slett prediction-cache
del "EKTE_API/src/api/data/predictions_cache.json" 2>$null

# Force refresh fra API
# http://127.0.0.1:8000/api/risk/predictions/all?force_refresh=true
```

---

## 📝 Miljø-Variabler (.env)

**Lokasjon**: `EKTE_API/.env`

```env
# BarentsWatch API
BARENTSWATCH_CLIENT_ID=email@example.com:Kyst-Monitor
BARENTSWATCH_CLIENT_SECRET=SecretHere

# BarentsWatch AIS
BARENTSWATCH_AIS_CLIENT_ID=email@example.com:Kyst-Monitor-AIS
BARENTSWATCH_AIS_CLIENT_SECRET=SecretHere

# Copernicus Marine
COPERNICUS_USERNAME=email@example.com
COPERNICUS_PASSWORD=PasswordHere

# Optional
DEBUG=false
CACHE_TTL_HOURS=24
```

---

## 📞 Quick Help - Båtsida

| Problem | Løsning |
|---------|--------|
| Ingen båter på kart | Sjekk `/api/vessels` returnerer data |
| Risk % ser gal ut | Sjekk `assessVesselRisk()` i vessel-logic.js |
| Smittepass 404 | Kontroller MMSI er gyldig |
| Cache er stale | Slett `predictions_cache.json` |
| Port 8000 i bruk | `taskkill /F /IM python.exe` |

---

## 📅 Versjon-Historikk

**v1.1 - 27. februar 2026** (CURRENT)
- ✅ 10km proximity safety feature implementert (217 anlegg detected)
- ✅ Toggle bug FIXED (CSS-only approach, no Leaflet corruption)
- ✅ Route planning error fixed (batches.sort)
- ✅ Filter logic completely rewritten (inverted to show-by-default)
- ✅ Color system finalized (gul/oransje/rød/grønn + distinkte farger)
- ✅ All anlegg always visible (toggle only affects color, never visibility)
- ✅ Tested with multiple toggle sequences (stable)

**v1.0 - 21. februar 2026**
- ✅ BarentsWatch risk matching fikset
- ✅ All båt-funksjoner operativ
- ✅ Smittepass-system fungerer
- ✅ Hva-hvis simulering implementert
- ✅ Prediksjon-modell deployert

**Status**: Produksjonsklar

---

## 🚀 For Neste Utvikler

### Arkitektur-Highlights:

- **Matching Logic**: Prioriter `facility_code` før navn
- **Risk Filtering**: Kun Ekstrem/Høy fra BarentsWatch
- **API Calls**: Caches for ytelse (24h TTL)
- **Frontend State**: Bruker vessel-storage.js for klient-cache

### Testing Checklist:
- [ ] Alle båter laster og vises på kart
- [ ] Risk-farger matcher BarentsWatch
- [ ] Smittepass-endepunkt returnerer riktig data per anlegg
- [ ] Hva-hvis simulator viser riktige risiko-estimater
- [ ] Prediksjon-trend beregnes riktig

### Neste Steg:
1. Legg til mer granular risiko-komponenter
2. Implement real-time risiko-oppdateringer
3. Legg til historikk-grafar for trend-visualisering

---

## 🔗 Relaterte Ressurser

- **Facility Dashboard**: `14.04. NY BUILD/facility-dashboard/README.md`
- **Backend API**: `EKTE_API/README.md`
- **Kyst Monitor README**: Rot `README.md`
- **API Dokumentasjon**: `http://127.0.0.1:8000/docs`

---

**Sist oppdatert**: 27. februar 2026  
**Status**: Produksjonsklar  
**Testet av**: Nåværende sesjon

14.04. NY BUILD/
	admin-dashboard/
		index.html
		app.js
		risk-map.js
		styles.css
	vessel-dashboard/
		index.html
		vessel.js
		vessel-map.js
		vessel-storage.js
		routes-planner.js
		styles.css
```

## Status siste sesjon

- API oppe paa 8000
- Admin dashboard oppe paa 8082
- Baat dashboard oppe paa 8081 (riktig layout)

Hvis alt krasjer, bruk denne README for aa starte opp paa nytt fra ren tilstand.
