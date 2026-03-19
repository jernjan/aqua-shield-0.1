# KYST MONITOR - ENDELIG SPESIFIKASJON

## ✅ GODKJENTE BESLUTNINGER

### Risiko-beregning
- 4-faktor modell (strøm, båt, genetisk, temp)
- Vannstrøm-data: **BarentsWatch Current Forecast API**
- Update: **1x daglig** (ikke hver time)
- Terskler: Grønt <40, Gult 40-69, Rødt 70+

### Båt-tracking
- Memory: **14 dager**
- Update: 1x daglig (ikke hver 30 min)
- 3km smittesone rundt anlegg
- **NYTT:** Varsle når båt kommer innenfor 3km

### Varsler
- Kun dashboard (ikke e-post/SMS v1)
- Real-time oppdatering
- Acknowledge-system

### Frontend
- Tabeller, ingen kart
- Sortert etter risiko
- Detaljer per anlegg

---

## 🆕 NYE KRAV

### 1. SMITTESONE DETECTION (3 KM)

**Logikk:**
```python
for båt in alle_båter:
    for anlegg in alle_anlegg:
        distanse = beregn_distanse(båt.lat/long, anlegg.lat/long)
        if distanse < 3_km and anlegg.har_lus:
            # VARSEL!
            logger.warning(f"Båt {båt.navn} innenfor smittesone for {anlegg.navn}")
            create_alert(
                type="vessel_proximity",
                severity="high",
                message=f"{båt.navn} er {distanse:.1f}km fra {anlegg.navn}"
            )
```

**Database-update:**
```sql
ALTER TABLE alerts ADD COLUMN vessel_id INTEGER (FK til vessels)
ALTER TABLE vessel_visits ADD COLUMN risk_level STRING
```

### 2. DATA EXPORT FOR FORSKNING

**Mål:** Mattilsynet, NOFIMA, forsikringsselskap skal kunne hente data

**API Endepunkter for Data-Export:**
```
GET /export/facilities/{id}/health-history
  → CSV med alle lustal + behandling siste 2 år
  
GET /export/risk-assessments
  → JSON med all risiko-data for analyse
  
GET /export/vessel-movements
  → CSV med alle båtbesøk på alle anlegg
  
GET /export/incident-correlation
  → "Uke 10: 5 anlegg fikk lus, alle besøkt av båt X"
```

**Format:**
- CSV for regneark
- JSON for programmering
- API-key autentisering

### 3. MACHINE LEARNING - HISTORISK TRENINGSDATA

**Concept:**
```
FASE 1 (v1): Rule-based 4-faktor modell
  - Prediktiv men basert på regler
  
FASE 2 (v2): ML-modell trained på historiske data
  - Input: Historiske båtbevegelser, strøm, lus-utbrudd
  - Output: Bedre risiko-prediksjon
  - Modell: Random Forest eller LSTM
```

**Data vi bruker til trening:**
- 2+ års historiske lus-data
- Alle båtbesøk (fra AIS-historikk)
- Strøm-data (retroaktiv)
- Værdata (retroaktiv)
- Outcomes: "Ga båt-besøk + strøm + temp på Anlegg X faktisk til utbrudd?"

**ML Roadmap:**
```
Q1 2026: Samle historiske data + feature engineering
Q2 2026: Train modell på 2-3 år data
Q3 2026: AB-test (rule-based vs ML)
Q4 2026: Deploy ML-modell
```

**Arkitektur:**
```
Backend:
├── predict_risk_rules() → 4-faktor modell (v1)
├── predict_risk_ml() → ML-modell (v2)
└── ensemble() → kombiner begge
```

---

## 📊 OPPDATERTE TABELLER

```sql
-- Eksisterende tabeller (uendret)
- facilities
- health_status
- vessels
- vessel_visits
- weather_data
- risk_assessments
- alerts
- users

-- NYE TABELLER
- vessel_proximity_alerts
- exported_datasets (logging av hvem som hentet data når)
- ml_model_predictions (når ML-modell brukes)
```

---

## 🔌 ALLE API-ER VI BRUKER

| API | Type | Data | Freq |
|-----|------|------|------|
| BarentsWatch FiskInfo | REST | Anlegg info | 1x dag |
| BarentsWatch Fish Health | REST | Lus/sykdom | 1x dag |
| BarentsWatch AIS | REST | Båtposisjoner | 1x dag |
| BarentsWatch Current Forecast | REST | Vannstrøm | 1x dag |
| YR.no Weather | REST | Vær | 1x dag |

**Backup-plan:** Hvis en API er nede, bruker vi cached data fra forrige dag.

---

## 🎯 PRIORITERT ROADMAP

### FASE 1: MVP (2 uker)
- ✅ API-integrasjon (allerede gjort)
- ✅ Database (allerede gjort)
- 🔨 Backend risk-engine (4-faktor)
- 🔨 3km smittesone detection
- 🔨 Dashboard med varsler
- 🔨 Data-export API

### FASE 2: Produksjon (1 uke)
- Testing & bug-fix
- Deploy (Render/Fly.io)
- Dokumentasjon

### FASE 3: Forskning-integrasjon (1 uke)
- Data-export for Mattilsynet/NOFIMA
- API-docs for ekstern bruk

### FASE 4: ML (4 uker, senere)
- Samle historiske data
- Feature engineering
- Train & test modell
- AB-test vs rules

---

## ✅ SUMMARY FOR KVITSERING

Du sa **JA** til:
- ✅ 4-faktor risiko-modell
- ✅ 14 dagers båt-memory
- ✅ 1x daglig beregning
- ✅ Dashboard-varsler

Du sa **JA** til **NYE** krav:
- ✅ 3km smittesone-varsel for båter
- ✅ Data-export API for forskning
- ✅ ML-modell (roadmap)

**Neste:** Skal vi starte på Backend Risk-Engine? 🚀
