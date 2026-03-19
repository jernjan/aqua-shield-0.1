# 🏭 Anleggsdashboard (Facility Monitoring)

Sanntids monitorering av norske akvakulturanlegg med sykdomsrisiko, båtkontakt og havstrøm-visualisering.

**Status: OPERASJONELL** ✅ (27. februar 2026)
- BarentsWatch risiko-matching: Fikset ✅ (21. februar)
- Backend API: Fullt fungerende ✅
- Dashboardet: Stabil og testet ✅
- Ingen breaking changes 21-27 februar ✓

---

## 🎯 Hva Gjør Dette Dashboardet?

### Hovedfunksjoner
- **Risiko-status**: Sanntidsvisning av sykdomsrisiko (grønn/oransje/rød)
- **BarentsWatch Integrering**: Offisielle karantene-soner for ILA/PD
- **Båtkontakt**: Historikk over besøkende fartøy (AIS data)
- **Havstrøm**: Visualisering av strømretning ved anlegget
- **Nærliggende Anlegg**: Kart med alle anlegg innen 15km radius

### Datasøk Struktur
- **Lokale Sykdommer**: Fra lokale anleggs-registreringer
- **BarentsWatch Soner**: Offisielle karantene/overvåkingsoner
- **Fartøysporinger**: Real-time AIS-data fra Kystverket
- **Havstrøm**: NorKyst-800 (Meteorologisk institutt)

---

## 📝 Session Status 21-27 Februar 2026

### Status Denne Sesjonen
**INGEN endringer i facility-dashboard.** Dashboardet er stabil fra 21. februar.

**Arbeidet fokuserte på vessel-dashboard** (ligger samme mappe, se `vessel-dashboard/README.md`):
- ✅ 10km proximity safety feature (217 anlegg)
- ✅ Critical toggle bug fix (Leaflet state corruption)
- ✅ Route planning error fix
- ✅ Filter logic rewrite
- ✅ Color system finalized (red/orange/pink/green)

### Stability Status ✅
**facility-dashboard er STABIL og TESTED** ✅

**Working**:
- ✅ Anlegg lastes fra API
- ✅ BarentsWatch matching fungerer (hierarkisk: kode → navn → geo)
- ✅ Risiko-farger korrekt (grønn/oransje/rød)
- ✅ 15km nærliggende-sirkel
- ✅ Popup-info vises

**Known Issues (Uløst fra 21. februar)**:
- ❌ Fartøy-display (se "🐛 Kjente Problemer" seksjon)
- ❌ Havstrøm suboptimal (dokumentert)
- ❌ Metadata-panel mangler (dokumentert)

**HVis du jobber videre**: Se "🚀 For Neste Chat-Sesjon" for prioritering.

### Quick Test for Neste Agent
```powershell
# Terminal 1: Backend
cd EKTE_API
.\.venv\Scripts\Activate.ps1
python -m uvicorn src.api.main:app --host 127.0.0.1 --port 8000

# Terminal 2: Dashboard
cd "14.04. NY BUILD/facility-dashboard"
python -m http.server 8084

# Browser: http://127.0.0.1:8084/index.html
```
✅ Hvis anlegg laster og risiko-farger er riktige → stabilt!

---

### Datasøk Struktur
- **Lokale Sykdommer**: Fra lokale anleggs-registreringer
- **BarentsWatch Soner**: Offisielle karantene/overvåkingsoner
- **Fartøysporinger**: Real-time AIS-data fra Kystverket
- **Havstrøm**: Copernicus Marine data (NOAA)

---

## 🔧 KRITISK FIX: BarentsWatch Risiko-Matching

### Problemet ❌
Dashboardet viste isolerte oransje anlegg som IKKE samsvarte med BarentsWatch's offisielle soner.
Eksempel: "Kalvøya" viste oransje men var grønn på BarentsWatch.

**Rotårsak**: BarentsWatch-databasen har **flere anlegg med samme navn** (f.eks. 2 "Kalvøya", 3 "Djupvik", 4 "Sandvika" i ulike kommuner). Dashboardet matchet kun på navn uten å sjekke anleggskoden, så feil lokality arvete risiko fra navn-identiske anlegg 150km unna.

### Løsningen ✅
**Hierarkisk matching** med tre prioritetsnivåer:

```javascript
// 1. Match by facility_code (localityNo) - BESTE
if (facilityCode) {
  const match = riskList.find(r => String(r.facility_code) === String(facilityCode));
  if (match) return MATCH_BY_CODE;
}

// 2. Match by exact name - BARE hvis unikt navn
if (isNameUnique) {
  const match = riskList.find(r => r.facility_name === name);
  if (match) return MATCH_BY_NAME;
}

// 3. Match by geo-proximity - SISTE MULIGHET (≤1km)
const geoMatch = findClosestFacility(lat, lon, 1.0);
if (geoMatch && distance <= 1km) return MATCH_BY_GEO;
```

### Implementert I
- ✅ `facility-data.js` → `getFacilityRiskData(facility)` (linje 291-348)
- ✅ `facility-logic.js` → Risiko-beregning
- ✅ `facility-map.js` → Kartvisning
- ✅ `vessel-map.js` → Båt-dashboardet

### Verifisert ✅
- **Kalvøya lokalityNo=12371** (i ILA-sone): **Oransje** ✓
- **Kalvøya lokalityNo=15118** (ikke i sone): **Grønn** ✓
- Ingen falsk-positive oransje-markører

---

## 🚀 Slik Kjører Du Dashboardet

### Alternatif 1: PowerShell (Windows)
```powershell
cd "c:\Users\janin\OneDrive\Skrivebord\Kyst monitor DEMO\14.04. NY BUILD\facility-dashboard"
python -m http.server 8084
```
✅ Åpne: `http://127.0.0.1:8084/index.html`

### Alternatif 2: CMD (Windows)
```cmd
cd "c:\Users\janin\OneDrive\Skrivebord\Kyst monitor DEMO\EKTE_API"
.venv\Scripts\activate
python -m uvicorn src.api.main:app --host 127.0.0.1 --port 8000
```

### Alternatif 3: Bash/Shell (Mac/Linux)
```bash
cd "Kyst monitor DEMO/14.04. NY BUILD/facility-dashboard"
python -m http.server 8084
```

---

## 🔌 API-Endepunkter (Backend må kjøre på port 8000)

### Anlegg (Facilities)
```
GET /api/facilities
  └─ Returnerer alle ~2,687 akvakulturanlegg i Norge
  └─ Params: limit=50&skip=0 (paginering)
  └─ Inneholder: anleggskode, navn, lat/lon, type, art, kapasitet

GET /api/facilities/{code}
  └─ Spesifikt anlegg by facility code

GET /api/facilities/near/{lat}/{lon}?radius_km=15
  └─ Anlegg innenfor X km radius
```

### Sykdom & Risiko ⭐ VIKTIG
```
GET /api/facilities/disease-spread
  └─ OFFISIELLE BarentsWatch risiko-soner
  └─ Inneholder: Karantene-/overvåkingssoner, risiko-nivå
  └─ Nivåer: Ekstrem, Høy, Moderat, Lav
  └─ Datakilde: BarentsWatch ukelege helse-data
  └─ Cache: 24 timer TTL (lagres i disease_spread_cache.json)
```

### Fartøy (Vessels/AIS)
```
GET /api/vessels?limit=100
  └─ Real-time fartøysposisjoner fra AIS
  └─ Inneholder: MMSI, navn, lat/lon, fart, kurs

GET /api/boat/plan/confirmed
  └─ Fartøysruter med karantene-status
```

### Havstrøm (Ocean Currents)
```
GET /api/ocean/current?lat={latitude}&lon={longitude}
  └─ Strøm ved gitt posisjon
  └─ Returnerer: retning (grader), fart (m/s), tidsstempel
  └─ Datakilde: NorKyst-800 (Meteorologisk institutt)
  └─ Resolusjon: 9km, oppdatert hver time
  └─ Dekning: Barentshavet (70-82°N, 10-35°E)
```

---

## 📊 Datamodeller

### Anlegg-Objekt (fra `/api/facilities`)
```javascript
{
  localityNo: 12371,              // ← BRUK DETTE TIL MATCHING!
  name: "Kalvøya",
  latitude: 69.1234,
  longitude: 18.5678,
  type: "Matfisk",                // Matfisk/Settefisk/Stamfisk
  species: "Laks",                // Laks/Regnbueørret/Ørret
  capacity: 1500,                 // Tonn
  purpose: "Kommersiell",
  municipality: "Tromsø",
  productionArea: "Tromsøflaket",
  diseased: false,
  liceCount: 2.3,
  fishCount: 150000
}
```

### Risiko-Data (fra `/api/facilities/disease-spread`)
```javascript
{
  facility_code: 12371,           // ← MATCHER localityNo
  facility_name: "Kalvøya",       // Backup
  risk_level: "Høy",              // Ekstrem/Høy/Moderat/Lav
  zone_type: "SURVEILLANCE",      // PROTECTION eller SURVEILLANCE
  latitude: 69.1234,
  longitude: 18.5678,
  timestamp: "2026-02-21T08:00:00Z"
}
```

### Fartøy-Objekt (fra `/api/vessels`)
```javascript
{
  mmsi: 257123456,                // Unikt fartøy-ID
  name: "MS Fisherman",
  latitude: 69.5,
  longitude: 19.3,
  speedOverGround: 8.5,           // Knop
  trueHeading: 45,                // Grader
  timestamp: "2026-02-21T12:34:56Z"
}
```

### Havstrøm-Objekt (fra `/api/ocean/current`)
```javascript
{
  latitude: 69.1234,
  longitude: 18.5678,
  direction: 225,                 // Grader (0=N, 90=Ø, 180=S, 270=V)
  speed: 0.23,                    // m/s
  timestamp: "2026-02-21T11:00:00Z"
}
```

---

## 📁 Filstruktur

```
14.04. NY BUILD/
├── facility-dashboard/                    ← DENNE MAPPEN
│   ├── index.html                        # Hovedside
│   ├── app.js                            # App-initialisering
│   ├── facility-data.js      ⭐ VIKTIG   # Data-lasting (Risk matching her!)
│   ├── facility-logic.js                 # Risiko-beregning
│   ├── facility-map.js       ⭐ VIKTIG   # Kartvisning
│   ├── styles.css                        # Styling
│   └── README.md                         # DENNE FILEN
│
└── vessel-dashboard/                      # Båt-dashboardet
    ├── index.html
    ├── app.js
    ├── vessel-data.js
    ├── vessel-logic.js
    ├── vessel-map.js        ✅ Fungerer
    └── README.md
```

---

## 🔍 Nøkkelfiler Forklart

### facility-data.js (Data-lasting)
**Viktig funksjon**: `getFacilityRiskData(facility)` (linje 291-348)
- Implementerer hierarkisk matching (kode → navn → geo)
- Håndterer duplikate anleggsnavn sikkert
- Returnerer risiko-info med `_match_method` for debugging
- Inkluderer valgfritt logging (`debugRiskMatching` flag)

**Hva den gjør**:
1. Henter alle anlegg fra `/api/facilities`
2. Henter risiko-soner fra `/api/facilities/disease-spread` (cachete)
3. Matcher anlegg med risiko-soner hierarkisk
4. Returnerer data for kartvisning

### facility-logic.js (Risiko-beregning)
**Viktig funksjon**: `assessFacilityRisk(facility)` (linje 1-150)
- Vurderer risiko basert på flere faktorer
- **Filter**: Kun risiko-nivå Ekstrem/Høy (ignorerer Moderat)
- Nærhets-sjekk: Smittede anlegg innen 15km
- Status-bestemmelse: Grønn/Gul/Oransje/Rød

**Logikk**:
```
IF lokalt smitta → Status = "Smittet" (100% risiko)
ELSE IF i offisiell BW-sone (Ekstrem/Høy) → Høy risiko
ELSE IF smittede anlegg <15km bort → Moderat risiko
ELSE IF dårlig desinfeksjons-historikk → Info-anbefaling
ELSE → Grønt
```

### facility-map.js (Kartvisning)
**Viktig funksjoner**:
- `displayFacility(facility, assessment)` - Hovedvisning med 15km radius
- `displayOceanCurrent(facility)` - Havstrøm-piler (⚠️ TRENGER REFAKTORING)
- `createFacilityPopup()` - Info-popup med match-metode

**Gjeldende problemer**:
- ❌ Havstrøm viser 5 piler på samme sted (redundant)
- ❌ Viser kun strøm for valgt anlegg, ikke nærliggende
- ❌ Fartøy vises ikke ("Laster inn..." evig)

---

## 🐛 Kjente Problemer & To-Do

### 🔴 KRITISK - Fartøy Vises Ikke
**Status**: ❌ Brutt
**Symptom**: Sidebar viser "Laster inn..." men data kommer aldri
**Årsak**: `displayNearbyVessels()` initialiseres ikke riktig
**Debug-steg**:
1. Åpne DevTools (F12) → Console
2. Sjekk for errorer på `/api/vessels`
3. Network-tab → Sjekk HTTP-status
4. Test manuelt: `FacilityMap.displayNearbyVessels(testData)`
5. Sjekk callback-kjeden i `displayFacility()`

### 🟡 MEDIUM - Havstrøm Suboptimal
**Status**: Fungerer, men dårlig UX
**Problem**: 5 piler på samme sted er redundant; viser ikke strøm for nærliggende anlegg
**Ønsket**:
- 1 pil per nærliggende anlegg (innen 15km)
- Pil-størrelse skal skaleres med strøm-fart
- Bedre visuell representasjon av drift-mønstre
**Implementasjon**:
- Refaktor `displayOceanCurrent()` i `facility-map.js` (linje 422+)
- Loop gjennom nærliggende anlegg
- Hent strøm for hver lokasjon
- Cache strøm-data (API kan være treg)
- Skaler pil-størrelse/farge etter fart

### 🟡 MEDIUM - Mangler Anleggs-Metadata Panel
**Status**: ❌ Ikke implementert
**Ønsket**: "Om lokaliteten" panel som BarentsWatch
**Skal vise**:
- Matfisk/Settefisk/Stamfisk type
- Art (Laks, Regnbueørret, Ørret)
- Posisjon (lat/lon med desimaler)
- Lokalitets-nummer (anleggskode)
- Kapasitet (Tonn - TN)
- Formål (Kommersiell/etc)
- Kommune
- Produksjonsområde
**Datakilde**: `facility`-objekt fra `/api/facilities`
**Implementasjon**:
- Lag ny HTML-panel
- Fyll fra `facility`-objekt-egenskaper
- Match BarentsWatch-layout

---

## 🛠️ Feilsøking

### API Responderer Ikke
```
Feil: Connection refused på port 8000
```
**Løsning**:
1. Sjekk at backend kjører: `python -m uvicorn src.api.main:app --host 127.0.0.1 --port 8000`
2. Sjekk port 8000 er ledig: `netstat -ano | findstr :8000` (Windows)
3. Lukk stuck processes: `taskkill /F /IM python.exe`

### Dashboardet Viser Ingen Anlegg
**Symptom**: Tomt kart eller alle grønne
**Løsning**:
1. DevTools → Network-tab
2. Sjekk `/api/facilities` returnerer data (200 OK)
3. Sjekk `/api/facilities/disease-spread` returnerer risiko-data (200 OK)
4. Hard-refresh: Ctrl+Shift+Delete eller Cmd+Shift+Delete
5. Sjekk browser-konsoll for JavaScript-feil

### Risiko-Farger Er Gale
**Symptom**: Anlegg viser oransje men burde være grønt
**Løsning**:
1. DevTools → Console → Sjekk debug-logs
2. Sjekk at anleggets `localityNo` matcher BW `facility_code`
3. Verify BarentsWatch returnerer data (sjekk cache-fil)
4. Slett cache: `Delete EKTE_API/src/api/data/disease_spread_cache.json`
5. Omstart API-server

### Havstrøm Vises Ikke
**Symptom**: Ingen piler på kartet eller "Laster inn..."
**Løsning**:
1. Sjekk `/api/ocean/current?lat=X&lon=Y` returnerer data
2. NorKyst-800 data kan være treg (1-2s er normalt)
3. Hvis ingen data: Sjekk at `barentshavet_currents.nc` finnes i EKTE_API/data/
4. Sjekk EKTE_API-logs for ocean current-feil

---

## 📝 Miljø-Variabler (.env)

**Lokasjon**: `EKTE_API/.env` (må opprettes, ikke i git)

```env
# BarentsWatch API
BARENTSWATCH_CLIENT_ID=email@example.com:Kyst-Monitor
BARENTSWATCH_CLIENT_SECRET=SecretHere

# BarentsWatch AIS
BARENTSWATCH_AIS_CLIENT_ID=email@example.com:Kyst-Monitor-AIS
BARENTSWATCH_AIS_CLIENT_SECRET=SecretHere

# NorKyst-800 (Havstrøm)
# No credentials needed - uses local NetCDF file

# Valgfritt
DEBUG=false
LOG_LEVEL=INFO
CACHE_TTL_HOURS=24
```

**Status**: ✅ Alle konfigurert (21. feb 2026)

---

## 📞 Quick Reference - Hva Skal I Hva?

| Problem | Fil å Sjekke |
|---------|---|
| Risiko-farger gale | `facility-logic.js` → `assessFacilityRisk()` |
| Fartøy mangler | `facility-map.js` → `displayNearbyVessels()` |
| Havstrøm mangler | `facility-map.js` → `displayOceanCurrent()` |
| API-feil 404 | `EKTE_API/src/api/main.py` → Sjekk rute |
| Treg ytelse | DevTools Performance-tab |
| Stale cache | Slett `disease_spread_cache.json` + omstart API |

---

## 🔐 Sikkerhet

- ✅ API-nøkler i `.env` (ikke i git)
- ✅ CORS aktivert for 127.0.0.1
- ✅ Input-validering med Pydantic (backend)
- ✅ Ingen sensitive-data i logs

---

## 📅 Versjon-Historikk

**v1.0 - 21. februar 2026**
- ✅ BarentsWatch risk matching fikset (kode → navn → geo)
- ✅ Anleggsdashboardet operasjonelt
- ✅ Båt-dashboardet fungerer riktig
- ✅ Havstrøm implementert
- ⚠️ Pending: Fartøy-fix, metadata-panel, multi-anlegg-strøm

**Eldre versjoner**: Se `14.02. NY BUILD/` og `Kyst 16.01.2026/` for eksperimentelle implementasjoner

---

## 🚀 For Neste Chat-Sesjon

### Prioritert arbeid:

1. **FIX FARTØY-DISPLAY** (KRITISK)
   - Debug `displayNearbyVessels()`
   - Test callback-kjede
   - Validere `/api/vessels` returnerer data

2. **Legg til Metadata Panel** (MEDIUM)
   - Lag HTML-panel for anleggs-detaljer
   - Fyll fra facility-objekt
   - Match BarentsWatch-stil

3. **Multi-anlegg Havstrøm** (MEDIUM)
   - Refaktor `displayOceanCurrent()`
   - Implement caching
   - Skaler piler etter fart

4. **Testing Checklist**:
   - [ ] Alle anlegg laster uten treghet
   - [ ] Risiko-farger matcher BarentsWatch
   - [ ] Fartøy vises og oppdateres
   - [ ] Havstrøm vises med riktig retning
   - [ ] Ingen console-feil

### Arkitektur-Insights:

- **Anlegg-Matching**: Prioriter alltid `localityNo` før navn
- **Risiko-Filter**: Kun Ekstrem/Høy fra BW (ignorerer Moderat)
- **Ytelse**: API er rask; flaskehals er browser-rendering
- **Cache**: Disease-spread data cachetes 24h; slett manuelt før testing
- **CORS**: Frontend/backend må kjøre på samme host (127.0.0.1)

---

## � Versjon-Historikk

**v1.0 - 21. februar 2026**
- ✅ BarentsWatch risk matching fikset (kode → navn → geo hierarki)
- ✅ Anleggsdashboardet operasjonelt
- ✅ Havstrøm implementert
- ⚠️ Pending: Fartøy-fix, metadata-panel, multi-anlegg-strøm

**v1.0.1 - 27. februar 2026** (CURRENT)
- ✅ Dokumentasjon oppdatert for neste agent
- ✅ Session status-seksjon lagt til
- ✅ Test-checklist lagt til
- ✅ NO breaking changes siden 21. februar
- **Status**: STABLE & READY FOR HANDOFF

---

## 🚀 For Neste Chat-Sesjon (Ny Agent)

### Rask Orientering
**facility-dashboard er STABIL** - ingen endringer denne sesjonen. Arbeidet fokuserte på **vessel-dashboard** (se vessel-dashboard/README.md).

### Hvis Du Skal Jobber Videre - Quick Start
```powershell
# Terminal 1: Backend API
cd EKTE_API
.\.venv\Scripts\Activate.ps1
python -m uvicorn src.api.main:app --host 127.0.0.1 --port 8000

# Terminal 2: Facility Dashboard
cd "14.04. NY BUILD/facility-dashboard"
python -m http.server 8084

# Browser: http://127.0.0.1:8084/index.html
# TEST: Anlegg skal loade, risiko-farger skal vises korrekt
```

### Prioritert arbeid (Hvis du skal jobber videre)

**1. KRITISK - FIX FARTØY-DISPLAY** 
- **Fil**: `facility-map.js` → `displayNearbyVessels()`
- **Problem**: Viser "Lasters inn..." evig, fartøy-data kommer aldri
- **Debug-steg**:
  1. DevTools F12 → Network-tab
  2. Test `/api/vessels` - returnerer data?
  3. Sjekk facility-map.js linje XXX for fetch-kjede
  4. Test callback: `FacilityMap.displayNearbyVessels(testData)`

**2. MEDIUM - Legg til Metadata Panel**
- **Fil**: `facility-map.js`
- **Skal vise**: Type, Art, Kapasitet, Kommune, Produksjonsområde
- **Data-kilde**: `facility`-objekt fra `/api/facilities`
- **Design**: Match BarentsWatch-layout

**3. MEDIUM - Multi-anlegg Havstrøm**
- **Fil**: `facility-map.js` → `displayOceanCurrent()` (linje 422+)
- **Problem**: 5 piler på samme sted (redundant)
- **Løsning**: Loop nærliggende anlegg, hent strøm for hver, cache data, skaler piler

### Test Checklist for Neste Agent
```
✅ Anlegg laster fra API
✅ BarentsWatch matching fungerer (hierarkisk: kode → navn → geo)
✅ Risiko-farger er korrekt (grønn/oransje/rød)
✅ 15km nærliggende-sirkel vises
✅ Popup-info vises når anlegg klikkes
❌ KANNT ISSUE: Fartøy vises ikke (pending fix)
⚠️ Havstrøm fungerer men suboptimal (pending refactor)
```

### Arkitektur (Må Du Huske)
- **Matching**: Alltid prioriter `localityNo` før navn
- **Risk-filter**: Kun Ekstrem/Høy fra BarentsWatch (ignorerer Moderat)
- **Ports**: API 8000, Dashboard 8084 - endre IKKE uten grunn
- **Cache**: Disease-spread cachetes 24h; slett hvis du tester

### Relaterte Filer (Påstør ved behov)
- **Stabilt, IKKE endre**:
  - `facility-data.js` (risk matching logic)
  - `facility-logic.js` (risk assessment)
- **Trenger arbeid**:
  - `facility-map.js` (fartøy-display, metadata, havstrøm)

---

## 🔗 Relaterte Ressurser

- **Backend README**: `EKTE_API/README.md`
- **Vessel Dashboard**: `14.04. NY BUILD/vessel-dashboard/README.md` ← fikk major updates 27. feb!
- **Kyst Monitor README**: Rot `README.md`
- **API Dokumentasjon**: `http://127.0.0.1:8000/docs` (Swagger UI)

---

**Sist oppdatert**: 27. februar 2026  
**Status**: STABLE - READY FOR HANDOFF  
**Versjon**: v1.0.1

**For Neste Agent**: Les "📝 Session Status 21-27 Februar" og "🚀 For Neste Chat-Sesjon" for full kontekst!
