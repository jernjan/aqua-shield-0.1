# Smittepress-beregning og Langsiktig Datainnsamling

**Dato:** 7. mars 2026  
**Status:** Operasjonelt system med grunnlag for retrospektiv analyse

---

## 📊 Del 1: Hvordan beregne smittepress?

### Hva er smittepress?

**Smittepress** er et mål på hvor mye smitte en båt eller et område har vært eksponert for – ikke bare gjennom direkte besøk på smittede anlegg, men også gjennom nærhet til risikosoner og infiserte områder.

Dette er **forskjellig fra lovbasert karantene:**
- **Lovbasert karantene (hard regel):** Besøk på påvist smittet anlegg (rød) → annet anlegg innen 48t = BRUDD
- **Smittepress (advisory):** Hyppige kontakter med risikosoner, 10km-nærhet, og gjentatte visitter = PRESS

### Beregningsformel (current implementation)

```python
# Steg 1: Tell unike anlegg per kategori
risk_zone_codes = set([anlegg som er i risikosone])
near_10km_codes = set([anlegg innen 10km av smitte])
pressure_codes = risk_zone_codes | near_10km_codes  # Union av alle

# Steg 2: Beregn pressure_score (0-100)
pressure_score = min(100, 
    len(pressure_codes) * 12 +      # Totale pressure-anlegg: høy vekt
    len(risk_zone_codes) * 8 +       # Risikosone-besøk: medium vekt
    len(near_10km_codes) * 6         # 10km-nærhet: lavere vekt
)

# Steg 3: Generer advisory signals
if len(pressure_codes) >= 3:
    → HIGH_LOCAL_INFECTION_PRESSURE

if len(risk_zone_codes) >= 2:
    → REPEATED_RISK_ZONE_CONTACT

if len(near_10km_codes) >= 3:
    → REPEATED_10KM_CONTACT
```

### Eksempel: Båt med høyt smittepress

**Scenario:**
- Båt besøker 2 risikosone-anlegg (oransje)
- Båt passerer innen 10km av 4 smittede anlegg
- Båt har IKKE besøkt påvist smittet anlegg direkte

**Beregning:**
```
risk_zone_codes = 2
near_10km_codes = 4
pressure_codes = 2 + 4 = 6 (deduplisert)

pressure_score = min(100, 6*12 + 2*8 + 4*6)
               = min(100, 72 + 16 + 24)
               = min(100, 112)
               = 100
```

**Advisory signals:**
- ✅ HIGH_LOCAL_INFECTION_PRESSURE (6 ≥ 3 pressure facilities)
- ✅ REPEATED_RISK_ZONE_CONTACT (2 ≥ 2 risk zones)
- ✅ REPEATED_10KM_CONTACT (4 ≥ 3 near-10km)

**Karantenestatus:**
- ❌ INGEN LOVBRUDD (båten har ikke besøkt rødt anlegg)
- ⚠️ Høyt smittepress-varsel (advisory only)

### Hvorfor denne formelen?

**Vekting:**
- `pressure_codes * 12`: Totale unike risikoområder – høyest vekt fordi det viser bredde av eksponering
- `risk_zone_codes * 8`: Besøk i risikosoner – formelt definerte områder av Mattilsynet
- `near_10km_codes * 6`: 10km-nærhet – lavere vekt da avstand reduserer risiko

**Capping på 100:**
- Gjør score enklere å tolke (0 = null press, 100 = ekstremt høyt)
- Forhindrer at outliers ødelegger skalaen

**Set-basert deduplicering:**
- Besøk samme anlegg 10 ganger = teller som 1 anlegg
- Fokuserer på *antall distinkte risikoområder*, ikke frekvens

---

## 🎯 Del 2: Hva skal smittepress brukes til?

### 1. Operasjonell bevissthet (nåtid)

**Use case:** Anleggsoperatør ser at båt har `pressure_score: 84`

**Handling:**
- Ikke lovbrudd, men høy risiko
- Vurder ekstra desinfeksjon
- Be om dokumentasjon på rengjøring
- Avvis ruteforespørsel med begrunnelse: "Båten har operert i høyt smittepress-område"

**Frontend-visning:**
```
Båt: MS "Nordkyst" (MMSI 257123456)
Karantenestatus: ✅ CLEARED (lovlig)
Smittepress: 🔴 84 (HIGH_LOCAL_INFECTION_PRESSURE)
Advisory: "Kontakt med 5 nærliggende risikolokaliteter"
```

### 2. Epidemiologisk etterforskning (retrospektiv)

**Use case:** Nytt utbrudd oppdages på anlegg X den 15. mars

**Spørsmål:**
- Hvilke båter besøkte anlegg X i de siste 30 dagene?
- Hadde noen av disse båtene høyt smittepress *før* de kom hit?
- Finnes det et felles mønster (samme brønnbåt, samme rute)?

**SQL-query:**
```sql
SELECT 
    mmsi, 
    vessel_name,
    AVG(pressure_score) as avg_pressure,
    COUNT(DISTINCT facility_code) as unique_facilities_visited,
    MIN(timestamp) as first_visit,
    MAX(timestamp) as last_visit
FROM exposure_events
WHERE facility_code IN (
    SELECT facility_code FROM exposure_events 
    WHERE event_type = 'infected_facility' 
    AND timestamp > '2026-02-15'
)
AND timestamp BETWEEN '2026-02-01' AND '2026-03-15'
GROUP BY mmsi, vessel_name
HAVING avg_pressure > 50
ORDER BY avg_pressure DESC;
```

**Mulig funn:**
"Brønnbåt Y hadde pressure_score 72 i perioden 1-10. mars, besøkte anlegg X den 12. mars, smitte påvist 15. mars. Brønnbåten opererte tidligere i risikosone ved Nordland-klusteren."

### 3. Nettverksanalyse (smitteklynger)

**Use case:** Identifisere uformelle smittenettverk

**Problem:** Mattilsynet har ikke opprettet formell sone, men 10 anlegg i samme område har PD-smitte.

**Spørsmål:**
- Hvilke båter forbinder disse 10 anleggene?
- Er det stjerneformete mønstre (en båt til alle) eller kjeder (båt A→B→C)?
- Finnes det geografiske klynger som burde vært en formell sone?

**Nettverksgraf (konseptuell):**
```
Anlegg_1 ←→ Båt_123 ←→ Anlegg_5
    ↑                      ↓
  Båt_456 ←→ Anlegg_3 ←→ Båt_789
```

**Query for å bygge graf:**
```sql
SELECT 
    e1.facility_code as source,
    e2.facility_code as target,
    e1.mmsi as connecting_vessel,
    COUNT(*) as interaction_count
FROM exposure_events e1
JOIN exposure_events e2 ON e1.mmsi = e2.mmsi
WHERE e1.facility_code != e2.facility_code
AND e1.timestamp < e2.timestamp
AND julianday(e2.timestamp) - julianday(e1.timestamp) < 7
GROUP BY e1.facility_code, e2.facility_code, e1.mmsi
HAVING interaction_count > 1
ORDER BY interaction_count DESC;
```

### 4. Prediktiv modellering (fremtid)

**Use case:** Kan høyt smittepress predikere utbrudd 14 dager før det skjer?

**Hypotese:** Anlegg som mottar mange båter med høyt smittepress har økt sannsynlighet for utbrudd.

**ML-pipeline:**
1. **Feature engineering:** For hvert anlegg per uke, beregn:
   - Gjennomsnittlig `pressure_score` for alle besøkende båter
   - Antall unike båter med `pressure_score > 50`
   - Maksimal `pressure_score` blant besøkende
   - Geografisk nærhet til utbrudd siste 30 dager

2. **Labeling:** Markér anlegg som fikk påvist smitte innen 14 dager som `target = 1`

3. **Training:** Bruk historiske data (hele 2026) til å trene en binær klassifikator:
   - Random Forest
   - Gradient Boosting
   - Neural Network

4. **Validation:** Test på 2027-data (out-of-sample)

**Eksempel-resultat:**
"Anlegg med gjennomsnittlig `pressure_score > 60` hos besøkende båter har 3.2x høyere risiko for utbrudd innen 14 dager (OR 3.2, 95% CI 1.8-5.7, p<0.01)"

---

## 🗄️ Del 3: Langsiktig datainnsamling – Retrospektiv analyse

### Nåværende database-struktur

**Tabell: `exposure_events`**
```sql
CREATE TABLE exposure_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,  -- 'infected_facility', 'risk_zone_facility', 'near_infected_10km'
    mmsi TEXT NOT NULL,
    vessel_name TEXT,
    facility_code TEXT NOT NULL,
    facility_name TEXT,
    timestamp TEXT NOT NULL,
    duration_minutes REAL,
    metadata TEXT,  -- JSON: {visit_category, distance_meters, lat, lon, ...}
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_exposure_mmsi ON exposure_events(mmsi);
CREATE INDEX idx_exposure_facility ON exposure_events(facility_code);
CREATE INDEX idx_exposure_timestamp ON exposure_events(timestamp);
CREATE INDEX idx_exposure_type ON exposure_events(event_type);
```

**Hva lagres:**
- **Alle** vessel-facility interactions som trigger en kategori:
  - `infected_facility`: Båt <1km fra påvist smittet anlegg i 30+ min
  - `risk_zone_facility`: Båt besøker anlegg i risikosone
  - `near_infected_10km`: Båt passerer innen 10km av smitte
- **Tidsstempler:** Nøyaktig når hvert besøk skjedde
- **Duration:** Hvor lenge båten var i nærheten
- **Metadata:** JSON med ekstra detaljer (distance, coordinates, visit_category)

### Tidsserieanalyse: Eksempler

#### Eksempel 1: Ukentlig smitteutvikling

**Spørsmål:** Hvordan utviklet antall smittebesøk seg uke for uke i 2026?

**SQL:**
```sql
SELECT 
    strftime('%Y-W%W', timestamp) as week,
    COUNT(*) as total_visits,
    COUNT(DISTINCT mmsi) as unique_vessels,
    COUNT(DISTINCT facility_code) as unique_facilities
FROM exposure_events
WHERE event_type = 'infected_facility'
AND timestamp BETWEEN '2026-01-01' AND '2026-12-31'
GROUP BY week
ORDER BY week;
```

**Output:**
```
week       total_visits  unique_vessels  unique_facilities
2026-W01   12            5               3
2026-W02   18            7               4
2026-W03   45            12              8  ← Sharp increase
2026-W04   67            15              12
...
```

**Visualisering:** Line chart showing exponential growth in Week 3-4 (indikerer utbrudd-cluster)

#### Eksempel 2: Sammenligning med prediksjoner

**Spørsmål:** Predikerte vi utbruddet på anlegg Y? Hvor lang lead time?

**Steg:**
1. Hent prediction_history.json: `{"facility_code": "Y", "prediction_date": "2026-03-01", "risk_score": 87}`
2. Hent faktisk utbrudd: `SELECT * FROM exposure_events WHERE facility_code='Y' AND event_type='infected_facility' AND timestamp > '2026-03-01'`
3. Beregn lead time: `faktisk_utbrudd_timestamp - prediction_date`

**Resultat:**
"Vi predikerte høy risiko (87) på anlegg Y den 1. mars. Smitte påvist 18. mars. **Lead time: 17 dager**."

#### Eksempel 3: Geografisk spredning over tid

**Spørsmål:** Hvordan spredte smitten seg geografisk fra opprinnelig klynge?

**Steg:**
1. Finn opprinnelig smittet anlegg (første `infected_facility` event i 2026)
2. Hent alle påfølgende smittebesøk med koordinater
3. Plott på kart med tidsstempel som fargegradering

**Visualisering:**
```
t=0:   Anlegg_1 (Troms) - rød
t+7d:  Anlegg_2 (30km sør) - oransje (båt X forbinder)
t+14d: Anlegg_3 (50km vest) - gul (båt Y forbinder)
t+21d: Anlegg_4 (100km nord) - grønn (båt Z forbinder)
```

**Konklusjon:** "Smitten spredte seg sørover langs kysten med gjennomsnittlig hastighet 7km/dag, primært via brønnbåter."

### Hva kan gjøres med årslang datahistorikk?

#### 1. Sesonganalyse
**Spørsmål:** Er det sesongvariasjoner i smittepress?

**Analyse:**
```sql
SELECT 
    strftime('%m', timestamp) as month,
    AVG(pressure_score) as avg_pressure,
    COUNT(*) as event_count
FROM exposure_events
WHERE event_type IN ('risk_zone_facility', 'near_infected_10km')
GROUP BY month
ORDER BY month;
```

**Mulig funn:** "Smittepress er høyest vår/sommer (april-august) når vanntemperatur øker og fisken er stresset."

#### 2. Identifisere høyrisiko-båter
**Spørsmål:** Hvilke båter har konsekvent høyt smittepress?

**Analyse:**
```sql
SELECT 
    mmsi,
    vessel_name,
    COUNT(*) as total_interactions,
    AVG(CASE WHEN event_type='infected_facility' THEN 1 ELSE 0 END)*100 as pct_infected_visits,
    COUNT(DISTINCT facility_code) as facilities_visited
FROM exposure_events
WHERE timestamp > date('now', '-365 days')
GROUP BY mmsi, vessel_name
HAVING total_interactions > 50
ORDER BY pct_infected_visits DESC
LIMIT 20;
```

**Mulig funn:** "Brønnbåt 'Aqua Transport AS' har 23% av sine besøk på smittede anlegg – langt over gjennomsnittet (5%)."

#### 3. Evaluere karantenepolicy
**Spørsmål:** Fungerer 48t-karantene? Burde den vært lengre?

**Analyse:**
```sql
-- Find vessels that visited infected facility, then visited another facility
-- Group by time gap to see distribution
WITH quarantine_gaps AS (
    SELECT 
        e1.mmsi,
        e1.facility_code as infected_facility,
        e2.facility_code as next_facility,
        julianday(e2.timestamp) - julianday(e1.timestamp) as days_gap,
        e2.event_type as next_visit_type
    FROM exposure_events e1
    JOIN exposure_events e2 ON e1.mmsi = e2.mmsi
    WHERE e1.event_type = 'infected_facility'
    AND e2.timestamp > e1.timestamp
    AND e2.facility_code != e1.facility_code
    AND e2.event_type IN ('infected_facility', 'risk_zone_facility')
)
SELECT 
    ROUND(days_gap, 1) as gap_days,
    COUNT(*) as occurrences,
    COUNT(CASE WHEN next_visit_type='infected_facility' THEN 1 END) as resulted_in_infection
FROM quarantine_gaps
WHERE days_gap <= 7
GROUP BY ROUND(days_gap, 1)
ORDER BY gap_days;
```

**Mulig funn:**
```
gap_days  occurrences  resulted_in_infection
0.5       45           12   (27% infection rate)
1.0       38           8    (21%)
1.5       29           5    (17%)
2.0       22           2    (9%)  ← 48t threshold
2.5       15           1    (7%)
3.0       12           0    (0%)
```

**Konklusjon:** "Infeksjonsrate faller dramatisk etter 48t, men er ikke null før 72t. Vurder å øke karantene til 3 dager."

#### 4. Nettverksanalyse: Super-spreader båter
**Spørsmål:** Hvilke båter fungerer som "hub" i smittenettverk?

**Analyse:** Bruk graph theory (NetworkX i Python):
```python
import networkx as nx
import sqlite3

conn = sqlite3.connect('exposure_database.db')
events = pd.read_sql_query(
    "SELECT mmsi, facility_code, timestamp FROM exposure_events WHERE event_type='infected_facility'",
    conn
)

# Build bipartite graph: vessels ↔ facilities
G = nx.Graph()
for _, row in events.iterrows():
    G.add_edge(row['mmsi'], row['facility_code'], timestamp=row['timestamp'])

# Find vessels with highest betweenness centrality (most connections)
centrality = nx.betweenness_centrality(G)
vessels = {k:v for k,v in centrality.items() if k.startswith('25')}  # MMSI starts with country code
top_vessels = sorted(vessels.items(), key=lambda x: x[1], reverse=True)[:10]

print("Top 10 super-spreader vessels:")
for mmsi, score in top_vessels:
    print(f"{mmsi}: centrality = {score:.3f}")
```

**Mulig funn:** "MMSI 257891234 (Brønnbåt 'NorAqua 5') har centrality 0.342, forbinder 15 distinkte smitteklynger."

---

## 🚀 Del 4: Implementert vs. Fremtidig funksjonalitet

### ✅ Implementert nå (Mar 7, 2026)

| Funksjon | Status | Beskrivelse |
|----------|--------|-------------|
| Smittepress-beregning | ✅ Live | Runtime calculation, no extra storage |
| Advisory signals | ✅ Live | HIGH_LOCAL_INFECTION_PRESSURE, etc. |
| Exposure events logging | ✅ Live | All vessel-facility interactions saved |
| Lovbasert karantene | ✅ Live | PD-forskriften § 18 compliance |
| Historical data retention | ✅ Live | SQLite database with indexes |
| Basic time-series queries | ✅ Live | SQL-based retrospective analysis |

### 🔄 Fremtidige muligheter (krever utvikling)

| Funksjon | Kompleksitet | Beskrivelse |
|----------|--------------|-------------|
| Dashboard for tidsserieanalyse | Middels | Grafisk visning av ukentlig utvikling |
| Nettverksgraf-visualisering | Høy | Interactive graph showing vessel-facility connections |
| Prediktiv ML-modell for smittepress | Høy | Train model on historical data to predict outbreaks |
| Automatisk sesongrapportering | Lav | Monthly/quarterly reports on infection trends |
| Karantene-policy simulator | Middels | Test different quarantine durations (48h, 72h, 96h) |
| Export til Mattilsynet-format | Lav | CSV/Excel export for regulatory reporting |

---

## 📋 Del 5: Praktiske anbefalinger

### For driftspersonell (nå)
1. **Bruk advisory signals aktivt:**
   - `pressure_score > 70` → Be om ekstra rengjøringsdokumentasjon
   - `HIGH_LOCAL_INFECTION_PRESSURE` → Vurder å avvise ruteforespørsel
   - `REPEATED_RISK_ZONE_CONTACT` → Kontakt Mattilsynet for risikovurdering

2. **Ikke forveksle med lovbrudd:**
   - Høyt smittepress = advisory only (ikke lovbrudd)
   - Karantenebrudd = hard rule (lovlig sanksjonerbar)

### For data/utviklingsteam (neste 6 måneder)
1. **Bygg dashboard for tidsserieanalyse:**
   - Ukentlig trend-graf (infections over time)
   - Geografisk heatmap (spread visualization)
   - Top 10 vessels by pressure score

2. **Implementer nettverksanalyse:**
   - Bruk NetworkX eller Gephi
   - Visualiser båt-anlegg-forbindelser
   - Identifiser super-spreader vessels

3. **Start ML-eksperiment:**
   - Samle 6-12 måneders data
   - Feature engineering: pressure metrics + geography + season
   - Train binary classifier: Will facility get infected within 14 days?

### For forskere/epidemiologer (langsiktig)
1. **Publish peer-reviewed paper:**
   - "Infection pressure as a leading indicator for aquaculture disease outbreaks"
   - Dataset: Full year of Norwegian AIS + disease data
   - Methodology: Network analysis + predictive modeling

2. **Collaborate with Mattilsynet:**
   - Share findings on quarantine policy effectiveness
   - Propose evidence-based changes to PD-forskriften
   - Integrate into national surveillance system (NAIS)

3. **Expand to other pathogens:**
   - Currently focused on PD/ILA
   - Add ISA, sea lice, other diseases
   - Multi-pathogen risk modeling

---

## ✍️ Konklusjon

**Smittepress-systemet gjør to ting:**
1. **Nåtid:** Gir operasjonelt beslutningsgrunnlag (advisory warnings)
2. **Fremtid:** Samler data for retrospektiv analyse og ML-modellering

**Viktigste gevinst:**
- Vi kan gå tilbake i tid og **lære av historiske utbrudd**
- Vi kan **forme smittenettverk** og identifisere super-spreaders
- Vi kan **teste hypoteser** (f.eks. "funkerer 48t karantene?")
- Vi kan **predikere fremtidig smittepress** basert på observerte mønstre

**Neste steg:** Samle data i 6-12 måneder, deretter starte første retrospektive analysesyklus.

---

**Spørsmål eller tillegg?** Ta kontakt på janinge88@hotmail.com
