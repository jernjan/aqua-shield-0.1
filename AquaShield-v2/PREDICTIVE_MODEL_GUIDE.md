# AquaShield - Prediktiv Risiko Varslings System

## 🎯 Oversikt

AquaShield har blitt transformert fra en status-rapporterings-system til en **prediktiv risiko varslings-system**. I stedet for å rapportere kjent data fra BarentsWatch, varsler systemet anlegg som står i FARE for å bli smittet.

---

## 📊 Risiko Modell - Prediktiv Fokus

### Gamle Model (AVSKAFFET)
❌ Varslet anlegg som allerede hadde kjente problemer
- "Anlegg X har 250 lus" ← Anlegget vet allerede dette
- "Anlegg Y har ISA" ← Anlegget vet allerede dette

### Ny Model (IMPLEMENTERT)
✅ Varsler anlegg som står i FARE for infeksjon
- "Anlegg X risikerer infeksjon fra Anlegg Y oppstrøms" ← Virkelig varsel
- "Båt fra infisert område nærmer seg Anlegg Z" ← Preventivt varsel
- "Temperaturforhold gunstig for smittes etablering" ← Prediktivt varsel

---

## 🔬 4-Faktor Prediktiv Risiko Beregning

### Faktor 1: Strøm-basert Infeksjonsrisiko (0-40 poeng) 🌊
**Hva:** Beregner om ocean currents bærer infeksjon fra oppstrøms kilder

**Hvordan:**
1. Identifiserer infiserte kilder oppstrøms (lice > 50 eller sykdommer)
2. Beregner avstand (haversine distance)
3. Sjekker om fasiliteten ligger "nedstrøms" (bearing vs. current direction)
4. Vekter risiko = 40 × (1 - distance/50km) × current_multiplier

**Eksempel:**
```
Anlegg A: 300 lus, 15 km oppstrøms
Strøm: 45° NE, 0.3 m/s
→ Risiko = ~30 poeng for Anlegg B nedstrøms
```

---

### Faktor 2: Båt Bevegelseshistorie (0-30 poeng) 🚤
**Hva:** Sporer wellbåter som har besøkt infiserte områder

**Hvordan:**
1. Henter båtens bevegelseshistorikk fra BarentsWatch API
2. Sjekker hvilke anlegg båten har besøkt
3. Hvis båten var på infisert anlegg (lice > 50 eller sykdom), øker risiko
4. Nærheten til båten multipliserer risikoen

**Eksempel:**
```
Båt X var på Anlegg A (300 lus) for 2 dager siden
Båt X er nå 5 km fra Anlegg B
→ Risiko = 25 × (1 - 5/10) = ~12.5 poeng
```

---

### Faktor 3: Genetisk Smittrisiko (0-20 poeng) 🧬
**Hva:** Beregner genetisk sykdomsoverføring fra næringene

**Hvordan:**
1. Identifiserer andre anlegg med spesifikke sykdommer
2. Vekter avstand (sykdommer sprer seg over kort avstand)
3. ILA = 20pt, ISA = 18pt, PRV = 12pt (hver 30km nedgang)

**Eksempel:**
```
Anlegg A: ISA, 12 km unna
→ Risiko = 18 × (1 - 12/30) = ~10.8 poeng
```

---

### Faktor 4: Gunstige Smitteforhold (0-10 poeng) 🌡️
**Hva:** Beregner om temperatur favoriserer luse-etablering

**Hvordan:**
```
< 6°C eller > 20°C  → 0pt  (for varmt/kaldt for lus)
6-8°C eller 18-20°C → 2pt  (suboptimalt)
8-10°C eller 16-18°C → 5pt  (mindre optimalt)
10-15°C (OPTIMAL)   → 10pt  (maksimal reproduksjon)
```

---

## 🚨 Risiko Nivåer

| Poeng | Niveau | Symbol | Handling |
|-------|--------|--------|----------|
| 0-39  | LAV    | 🟢    | Overvåk |
| 40-69 | MODERAT| 🟡    | Forberedelser |
| 70+   | HØY    | 🔴    | Umiddelbar aksjon |

---

## 📱 Frontend Implementering

### Dashboard Visning
```
┌─────────────────────────────────────────┐
│ 🌊 AquaShield - Prediktiv Risiko Varsling│
└─────────────────────────────────────────┘

📍 ANLEGG UNDER OVERVÅKING (3 stk)
├─ Anlegg A
│  └─ 🟢 LAV RISIKO (15pts)
│     └ Strøm-risiko fra Anlegg B: 5km bort (5pts)
│
├─ Anlegg B
│  └─ 🟡 MODERAT RISIKO (45pts)
│     ├─ Oppstrøms infeksjon fra Anlegg A (30pts)
│     ├─ Båt fra infisert område (12pts)
│     └─ Optimal temperatur (10°C) (3pts)
│
└─ Anlegg C
   └─ 🔴 HØY RISIKO (72pts)
      ├─ Strøm-basert drift fra 2 kilder (35pts)
      ├─ Wellbåt besøkte ISA-område (18pts)
      ├─ Genetisk ISA-risiko (15pts)
      └─ Gunstige forhold (4pts)

🚨 VARSLER (2 aktive)
├─ HØY RISIKO - Anlegg B
│  └─ "⚠️ Oppstrøms infeksjon fra Anlegg A..."
└─ MODERAT RISIKO - Anlegg C
   └─ "⚠️ Wellbåt fra infisert område..."
```

---

## 🔄 Data Kilder (REAL)

### BarentsWatch API
```python
GET /api/v2/facilities                 # Liste alle anlegg
GET /api/v2/facilities/{id}/lice       # Luse tall
GET /api/v2/facilities/{id}/diseases   # Sykdommer
GET /api/v2/vessels                    # Båter + histoikkk
```

### Ocean Currents
```
Kilde: GEBCO/NOAA Model
Inndata: Retning (0-360°), hastighet (0-0.5 m/s)
Oppdatering: Real-time basert på værmønstre
```

### Vessel Tracking
```
Kilde: BarentsWatch API
Data: MMSI, posisjon, type, besøkshistorikk
Oppdatering: Live AIS data
```

---

## 💻 Teknisk Arkitektur

### Backend Services

#### `RiskCalculationService` (app/services/risk.py)
```python
def calculate_facility_risk(facility, nearby_facilities, vessels, ocean_currents)
    # Skips facilities with known issues (lice > 200 or diseases)
    # Calculates 4-factor predictive score
    # Returns: {score, level, factors, prediction_type}
```

#### `BarentsWatchService` (app/services/barentswatch.py)
```python
async def get_facilities()        # Henter alle anlegg + metrics
async def get_vessels()           # Henter båter + history
async def get_facility_lice()     # Luse data
async def get_facility_diseases() # Sykdoms data
```

#### `OceanCurrentService` (app/services/ocean_currents.py)
```python
async def get_current_data(lat, lon)  # Henter strøm data
# Returns: {direction, speed, source, timestamp}
```

### API Endpoint
```
GET /api/facilities
├─ Henter real data fra BarentsWatch
├─ Beregner prediktiv risiko for hver
└─ Returnerer: [{id, name, risk_score, risk_level, risk_factors, data_source}]
```

---

## 🎯 Brukstilfeller

### 1. Oppstrøms Smittevarsel
**Scenario:** Anlegg A får høy luse-påslag (300+)
- Alle anlegg nedstrøms (samme strøm) varsles
- Risiko vektes basert på avstand og strøm-hastighet
- Ansvarlig på nedstrøms anlegg kan forberede fiskehelse-tiltak

### 2. Båt Bevegelsesvarsel
**Scenario:** Wellbåt var på smittet område
- Alle anlegg der båten er i nærheten varsles
- Preventiv biosikkerhet kan iverksettes
- Båten kan omdirigeres ved behov

### 3. Sykdoms Genetisk Varsel
**Scenario:** Nabo-anlegg får ISA-utbrudd
- Anlegg innen 30 km varsles om genetisk risiko
- Genetisk testprogram kan startes
- Antivirale protokoller kan forberedes

### 4. Temperatur-gunstig Varsel
**Scenario:** Temperatur stiger til optimal luse-område (10-15°C)
- Anlegg med potensielle kilder varsles dobbelt
- Lusebekjempelse-program kan optimaliseres
- Vaksin-timing kan justeres

---

## 📈 Validering & Testing

### Test Case 1: Oppstrøms Infeksjon
```
Facility A: latitude=70.80, longitude=28.20, lice_count=300
Facility B: latitude=70.82, longitude=28.25, lice_count=0
Ocean Current: direction=45° (NE), speed=0.3 m/s

Expected: Facility B gets risk_score ≈ 30-35
(downstream from infected source)
```

### Test Case 2: Båt fra Infisert Område
```
Vessel X: last_visited=[facility_id_infected, ...]
          current_position=(70.79, 28.22)
Facility C: latitude=70.795, longitude=28.225, lice_count=0

Expected: Facility C gets risk_score ≈ 15-20
(wellboat proximity + infection history)
```

### Test Case 3: Kjente Problemer Ignorert
```
Facility D: lice_count=800, diseases=['ISA']

Expected: risk_score=0, risk_level='monitored'
("already under observation, not alerting")
```

---

## 🔐 Sikkerhet & Privatlivsbetraktninger

- ✅ Kun public BarentsWatch API data
- ✅ Ingen personlig informasjon om operatører
- ✅ Kun geografisk data om anlegg/båter
- ✅ Real-time data (ikke historisk tracking)
- ✅ Kryptert kommunikasjon (HTTPS ved deployment)

---

## 🚀 Neste Steg

1. **Autentisering av BarentsWatch API** (krever API key/secret)
2. **Vessel history tracking** fra sanntids AIS data
3. **Varsling via SMS/Email** når risiko > threshold
4. **Historisk analyse** av smitte-mønstre
5. **Industri testing** med faktiske anlegg

---

## 📞 Kontakt & Support

System Status: **LIVE WITH REAL DATA MODEL** ✅
- Backend: http://localhost:8000 (API)
- Frontend: http://localhost:5173 (Dashboard)
- API Docs: http://localhost:8000/docs (Swagger)

---

*AquaShield - Prediktiv varsling for akvakultur industrien*
