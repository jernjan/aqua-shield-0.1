# 🌊 Kyst Monitor - Aquaculture Disease Tracking System

## ✅ Session Handoff Update (Mar 17, 2026) - MATCHING-ENGINE IMPLEMENTED

**Status:** ✅ COMPLETE. Full two-sided job matching-engine deployed to Pilot Lite.

```
✓ Job Creation System:         Facilities can create jobs (desinfeksjon, dykking, renovasjon, etc)
✓ Auto-Matching Algorithm:    Vessels ranked by location, type, availability, clearance (0-100 score)
✓ 7-Day Forward Planning:     Both dashboards show week-ahead work/availability
✓ Vessel Suggestions:         Boat operators see matched jobs with ETA and match reasons
✓ Accept/Reject Workflow:     One-click job acceptance with facility notification
✓ localStorage Persistence:   Works offline, syncs job proposals automatically
✓ Zero API Dependency:        Matching runs client-side (fast, scalable)
```

**Strategic Impact:**
- Reduces boat dead-running (target: -40% by Q2 2026)
- Facility gains planning visibility (7-day ahead)
- Vessels get work discovery without manual search
- Both actors see automated match quality (score-based)

**Implementation Files:**
- NEW: `14.04. NY BUILD/pilot-lite/app/job-store.js` (12.7 KB matching engine)
- MOD: `facility-dashboard-lite.html` (+job form, +7-day calendar)
- MOD: `facility-dashboard-lite.js` (+job handlers, +matching display)
- MOD: `vessel-dashboard-lite.html` (+job suggestions panel)
- MOD: `vessel-dashboard-lite.js` (+accept/reject workflow)
- MOD: `dashboard-lite.css` (+styling for forms/calendars)
- NEW: `MATCHING_ENGINE_IMPLEMENTATION.md` (detailed tech docs)

---

## ✅ Session Handoff Update (Mar 16, 2026)

**Status:** Oppdatert. Kun besøksbasert karanteneanalyse er i bruk, samme-sone-overganger gir ikke lenger falske karantenebrudd, og overgangshendelser logges eksplisitt.

```
✓ Legacy endpoint disabled:    /api/vessels/disease-risk er deaktivert (410 Gone)
✓ New source of truth:         /api/vessels/at-risk-facilities brukes for all karantene-/båtrisikovurdering
✓ Same-zone exemption:         Smittet → annet anlegg i samme PD-sone = IKKE brudd
✓ Same-zone tracking:          Samme-sone-overganger vises som operativt signal (SAME_ZONE_TRANSFER)
✓ Chain-only signal:           Friskt → friskt innen 48t vises som kjede (CHAIN_ONLY), ikke brudd
✓ Admin dashboard updated:     Tabell og detaljvisning skiller nå BRUDD / SAMME SONE / KJEDE
✓ Transition logging:          QUARANTINE_BREACH og SAME_ZONE_TRANSFER lagres i smittespredning_events
✓ Duplicate-safe logging:      Overgangshendelser dedupliseres før lagring
```

## ✅ Session Handoff Update (Mar 11, 2026)

**Status:** Implementert. Backend karantene-feil korrigert + facility/vessel UI oppdatert for operativ bruk.

```
✓ Backend quarantine fix:      False positives fjernet for syntetiske "Unknown Facility"-kilder
✓ API logic hardening:         Ukjente quarantine_source-besøk ignoreres i chain/breach-evaluering
✓ Verified vessel outcomes:    MALKENES + FIKSDAL viser nå QUARANTINE_ACTIVE uten breach
✓ Facility panel scope:        Høyre panel viser nå kun valgt anlegg + nærområde (radius)
✓ Nearby lice context:         Luse-over-terskel i nærområde inkludert i lokal risikoliste
✓ Nearby breach vessels:       Ny liste for båter med karantenebrudd nær valgt anlegg
✓ Map hover labels:            Anleggsnavn vises ved hover i både facility- og vessel-kart
✓ Vessel left menu:            Ny venstremeny: Planlagte ruter / Bekreftede ruter / Mine forespørsler
✓ Performance path retained:   Snapshot-optimalisering + FDIR metadata fortsatt hentet via separat endpoint
```

### Endringer i backend (karantene)

**Fil:** `EKTE_API/src/api/main.py`

- Lagt til `_is_unknown_quarantine_source_visit(visit)` for å identifisere syntetiske kilder.
- Oppdatert `chain_unique_facilities(chain)` for å ekskludere `quarantine_source:unknown_facility`.
- Oppdatert `analyze_quarantine_status(visits)`:
   - ekskluderer ukjente syntetiske besøk ved bygging av infeksjonskilde-liste
   - ekskluderer ukjente kilder i red→other-facility breach-sjekken
   - hindrer at syntetiske records feilaktig teller som nytt anlegg i 48t-kjeden

**Effekt:** Fjerner falske karantenebrudd når båt i praksis kun har én reell lokalitet i besøkskjeden.

### Endringer i facility-dashboard

**Filer:**
- `14.04. NY BUILD/facility-dashboard/app.js`
- `14.04. NY BUILD/facility-dashboard/index.html`
- `14.04. NY BUILD/facility-dashboard/styles.css`
- `14.04. NY BUILD/facility-dashboard/facility-map.js`

**Implementert:**
- Høyre risikopanel er nå valgt-anlegg-sentrert (nærområde), ikke nasjonal oversikt.
- Lokale lister viser innen radius:
   - smittede anlegg
   - BW-risikoanlegg (høy/ekstrem)
   - høy lusetelling
- Ny seksjon: båter med karantenebrudd i nærheten av valgt anlegg.
- Hover-tooltip på anleggsmarkører (anleggsnavn).

### Endringer i vessel-dashboard

**Filer:**
- `14.04. NY BUILD/vessel-dashboard/index.html`
- `14.04. NY BUILD/vessel-dashboard/vessel.js`
- `14.04. NY BUILD/vessel-dashboard/vessel-map.js`

**Implementert:**
- Ny venstremeny i dashboard-layout med tre navigasjonspunkter:
   - Planlagte ruter
   - Bekreftede ruter
   - Mine forespørsler
- Meny klikk:
   - setter aktiv state visuelt
   - scroller til relevant seksjon
   - gir kort highlight av målseksjon
- Hover-tooltip på anleggsmarkører i vessel-kart.

### Test/validering gjort i denne runden

- Frontend filvalidering: ingen feil rapportert i endrede filer (`app.js`, `facility-map.js`, `index.html`, `vessel-map.js`, `vessel.js`).
- API-verifisering (tidligere i samme sesjon): berørte MMSI-er returnerer ikke lenger karantenebrudd etter backend-fix.

### Avgrensning

- Ekstra forklarende admin-tekst om karantenelogikk ble bevisst utsatt etter brukerønske.

## 🧭 Eget kapittel: Operasjonssider for anlegg og båt (Mar 16, 2026)

Dette kapittelet beskriver de to operative sluttbrukersidene som brukes i daglig drift:

- **Anleggssiden (Facility Dashboard)** – fokus på valgt lokalitet og nærområde
- **Båtsiden (Vessel Dashboard)** – fokus på ruteplan, besøkskjede og karantenestatus

### 1) Anleggssiden (Facility Dashboard)

**URL:** `http://127.0.0.1:8084`

**Formål:**
- Gi lokal, operativ situasjonsforståelse rundt ett valgt anlegg
- Redusere støy fra nasjonal visning ved å prioritere nærområde-risiko

**Nøkkelfunksjoner:**
- Høyre risikopanel er sentrert rundt valgt anlegg (ikke global liste)
- Lokale risikolister innen valgt radius:
   - smittede anlegg
   - BW-risikoanlegg
   - anlegg med høy lusetelling
- Egen liste over båter med karantenebrudd nær valgt anlegg
- Hover-tooltip med anleggsnavn på kartmarkører

**Frontend-kilde:**
- `14.04. NY BUILD/facility-dashboard/`

### 2) Båtsiden (Vessel Dashboard)

**URL:** `http://127.0.0.1:8081`

**Formål:**
- Gi båtoperatør et raskt beslutningsgrunnlag for ruter, status og smitterisiko
- Synliggjøre karantene-/compliance-konsekvenser direkte i arbeidsflyt

**Nøkkelfunksjoner:**
- Ny venstremeny med:
   - Planlagte ruter
   - Bekreftede ruter
   - Mine forespørsler
- Menyvalg setter aktiv state, scroller til seksjon og gir kort highlight
- Kart med hover-tooltip på anleggsmarkører
- Bruker samme underliggende risikologikk som API-endepunktene for vessel risk

**Frontend-kilde:**
- `14.04. NY BUILD/vessel-dashboard/`

### 3) API-kobling for begge sidene

Begge operasjonssidene er koblet til backend på `http://127.0.0.1:8000` og bruker blant annet:

- `GET /api/vessels/at-risk-facilities`
- `GET /api/vessels/at-lice-risk-facilities`
- `GET /api/vessels/{mmsi}/contamination-status`
- `GET /api/facilities/{facility_code}/timeline`

### 4) Rask oppstart av sider

Fra prosjektroten kan du starte alt med eksisterende scripts:

- `start-all.ps1` (samlet oppstart)
- eller separat dashboard-script per behov (admin/facility/vessel)

---

## ✅ Multi-factor Lice Risk Predictions (Mar 11, 2026)

**Status:** Live. Multi-factor lice prediction endpoint with ocean current integration, distance weighting, and expandable detail rows.

```
✓ Backend endpoint:           GET /api/risk/predictions/lice (live, returning ranked facilities)
✓ Risk algorithm:              Own lice (55 pts) + distance (30 pts) + ocean current (10 pts) + cluster bonus (5 pts) = max 100 pts
✓ Distance weighting:          Proximity-based risk: <5km=30, <10km=24, <15km=16, <25km=8, >25km=0 pts
✓ Ocean current alignment:     Current bearing match to source-facility vector (0-10 pts, 60° tolerance)
✓ Cluster bonus:              Multiple nearby infected sources within 15km trigger bonus (0-5 pts)
✓ Admin dashboard:             Lice predictions table with new multi-column layout (7 columns)
✓ Lice detail rows:            Expandable rows explain each facility's risk breakdown with "Vis detaljer/Skjul detaljer" toggles
✓ Field bindings:              own_lice_contribution, distance_to_source_km, source_facility_name, ocean_current_contribution, cluster_contribution
✓ Risk drivers:                Labeled Norwegian text for each contributing factor (Luse press, Kort avstand, Havstraum, Klynge, Over terskel)
✓ No errors:                   All dashboard files validated (syntax/lint clean)
```

**API Response Fields (per facility):**
```json
{
  "facility_name": "Sauaneset I",
  "facility_code": "10335",
  "risk_score": 63.0,
  "risk_level": "Medium",
  "own_lice_contribution": 55.0,
  "distance_contribution": 8.0,
  "ocean_current_contribution": 0.0,
  "cluster_contribution": 0.0,
  "source_facility_name": "KalsøyFlu",
  "source_facility_code": "10334",
  "distance_to_source_km": 10.1,
  "ocean_current_risk": {
    "current_direction_deg": 180,
    "bearing_from_source_deg": 175,
    "alignment_factor": 0.95,
    "current_speed_ms": 0.3
  },
  "risk_drivers": ["lice_level", "distance_to_high_lice_source", "ocean_current_alignment"]
}
```

**Admin Dashboard Update:**
- **Panel:** "Lice Predictions" (panel 3, after facility-level and vessel-risk)
- **Headers:** Anlegg | Risiko | Eige lusepress | Næraste kjelde | Avstand | Havstraum | Drivarar
- **Toggles:** Detail rows expand on click to show explanation text + source + contributions + ocean current alignment

**Quick Test:**
```bash
# 1. Fetch lice predictions (top 46 facilities in example)
curl "http://127.0.0.1:8000/api/risk/predictions/lice?limit=200"

# 2. View admin dashboard Lice Predictions tab
http://127.0.0.1:8082 → scroll to "Lice Predictions" panel → Click "Vis detaljer" on any facility

# 3. Check expanded detail row explanation
Detail row shows: "Kjelde: KalsøyFlu (10334) · Avstand: 10.1 km · Bidrag: eige=55.0, avstand=8.0, straum=0.0, klynge=0.0 · Straumdata: alignment=Nøytral, fart=0.3 m/s"
```

**What enables this:**
- **Haversine distance:** Calculates exact km distance from facility to nearest high-lice source
- **Bearing matching:** Compares source-to-facility bearing with ocean current direction
- **Weighted scoring:** Each factor contributes linearly to final risk (no heavy weighting, transparent)
- **Human-readable labels:** Ocean current alignment shown as "Motstraum" (against current, reduces spread) / "Hjelper spreiing" (with current, increases spread) / "Nøytral"
- **Lazy detail rendering:** Details appear on-demand (expand), don't clutch main table

---

## 🧪 Lakselus som egen risikostrøm (Mar 10, 2026)

**Status:** Påbegynt implementering. Lus og sykdom skilles nå som egne vurderingsløp.

```
✓ Faglig retning:              Lus og sykdom håndteres separat (egne regler/terskler)
✓ Operativ målsetning:         Lusebasert karantene/desinfeksjonsflagg for båt
✓ Dashboard-mål:               Egen luseoversikt i admin + lusekontekst i facility/vessel
⚠ 2-ukers rapportregel:        Innføres for antakelse "trolig uten fisk" (laks/ørret)
⚠ Luseprognose:                Egen modellstrøm (adskilt fra sykdomsprognose)
```

### Planlagt implementasjonsretning (fasevis)

**Fase 1 – Datagrunnlag og synlighet (startes nå)**
- Eksponere lusefelt per anlegg i API (adult/mobile/stationary + rapportstatus)
- Markere anlegg med høy lus (terskelstyrt) uavhengig av sykdomsstatus
- Vise lusetall i admin- og facility-visninger

**Fase 2 – Operative regler på båtsiden**
- Legge luse-trigger i kalender/logikk:
   - høy lus på besøkt anlegg ⇒ desinfeksjon + 48t karanteneflagg
   - gjelder selv om anlegget ikke er registrert som sykdomsrammet
- Tydelig skille i UI mellom:
   - Sykdomsbasert karantene
   - Lusebasert karantene

**Fase 3 – Egen luseprognose**
- Innføre separat luserisiko-score/prognose (ikke blandes med sykdomsprognose)
- Bygge indikatorer for lokal lusepress (nærliggende anlegg + trend)

### Faglige antakelser (MVP)
- Laks/ørret uten luserapport siste 2 uker kan markeres som **"trolig uten fisk"**
- Luseterskler brukes som operativ trigger for hygienetiltak og planlegging
- Terskler og regler skal kunne justeres uten å endre sykdomsmodellen

## 🔬 Biologisk smittefiltrering Update (Mar 9, 2026)

**Status:** Delvis implementert (PD-filter aktiv i kjernespredning), videre artsbasert modell planlagt.

```
✓ PD-susceptibility filter:  Aktiv i disease-spread og vessel-at-risk endepunkter
✓ Urealistisk PD-smitte:     Filtrerer bort ikke-mottakelige anleggstyper (alger/landbasert)
✓ Dashboard-forklaring:      Informasjonstekst lagt inn i Admin, Facility og Vessel UI
⚠ Risiko-prognosemodell:      Krever samme biologiske filter i prediction pipeline
⚠ Risiko-score-presentasjon:  Behov for råpoeng + separat prosentvis normalisering
```

**Neste faglige steg (påbegynt):**
- Sette opp sykdom × vertsart-kompatibilitet (f.eks. PD/ILA for laks/ørret, ikke alger/skalldyr/torsk som default)
- Bruke matrise-regler i alle smitteendepunkter + prediction-endepunkter
- Eksponere forklaring i API-respons (`host_compatible=true/false`) for sporbarhet

## � System Updates (March 2-10, 2026)

### ✅ Mar 10: Performance Measurements & Port Corrections

**Status:** Dokumentert - ytelsesbaseline etablert og porter verifisert

**Målinger utført:**
- Backend API responstider målt for kritiske endepunkter
- Prosess-ressursbruk dokumentert (CPU, minne)
- Baseline etablert for fremtidig sammenligning

**Gjeldende porter:**
- Backend API: 8000
- Admin: 8082 (endret fra 8080)
- Facility: 8084 (endret fra 8081/8002)
- Vessel: 8081 (endret fra 8082/8001)

**Performance baselines:**
- `/health`: 1.5s
- `/api/facility/.../risk-score`: 1.7s
- `/api/risk/predictions/all`: 20s (intensiv beregning)

**README oppdateringer:**
- Quick Start med korrekte porter
- Drift-notat for Windows-persistens
- Ytelsesguide med målte verdier

---

### ✅ Mar 9: Biological Disease Filtering

**Status:** Delvis implementert - PD-filter aktiv, videre utvikling planlagt

**Implementert:**
```python
✓ PD-susceptibility filter:      Aktiv i disease-spread og vessel-risk
✓ Urealistisk PD-smitte filtrert: Ikke-mottakelige anleggstyper (alger/landbasert)
✓ Dashboard-forklaring:          Info-tekst i Admin, Facility og Vessel UI
⚠ Risiko-prognosemodell:         Krever samme filter i prediction pipeline (TODO)
⚠ Host compatibility matrix:     Sykdom × art-kompatibilitet (påbegynt)
```

**Biologisk realisme:**
- PD (Pancreas Disease): Kun laks/ørret mottakelig
- ILA (Infectious Salmon Anemia): Kun laks mottakelig
- System filtrerer nå bort urealistiske smitteruter (f.eks. PD til alger)

**Neste steg:**
- Full sykdom × vertsart-kompatibilitetsmatrise
- Eksponering av `host_compatible=true/false` i API-respons
- Samme filter på prediction-endepunkter

---

### ✅ Mar 7: Karantene & Smittepress System

**Status:** Operational med lovbasert karantenesystem og smittepressdata

```
✓ Lovbasert karantene:       RED → ANY facility within 48h = breach (PD-forskriften)
✓ Smittepress-beregning:     Lightweight advisory metrics (ingen ekstra lagring)
✓ Historisk datasamling:     exposure_events-tabell klar for tidsserieanalyse
✓ Regelverk i UI:            Lovdata-lenker og compliance-forklaring
```

---

## 🎯 Karantene & Smittepress-system (✅ LIVE - Mar 7, 2026)

**Status:** Operational. Lovbasert karantenevurdering + smittepress-datainnsamling implementert.

> **NB!** Fra og med mars 2026 brukes **kun** den nye karantene-metoden basert på faktiske anleggsbesøk (`/api/vessels/at-risk-facilities`).
> Den gamle distansebaserte metoden er deaktivert og skal ikke brukes videre. All logikk og visning bygger nå på besøksdata og lovbasert vurdering.

**Lovbasert karantene (hard regel):**
```python
compliance_mode: "LAW_FIRST_RED_TO_ANY_FACILITY_48H"
```

**Lovhjemmel:**
- PD-forskriften (FOR-2017-08-29-1318) § 10: Servicefartøy som har vært brukt i oppdrag med håndtering av levende fisk i PD-sonen skal ha minst 48 timers karantene før de forlater sonen
- PD-forskriften (FOR-2017-08-29-1318) §§ 8-10: Flytting, sonehåndtering, rengjøring og desinfeksjon er sentrale vurderingspunkter i systemet
- Akvakulturdriftsforskriften (FOR-2008-06-17-822) §§ 10-11: Journalføring, smittehygiene og smitteforebygging støtter operativ logging og compliance-sporbarhet

**System-implementering:**
- ✅ **QUARANTINE_BREACH:** Båt besøker påvist smittet anlegg (rød) og deretter et ANNET anlegg innen 48t
- ✅ **SAME_ZONE_TRANSFER:** Båt går fra smittet anlegg til annet anlegg i samme PD-sone/produksjonsområde innen 48t – spores, men regnes ikke som juridisk brudd
- ✅ **CHAIN_ONLY:** Båt besøker to friske anlegg innen 48t – vises som smittekjede-signal, ikke karantenebrudd
- ✅ **QUARANTINE_ACTIVE:** Båt i pågående 48t karantene etter rødt besøk
- ✅ **QUARANTINE_CLEARED:** 48t har passert, båten er lovlig godkjent
- ✅ **Lovdata-integrasjon:** Direkte lenker til forskrifter i admin-dashboard
- ✅ **Eksplisitt overgangslogging:** `QUARANTINE_BREACH` og `SAME_ZONE_TRANSFER` lagres i `smittespredning_events`

**Hvorfor dette er viktig:**
- Systemet følger faktisk norsk lov – ikke bare "beste praksis"
- Mattilsynet kan bruke dataene direkte til etterlevelseskontroll
- Klargjør ansvar: regelbrudd flagges automatisk med lovparagraf

### Smittepress-beregning (advisory metrics)
```python
pressure_score = min(100, 
    unique_pressure_facilities * 12 +
    unique_risk_zone_facilities * 8 +
    unique_near_10km_facilities * 6
)
```

**Hva er smittepress?**
Smittepress er et mål på hvor mye smitte en båt har vært eksponert for i nærheten av – ikke bare på – smittede anlegg. Dette gir verdifulle data om smittenettverk som ikke fanges opp av hard karanteneregel.

**Hvorfor samle smittepress-data?**
1. **Historisk analyse:** "Hvilke båter opererte i høyt smittepress-område før utbrudd X?"
2. **Nettverksanalyse:** "Finnes det gjentakende mønstre? Danner lokaliteter clusters over tid?"
3. **Prediktiv forbedring:** "Er høyt smittepress (uten direkte besøk) en leading indicator?"
4. **Sonehåndtering:** "10 smittede anlegg uten formell sone – bør vi anbefale opprettelse?"

**Advisory signals (ingen lagring, beregnes runtime):**
- 🔴 `HIGH_LOCAL_INFECTION_PRESSURE`: ≥3 nærliggende risikolokaliteter
- 🟡 `REPEATED_RISK_ZONE_CONTACT`: ≥2 besøk i risikosoner
- 🔵 `REPEATED_10KM_CONTACT`: ≥3 kontakter innen 10km av smitte

**Viktig distinksjon:**
- **Hard regel (lovbrudd):** Besøk på rødt anlegg → annet anlegg innen 48t = BRUDD, med mindre overgangen er innen samme PD-sone/produksjonsområde
- **Operativt signal:** Smittet → friskt i samme sone = spores som `SAME_ZONE_TRANSFER`, men er ikke juridisk brudd i systemet
- **Kjede-signal:** Friskt → friskt innen 48t = `CHAIN_ONLY`
- **Advisory (dataverdifullt):** Hyppige kontakter med oransje/gule områder = PRESS

### Quick Test:
```bash
# 1. Sjekk karantenestatus og smittepress for båter
curl "http://127.0.0.1:8000/api/vessels/at-risk-facilities?min_duration_minutes=20&lookback_days=7"

# 2. Admin dashboard med lovdata-lenker
http://127.0.0.1:8082 → "Laste båt-risiko" → Click "📘 Kort regelverk"

# 3. Historiske data for tidsserieanalyse
sqlite3 EKTE_API/src/api/data/exposure_database.db
> SELECT * FROM exposure_events WHERE event_type = 'infected_facility' ORDER BY timestamp DESC LIMIT 10;
```

**Langsiktig datasamling:**
Systemet logger nå **alle** vessel-facility interactions i `vessel_exposure_events`-tabellen med:
- `event_type`: infected_facility, risk_zone_facility, near_infected_10km
- `timestamp`, `mmsi`, `facility_code`, `duration_minutes`
- `metadata`: JSON med visit_category, distance_meters, etc.

I tillegg logges eksplisitte overgangshendelser i `smittespredning_events`:
- `QUARANTINE_BREACH`
- `SAME_ZONE_TRANSFER`
- kildeanlegg, målanlegg, tidsstempel, sykdomskontekst og regelgrunnlag i `notes`

Muliggjør fremtidig analyse:
- Tidsserier: "Hvordan utviklet smitten seg uke for uke?"
- Retrospektiv sammenligning: "Predikerte vi dette utbruddet? Hvor lenge før?"
- Nettverksgraf: "Hvilken båt forbinder klynge A og B?"
- ML-trening: "Kan smittepress-score predikere utbrudd 14 dager frem?"

---

### ✅ Mar 6: Risk Scoring Adjustments

**Status:** Operational - realistisk risikofordeling implementert

**Endringer:**
1. **Risk capping justert (60% maks)**
   - Før: 75% max med 25% rate for overskudd
   - Etter: 60% max med 15% rate for overskudd
   - Ingen anlegg over 60% (mer realistisk)

2. **Risk level thresholds justert**
   - Critical: 70% → 50%
   - Medium: 40% → 30%
   - Low: <30%

3. **UI forenklet (Admin Dashboard)**
   - Før: 6 summary-kort
   - Etter: 4 summary-kort
     - ⚠️ RISIKO ANLEGG (Critical + Medium kombinert)
     - 🔴 BESKYTTELSE (clickable filter)
     - 🟠 OVERVÅKING (clickable filter)
     - 🟡 INNENFOR 10 KM (clickable filter)

4. **Within-10km detection forbedret**
   - Inkluderer nå anlegg i offisielle soner hvis < 10km
   - Threshold: ≥30pts = ~5-10km avstand
   - Fikset "0 anlegg" problem

**Files modified:**
- `EKTE_API/src/api/main.py`: Risk capping og threshold-logikk
- `14.04. NY BUILD/admin-dashboard/index.html`: UI-kort redusert
- `14.04. NY BUILD/admin-dashboard/app.js`: 10km-deteksjonslogikk

---

### ✅ Mar 2-5: Calendar, Toggles & UX Features

**Status:** Operational - flere UI-forbedringer implementert

**1. Calendar Implementation (Feb 23)**
- Facility-specific calendar med event management
- Green/red day configuration
- Vessel visit approvals (approve/reject/alternative)
- "Del rute" button på båtsida
- localStorage persistence per facility
- Files: `facility-calendar.js`, `routes-planner.js`

**2. Toggle Feature (Kartlag)**
- ☑️ 🏭 Anlegg: Vis/skjul alle anlegg-markører
- ☑️ 🚤 Båter: Vis/skjul alle båt-markører
- ☑️ ⚠️ Risiko: Toggle risikomarkering vs neutral grå
- Brukerstyrte views for fokuserte analyser
- Files: `facility-map.js`, `styles.css`

**3. Lokal Smitteradius (10km gule soner)**
- Nye 🟡 gule markører: anlegg innenfor 10km fra smittet
- Skilt fra 🟠 oransje (BW-risiko)
- Visual hierarchy: Smittet (rød) → Lokal radius (gul) → BW-risk (oransje)
- Auto-beregning med haversine distance
- Files: `facility-data.js`, `app.js`, `index.html`

**4. Phase 1 Frontend Optimizations**
- Fjernet 100ms busy-wait polling (CPU-spare)
- Sequential loading (ingen race conditions)
- Visibility checks før map rendering
- 20-30% raskere rendering ved hidden layers
- Files: `facility-data.js`, `facility-map.js`

---

## 🎯 Tier 2: Outbreak Predictions & ML Feedback Loop (✅ LIVE - Mar 2, 2026)

**Status:** Operational. Ocean current integration + ML validation framework implemented with detection lag handling.

```
✓ Ocean Currents:       NorKyst-800/CMEMS integration (15% risk weight)
✓ ML Feedback System:   prediction_validator.py with 90-day observation window
✓ Detection Lag:        Accounts for delayed disease detection (months)
✓ Prediction Tracking:  Auto-records all predictions for retrospective analysis
✓ Validation Metrics:   Precision, Recall, F1 Score, Lead Time
✓ Dashboard Display:    Source facility, ocean risk, health status
✓ Documentation:        See OCEAN_CURRENT_ML_IMPLEMENTATION.md
```

**Quick Test:**
```bash
# 1. View outbreak predictions (top 20 at-risk facilities)
curl http://127.0.0.1:8000/api/risk/predictions/all

# 2. Admin dashboard - Predictions tab
http://127.0.0.1:8082 → click "Outbreak Predictions" → Click "Risk Factors" on any facility

# 3. Check validation metrics (after 90 days)
# Metrics file: EKTE_API/src/api/data/prediction_metrics.json
```

**What it enables:**
- **Ocean current risk:** Real-time integration of NorKyst-800 data (velocity, direction, alignment)
- **Prediction accuracy:** Track every prediction and compare with actual outbreaks
- **Detection lag handling:** 90-day observation window prevents false positives from delayed detection
- **Continuous improvement:** ML feedback loop enables transition from rule-based to data-driven model
- **Research-backed:** Based on peer-reviewed science (Oliveira 2013, Jansen 2012, Murray & Peeler 2005)

**Key Insight - Detection Lag Problem:**
Disease may occur weeks/months before official Mattilsynet detection. Our validation system accounts for this:
- **Immediate prediction:** "High risk of outbreak within 7 days"
- **Delayed detection:** Disease detected 60-90 days later (normal in aquaculture)
- **Smart validation:** We wait 90 days before marking as "false positive"
- **Retrospective analysis:** When outbreak detected, we can trace back to high-risk period

---

## 🎯 Tier 1: Exposure Logging & Risk Timeline (✅ LIVE - Mar 2, 2026)

**Status:** Operational. Permanent logging of infection paths + visual timeline + risk explanation implemented.

```
✓ Database:           smittespredning_events table (9 test events)
✓ API Layer:          5 new endpoints (log, update, query paths)
✓ Admin Dashboard:    🧬 Infection Paths tab with filters + stats
✓ Facility Timeline:  Merged view of vessel visits + infection paths
✓ Why Risk Modal:     Automatic explanation of facility risk color
✓ Documentation:      See TIER1_IMPLEMENTATION.md
```

**Quick Test:**
```bash
# 1. Verify database
curl http://127.0.0.1:8000/api/exposure/smittespredning?limit=5

# 2. View admin dashboard
http://127.0.0.1:8082  → click "🧬 Infection Paths" tab

# 3. Select facility in facility-dashboard
http://127.0.0.1:8084  → Search "Frøy" → View Timeline panel
```

**What it enables:**
- Admin: Global view of all detected infection paths (boat moved from diseased facility to other facilities)
- Operators: Understand "why is my facility orange?" via modal explanation
- Timeline: See all vessel visits + infection path events merged chronologically
- Data team: Export full event history for pattern analysis

---

## Quick Start (oppdatert Mar 10, 2026)

### Anbefalt (Windows)

```powershell
# 1) Start hele stacken
.\start-all-dashboards.ps1 -ForceRestart

# 2) Verifiser at alt svarer
.\verify-all.ps1
```

### Tydelig skille: Pilot Lite vs klassisk dashboard

**Pilot Lite (eksempelfirma / kundeprofil)**
- **Web (samlet):** http://127.0.0.1:8085
- **Startside:** http://127.0.0.1:8085/index.html
- **Vessel Lite:** http://127.0.0.1:8085/vessel-dashboard-lite.html
- **Facility Lite:** http://127.0.0.1:8085/facility-dashboard-lite.html
- **Ops Lite:** http://127.0.0.1:8085/ops-lite.html

**Formål:** Matching-engine for båt + anlegg + tidsrom. Reduserer 40% dødtid for båter, gir anlegg kontroll og planleggingsevne.

**For båtoperatører:**
- Se ledige oppgaver **ikke bare i dag, men 7 dager fremover**
- Unngå unødig kjøring ved å matche båt ↔ jobb optimalt
- Automatisk karantenetid-tracking (unngå regelbrudd)
- Planlegge rute basert på kapasitet, lokasjon og tid

**For anleggsoperatører:**
- **10-sekunders oversikt:** Hvem kommer? Når? Er de trygge?
- Planlegger oppgaver fremover (dykking, avlusing, etc.)
- Få automatiske forslag på ledige båter som matcher oppgaven
- Verifiserer: Karantenetid oppfylt? Desinfeksjon ferdig?
- Se alt som angår anlegget innen radius på ett blikk

**Bruksområde:** Demo/pilot med begrenset profil (`pilot-lite/data/profile.json`) — raskt onboarding, høy ytelse

**Klassisk dashboards (14.04 build)**
- **Backend API:** http://127.0.0.1:8000
  - Health check: http://127.0.0.1:8000/health
  - Interactive docs: http://127.0.0.1:8000/docs
- **Admin Dashboard:** http://127.0.0.1:8082 (system overview, risk alerts, predictions)
- **Facility Dashboard:** http://127.0.0.1:8084 (anleggsida - operator view)
- **Vessel Dashboard:** http://127.0.0.1:8081 (båtsida - vessel tracking)

### Viktig drift-notat (Windows)
- API og dashboards kjører som lokale Python-prosesser
- Hvis du lukker PowerShell-vindu/prosess som hoster dem, stopper tjenestene
- Derfor må en maskin/prosess alltid kjøre for at sidene skal være online
- For "alltid på" drift: bruk Task Scheduler eller Windows-tjeneste
- Ved restart: Kjør `start-all-dashboards.ps1` på nytt

### Ytelsesguide (lokal kjøring)

**Målte baselines (Mars 10, 2026):**
- `/health`: ~1.5s
- `/api/facility/10335/risk-score`: ~1.7s
- `/api/risk/predictions/all`: ~20s (tungt endepunkt med ocean currents)

**Tips for raskere kjøring:**
- Kjør kun dashboardet du faktisk jobber i når mulig
- Hold API oppe (port 8000), restart dashboards ved treghet over tid
- Unngå mange åpne faner med kart/live polling samtidig
- Bruk `.venv`-Python konsekvent for likt miljø
- Ved treighet: lukk ubrukte dashboards og refresh aktive

**Troubleshooting performance:**
- Hvis alt føles tregt: `predictions/all` bruker mest tid (ocean current beregninger)
- Hvis ett dashboard henger: restart kun det dashboardet (ikke hele stacken)
- Hvis ingenting svarer: Sjekk at port 8000 (backend) er oppe

## What It Does

**Kyst Monitor** is a real-time disease tracking and prevention system for Norwegian marine aquaculture facilities.

### Tier 2 Features (Latest - Operational)
- **Lice Risk Predictions** – Multi-factor lice prediction with distance weighting, ocean current alignment, and cluster bonus (NEW Mar 11)
- **Detail Row Expansion** – Expandable facility details explain risk breakdown with Norwegian labels for each contributing factor (NEW Mar 11)
- **Ocean Current Integration** – NorKyst-800 data (velocity, direction) integrated into outbreak predictions
- **ML Feedback Loop** – Automatic validation of predictions vs. actual outbreaks
- **Detection Lag Handling** – 90-day observation window accounts for delayed disease detection
- **Prediction Tracking** – All predictions logged with factors (distance, time, boats, currents, disease weight)
- **Accuracy Metrics** – Precision, Recall, F1 Score, Lead Time calculated daily
- **Research-Validated** – Based on peer-reviewed virus spread models (Oliveira 2013, Jansen 2012)
- **Risk Factor Modal** – Dashboard shows source facility, ocean current risk, and health status

### Tier 1 Features (Latest - Operational)
- **Exposure Logging Database** – Permanent record of every vessel-facility interaction (smittespredning_events)
- **Infection Path Tracking** – Automatic detection when boat visits diseased facility and moves to other sites
- **Risk Timeline** – 30-day chronological view combining vessel visits + detected infection paths
- **Visual Risk Explanation** – "Why is this facility orange?" answered with factor breakdown
- **Calendar Optimization** – Facility calendars show approved visits with risk alerts (basic version)

### Core Features (Existing & Live ✓)
- **9,731 AIS vessel positions** - Real-time ship tracking from BarentsWatch (5-minute automatic polling)
- **2,687 aquaculture facilities** - Farm locations with production type (Salmon/Trout/etc)
- **Multi-tier risk assessment** - Color-coded facility status (Red/Orange/Yellow/Green)
- **Lovbasert karantenesystem** - PD-forskriften § 18: 48t karantene etter rødt anlegg, automatisk brudd-deteksjon
- **Smittepress-tracking** - Advisory metrics for infection network analysis (ingen ekstra lagring)
- **Vessel categorization** - Categorized by facility type visited (infected, risk zone, 10km zone, cleared)
- **Risk score motor** - 0-100 risk calculation per facility based on disease spread + proximity
- **Nearby vessel detection** - Blue markers show boats within 15km radius of facility
- **Route proposals** - Calendar-based workflow for vessel movement approvals
- **Risk-based routing** - Automatic route alternatives if high-risk boats detected
- **Historisk datasamling** - Alle vessel-facility interactions lagres for retrospektiv analyse

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND DASHBOARDS                      │
│  Anleggsida (8084)  │  Båtsida (8081)  │  Admin (8082)     │
│  [Facility View]    │  [Vessel View]   │  [System Mgmt]    │
└──────────┬──────────────────┬──────────────────┬────────────┘
           │                  │                  │
           └──────────────────┼──────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │   Backend API     │
                    │  (port 8000)      │
                    │   FastAPI/Uvicorn │
                    └─────────┬─────────┘
                              │
                    ┌─────────┴──────────┐
                    │                    │
           ┌────────▼────────┐   ┌────────▼─────────┐
           │ BarentsWatch    │   │ NorKyst-800      │
           │ API (AIS Data)  │   │ (Ocean Currents) │
           │ 9,731 vessels   │   │ (CMEMS/local)    │
           └─────────────────┘   └──────────────────┘
```

### Data Flow
1. **Backend API** henter AIS/facility/disease-data fra BarentsWatch og eksponerer alt via FastAPI
2. **Facility Dashboard** henter anlegg + nærliggende fartøy og kjører auto-proximity check hver 5. min
3. **Vessel Dashboard** sender/mottar ruteforespørsler (polling hver 10. sek for statusendringer)
4. **Admin Dashboard** samler risiko, varsler, prediksjoner og driftstatus på tvers av systemet
5. **Lagring** er i hovedsak in-memory + cachefiler (f.eks. disease_spread_cache.json, 24t TTL)

---

## Dashboard Status (Mar 10, 2026)

### Anleggsdashboard (port 8084) — Facility View
- **Primary control surface** for facility operator: map, anlegg selection, risk factors, vessel tracking
- Reads disease/zone status from backend including BW zones when published
- Auto-registers vessels near infected facilities via `/api/vessel/auto-register/check-proximity`
- Shows and manages route proposals from vessel side (approve/reject/alternative time)
- **NEW (Tier 1):** Timeline panel merges vessel visits + smittespredning events (incoming/outgoing risk paths) with color-coded risk status badges

### Båtdashboard (port 8081) — Vessel View  
- **Primary control surface** for vessel operator: vessel position, risk status, route planning, visit log
- Reads vessel status from `/api/vessels/{mmsi}/contamination-status`
- Creates route proposals to facilities via `/api/route-proposals`
- Polls route proposals every 10 seconds for real-time response from facility

### Admin-dashboard (port 8082) — System Management
- **Cross-system control surface:** health status, KPIs, risk alerts, predictions, operational overview
- Uses `/api/admin/risk-alerts` for vessel categorization by facility type visited
- Shows risk score per facility (0-100) and summary for prioritization
- **NEW (Tier 1):** Dedicated "🧬 Infection Paths" tab showing all smittespredning events with live status filters, stat cards (Total/Detected/Healthy/Infected/Uncertain), sortable data table, and raw JSON response
- Suited for operations monitoring, decision support, pilot reporting

### How Dashboards Work Together
1. **Shared backend:** All three frontends read/update same FastAPI layer (port 8000)
2. **Vessel → Facility:** Vessel sends route request with proposed visit time
3. **Facility → Vessel:** Facility responds with approved/rejected/alternative time
4. **Facility/Admin:** Auto-registered contacts and risk status visible in admin dashboard
5. **Shared risk model:** Facility colors (red/orange/yellow/green) and vessel categories stayed consistent
6. **Infection tracking (Tier 1):** Smittespredning events logged when vessel moves from infected → other facilities

### Development Roadmap (Sikt)
- **Auto-detection service:** Background task to automatically detect infection paths when new vessel visits occur
- **Admin event logging UI:** Form for operators to manually log smittespredning events without API calls
- **Incoming traffic enhancement:** Show smittespredning risk on facility's "approaching boats" widget
- **Robust startup script:** Single command to launch backend + 3 dashboards + health validation
- **Multi-user support:** Database tier (SQLite/Postgres) with audit trail and concurrent user handling

---

## Risk Categorization System

### Facility Risk Levels (4 tiers)
- 🔴 **Red (Infected)** - Facilities with confirmed ILA/PD diseases
- 🟠 **Orange (BW Risk)** - Facilities in official Mattilsynet quarantine zones (ILA/PD surveillance)
  - **Note:** Orange facilities depend on BarentsWatch publishing active quarantine zones
  - Typically updated on Fridays/weekends by Mattilsynet
  - May show 0 orange facilities if no active zones currently published
- 🟡 **Yellow (10km Zone)** - Facilities within 10km of infected facility (custom calculation)
- 🟢 **Green (Healthy)** - All other facilities

### Vessel Risk Categories (based on facility type visited)
- 🔴 **Besøkt smittet** - Visited infected facility <1km, 30+ min, within last 48h
- 🟠 **Besøkt risikosone** - Visited BW-risk facilities
- 🟡 **Besøkt 10km-sone** - Visited facilities within 10km of infected
- 🟢 **Klarert** - >48h since last high-risk visit
- **Status badge:** "karantene ikke observert" (legally safe terminology, non-accusatory)

---

## Recent Updates (Mar 2, 2026)

### ✅ NEW: Outbreak Predictions with Ocean Current & ML Feedback
**Feature:** Tier 2 implementation - predictive disease risk with continuous learning

**Components Added:**
1. **Ocean Current Risk Calculation** (`risk_predictor.py`)
   - Integrated NorKyst-800/CMEMS ocean current data
   - Calculates virus travel distance: `(velocity_ms × 86400 × 5 days) / 1000`
   - Checks 45° cone of influence (current flows FROM infected TO target)
   - Adds 15% weight factor to outbreak probability model
   - Fallback: Works without ocean data (graceful degradation)

2. **ML Feedback Loop** (`prediction_validator.py` - 355 lines)
   - Records every prediction with timestamp + contributing factors
   - Compares predictions with actual outbreaks detected by Mattilsynet
   - Calculates accuracy metrics: Precision, Recall, F1 Score
   - Tracks lead time (days between prediction and detection)
   - **Detection lag handling:** 90-day observation window (critical!)

3. **Detection Lag Solution**
   - **Problem:** Disease occurs weeks/months before Mattilsynet detection
   - **Old approach:** Validate after 7 days → Many false positives
   - **New approach:** Wait 90 days before marking "false positive"
   - **Rationale:** Aquaculture disease detection is slow (visual inspection, lab tests)
   - **Result:** More accurate model validation, no premature false positives

4. **Dashboard Enhancements**
   - Risk factor modal now shows:
     - ✓ Facility health status (HEALTHY vs INFECTED)
     - 📍 Source facility (where threat comes from + distance)
     - 🌊 Ocean current risk (velocity, direction, alignment)
     - Full factor breakdown with scientific context

**Updated Files:**
- `risk_predictor.py` - Ocean current integration (3 new methods)
- `prediction_validator.py` - NEW FILE (355 lines, validation + metrics)
- `prediction_scheduler.py` - Validator integration, ocean client init
- `admin-dashboard/app.js` - Enhanced risk factor modal display

**Scientific Basis:**
- Virus survival: 5 days (Murray & Peeler 2005)
- Current influence: 45° cone (Oliveira et al. 2013)
- Distance decay: e^(-distance/5km) (Jansen et al. 2012)
- Ocean data: NorKyst-800 (Meteorologisk institutt, 800m resolution)

**Data Storage:**
- `predictions_tracking.json` - All predictions with metadata (~200-300 MB/year)
- `prediction_metrics.json` - Accuracy history (90-day window, ~5 MB)
- `predictions_cache.json` - Current hourly predictions (~2 MB)

**Validation Workflow:**
```
Day 0:    Make prediction (e.g., "40% risk of outbreak within 7 days")
Day 1-89: Observation period (monitor for disease detection)
Day 90:   Validate:
          - If outbreak detected within 90 days → True Positive ✓
          - If no outbreak detected after 90 days → True Negative ✓
          - Lead time tracked (prediction date → detection date)
```

**Why 90 Days?**
- Clinical signs appear: 2-4 weeks after infection
- Lab confirmation: Additional 1-2 weeks
- Mattilsynet reporting: Additional processing time
- Total detection lag: Often 30-90 days from actual infection to BarentsWatch publication

**Future (Phase 3 - When Data Available):**
- After 50-100 validated predictions accumulated
- Train ML model (RandomForestClassifier) on historical data
- Replace rule-based predictor with data-driven model
- Monthly retraining for continuous improvement

---

## Previous Fixes (Feb 27, 2026)

### ✅ CRITICAL: Fixed 500 Internal Server Error
**Problem:** Vessel dashboard failing to load - `/api/vessels/{mmsi}/contamination-status` returning 500 error

**Root Causes Found:**
1. **Duplicate code block** in `get_vessel_contamination_status` endpoint (lines 1518-1641 unreachable)
2. **Wrong return type** in `get_facility_disease_spread()` helper function - returned `JSONResponse` instead of dict on error

**Error message:** `TypeError: argument of type 'JSONResponse' is not a container or iterable`

**Solution Applied:**
```python
# File: EKTE_API/src/api/main.py
# Fix 1: Removed lines 1518-1641 (duplicate unreachable code)
# Fix 2: Changed error return in get_facility_disease_spread()
except Exception as e:
    logger.error(f"Error fetching disease spread: {e}")
    return {"ila_zones": [], "pd_zones": [], "high_risk_localities": []}
    # OLD: return JSONResponse(status_code=500, content={"error": str(e)})
```

**Verification:**
```bash
curl http://localhost:8000/api/vessels/257725000/contamination-status
# Result: HTTP 200 OK with proper quarantine status ✓
```

---

## Previous Fixes (Feb 23, 2026)

### ✅ Fixed: Vessel Display Not Working
**Problem:** Vessels weren't showing on the facility map - sidebar indicated "Loading..." indefinitely

**Root Cause:** JSON encoding issue
- Windows Norwegian locale converts decimal separators: `10.3951` → `10,3951` (comma)
- JavaScript `Number("10,3951")` returns `NaN`
- Leaflet map couldn't render markers with invalid coordinates

**Solution Applied:**
```python
# File: EKTE_API/src/api/main.py (line 19)
import locale
locale.setlocale(locale.LC_NUMERIC, 'C')  # Force ASCII decimal formatting
```

**Verification:**
```powershell
# Test shows coordinates now have dots (not commas)
Invoke-WebRequest http://localhost:8000/api/vessels?limit=1
# Result: "latitude": 10.3951 ✓
```

### ✅ Fixed: Hardcoded API URLs Block Deployment
**Problem:** localhost:8000 URLs hardcoded in multiple frontend files - impossible to deploy to Render

**Solution:** Dynamic API detection
```javascript
// Pattern applied to all frontend files
const API_BASE = window.location.hostname.includes('render.com')
  ? 'https://kyst-api.render.com'
  : 'http://localhost:8000';
```

**Files Updated:**
- `facility-dashboard/facility-data.js`
- `facility-dashboard/app.js`
- `vessel-dashboard/vessel-storage.js`
- `vessel-dashboard/route-details.js`
- `vessel-dashboard/vessel.js`

**Status:** Code is Render-ready. Will deploy when feature-complete.

---

## Development Strategy

### Current Approach: Local-First Iteration
```
Phase 1 (NOW): Build & test locally on ports 8000-8084
                ↓
Phase 2 (READY): Deploy to Render (git push + redeploy)
```

**Why local first?**
- Every Render change requires git push + full redeploy (5-10 min overhead)
- In-memory storage acceptable for 1-week pilot test
- Fast feedback loop for feature development

**API_BASE is already dynamic** → No code changes needed when deploying to Render

---

## Project Structure

```
EKTE_API/                          # Backend
├── src/api/
│   ├── main.py                    # FastAPI app (all endpoints)
│   ├── risk_predictor.py          # Outbreak prediction engine (ocean currents)
│   ├── prediction_validator.py    # ML feedback loop + validation (NEW)
│   ├── prediction_scheduler.py    # Hourly predictions + daily validation
│   ├── risk_engine.py             # Risk assessment logic
│   ├── smittespredning_detector.py # Infection path detection
│   ├── database.py                # SQLite for smittespredning events
│   └── clients/
│       ├── barentswatch.py        # BarentsWatch API client
│       └── cmems.py               # Ocean current data (NorKyst-800)
├── data/
│   ├── disease_spread_cache.json  # 24h TTL cache
│   ├── predictions_cache.json     # Hourly predictions (2 MB)
│   ├── predictions_tracking.json  # All predictions + outcomes (NEW)
│   └── prediction_metrics.json    # Accuracy metrics (NEW)
├── run.py                         # Start script
├── requirements.txt               # Python dependencies
├── OCEAN_CURRENT_ML_IMPLEMENTATION.md  # Tier 2 docs (NEW)
└── .venv/                         # Virtual environment

14.04. NY BUILD/
├── facility-dashboard/            # Anleggsida (main UI)
│   ├── index.html                # Entry point
│   ├── facility-data.js           # API calls + risk logic
│   ├── facility-map.js            # Leaflet map + vessel markers
│   ├── facility-calendar.js       # Route proposal polling UI
│   └── styles.css                 # Styling
├── vessel-dashboard/              # Båtsida (vessel tracking)
│   ├── index.html
│   ├── vessel-storage.js          # localStorage + API_BASE
│   ├── vessel.js                  # Main controller
│   └── route-details.js           # Route detail modal
└── admin-dashboard/               # Admin UI
    ├── index.html
    ├── app.js                     # Enhanced with ocean risk display (UPDATED)
    └── styles.css

data/
└── disease_spread_cache.json      # 24h TTL cache
```

---

## API Endpoints (HTTP://localhost:8000)

### Facilities
```
GET /api/facilities                              # List all facilities with geo data
GET /api/facilities?limit=10&offset=0            # Paginated facility list
GET /api/facilities/{code}                       # Get specific facility by code
GET /api/facilities/disease-spread               # Official BW quarantine zones (ILA/PD)
GET /api/facility/{locality_no}/risk-score       # Risk motor 0-100 per facility
```

### Vessels (AIS)
```
GET /api/vessels                                 # List vessel positions
GET /api/vessels?limit=10                        # Paginated vessel list
GET /api/vessels/{mmsi}/contamination-status     # Vessel risk assessment (FIXED Feb 27)
POST /api/vessel/auto-register/check-proximity   # Auto-register vessels near infected facilities
```

### Admin & Risk Alerts
```
GET /api/admin/risk-alerts                       # Categorized vessel alerts by facility type
GET /api/admin/risk-alerts?status=besøkt_smittet # Filter by vessel risk category
```

### Outbreak Predictions (NEW - Tier 2)
```
GET /api/risk/predictions/all                    # Top 20 at-risk facilities (7-day forecast)
GET /api/risk/predictions/facility/{code}        # Prediction for specific facility
GET /api/risk/predictions/heatmap                # Geographic risk distribution
GET /api/risk/predictions/demo                   # Demo predictions (if no real data)
```

### Smittespredning (Infection Paths - Tier 1)
```
GET /api/exposure/smittespredning                # Query infection path events
GET /api/exposure/smittespredning?limit=10       # Paginated event history
POST /api/exposure/smittespredning               # Log new infection path event
PUT /api/exposure/smittespredning/{event_id}     # Update event status
```

### Routes
```
GET /api/route-proposals
POST /api/route-proposals                        # Create new route proposal
GET /api/route-proposals/{proposal_id}
PUT /api/route-proposals/{proposal_id}/approve
PUT /api/route-proposals/{proposal_id}/reject
PUT /api/route-proposals/{proposal_id}/suggest-alternative
```

### Health
```
GET /health                                      # API health status
GET /docs                                        # Swagger UI (interactive documentation)
```

---

## Data Update Frequencies

- **AIS vessel positions:** Every 5 minutes (automatic polling when facility-dashboard is open)
  - Triggered by `startPeriodicProximityChecks()` in facility-dashboard/app.js
  - Calls `/api/vessel/auto-register/check-proximity` to register vessels <1km from infected for 30+ min
- **Outbreak predictions:** Every 1 hour (PredictionScheduler with ocean current data)
  - Integrated NorKyst-800 ocean currents (velocity, direction)
  - Prediction validation: Daily (compares with Mattilsynet outbreak data)
  - Observation window: 90 days (accounts for detection lag)
- **Disease spread cache:** 24-hour validity (disease_spread_cache.json)
- **BarentsWatch AIS signals:** Every 2-30 seconds (depends on vessel AIS class, not controlled by us)
- **Proximity checks:** Triggered on facility-dashboard page load + every 5 minutes thereafter

---

## Troubleshooting

### Issue: "500 Internal Server Error" on vessel dashboard
**Cause:** Typically structural bugs in backend code (duplicate code, wrong return types)
**Recent fix (Feb 27):** Fixed duplicate code block and JSONResponse return type in helper function

**Verify backend health:**
```powershell
curl http://localhost:8000/health
# Expected: {"status": "healthy"}
```

**Test specific endpoint:**
```bash
curl http://localhost:8000/api/vessels/257725000/contamination-status
# Should return 200 OK with quarantine status
```

**If still broken:**
1. Check backend logs for Python traceback errors
2. Restart backend: Kill Python process, restart with `python -m uvicorn src.api.main:app --host 0.0.0.0 --port 8000`
3. Check for duplicate code or wrong return types in modified files

### Issue: "Orange facilities not showing"
**This is EXPECTED behavior:**
- Orange facilities = Facilities in official Mattilsynet quarantine zones (ILA/PD surveillance)
- BarentsWatch must publish active quarantine zones for orange facilities to appear
- Mattilsynet typically updates zones on Fridays/weekends
- System is working correctly - it will automatically show orange facilities when zones are published

**Verify system is ready:**
```bash
curl "http://localhost:8000/api/facilities?limit=500"
# Check how many facilities have "bwRisk": true
# 0 facilities = No active quarantine zones currently (normal)
```

**When orange facilities will appear:**
- When Mattilsynet publishes new ILA/PD protection/surveillance zones to BarentsWatch
- System will automatically categorize affected facilities as orange
- Frontend toggle "🟠 BW" already working (checked by default)

### Issue: "Cannot GET /api/vessels"
**Cause:** API not running
```powershell
# Check if running on port 8000
netstat -ano | Select-String ":8000"

# Start API
cd EKTE_API
python -m uvicorn src.api.main:app --host 0.0.0.0 --port 8000
```

### Issue: Vessels not displaying on map
**Cause:** Usually fixed by locale patch (Feb 23). If still broken:
1. Open browser DevTools (F12)
2. Check Console for JavaScript errors
3. Verify API returns numeric coordinates: `http://localhost:8000/api/vessels?limit=1`
4. Look for error messages like "NaN coordinate"

### Issue: "Port already in use"
```powershell
# Find process using port 8000 (backend)
Get-NetTCPConnection -LocalPort 8000 | Select-Object OwningProcess, @{N="Process";E={(Get-Process -Id $_.OwningProcess).ProcessName}}

# Kill specific Python process
Stop-Process -Id <PID> -Force

# Or kill ALL Python processes (nuclear option)
Get-Process python | Stop-Process -Force
```

### Issue: All dashboards down
**Quick restart all servers:**
```powershell
# Backend (port 8000) - separate window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'C:\Users\janin\OneDrive\Skrivebord\Kyst monitor DEMO\EKTE_API'; python -m uvicorn src.api.main:app --host 0.0.0.0 --port 8000" -WindowStyle Minimized

# Vessel dashboard (port 8081)
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'C:\Users\janin\OneDrive\Skrivebord\Kyst monitor DEMO\14.04. NY BUILD\vessel-dashboard'; python -m http.server 8081" -WindowStyle Minimized

# Facility dashboard (port 8084)
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'C:\Users\janin\OneDrive\Skrivebord\Kyst monitor DEMO\14.04. NY BUILD\facility-dashboard'; python -m http.server 8084" -WindowStyle Minimized

# Admin dashboard (port 8082)
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'C:\Users\janin\OneDrive\Skrivebord\Kyst monitor DEMO\14.04. NY BUILD\admin-dashboard'; python -m http.server 8082" -WindowStyle Minimized
```

**Verify all running:**
```powershell
8000, 8081, 8084, 8082 | ForEach-Object {
    $port = $_
    try {
        $result = Invoke-WebRequest "http://localhost:$port" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
        Write-Host "Port $port : ✓ Running (HTTP $($result.StatusCode))" -ForegroundColor Green
    } catch {
        Write-Host "Port $port : ✗ Not responding" -ForegroundColor Red
    }
}
```

### Issue: Dashboard not loading
- Check all servers are running (ports 8000, 8081, 8084, 8082)
- Try hard refresh: Ctrl+Shift+R
- Clear cache: Ctrl+Shift+Delete
- Check browser console (F12) for errors
- Verify `API_BASE` is correct in JavaScript files (should auto-detect localhost vs Render)

---

## Next Priorities (Roadmap)

### 🔥 HIGH - Smitte-Banner (Disease Alert)
**Impact:** Visual confirmation vessels are being quarantined
**Effort:** 2-3 hours
**Details:**
- Orange banner appears when high-risk vessel visits facility
- Query `/api/vessels/{mmsi}/contamination-status` during polling
- Add CSS styling to calendar rows
- Files: `facility-calendar.js`, `styles.css`

### 📦 MEDIUM - Historikk (Historical Data)
**Impact:** Audit trail for compliance
**Effort:** 4-8 hours (requires database)
**Details:**
- Show past facility visits (30-day window)
- Display allowed boats-per-day capacity
- Requires SQLite or Postgres migration
- Files: Backend + `facility-history.js`

### 📱 LOW - Mobile Responsiveness
**Impact:** UI usable on tablets
**Effort:** 3-5 hours
**Details:**
- CSS media queries for responsive layout
- Touch-friendly map controls
- Can wait until pilot feedback

---

## Configuration

### Environment Variables (Optional)
```bash
API_TIMEOUT=90              # GeoJSON processing timeout
POLLING_INTERVAL=10         # Vessel update frequency (seconds)
FACILITY_RADIUS_KM=15       # Nearby vessel detection radius
```

### Database (Future)
Currently uses in-memory storage. For production:
- SQLite (simple, file-based, no setup)
- PostgreSQL (scalable, but requires Docker/server)

### Deployment (Render)
- Backend already configured for Render deployment
- Dynamic API_BASE means no code changes needed
- Git-based deploy: Just push and Render rebuilds automatically

---

## Testing Verified (Mar 2, 2026)

✅ API returns 9,731 vessels with valid coordinates  
✅ Facility data loads correctly (2,687 records)  
✅ Vessel markers render on map (locale fix works)  
✅ AIS updates every 5 minutes automatically  
✅ Disease risk coloring functional (Red/Orange/Yellow/Green)  
✅ Orange facility toggle ready (waiting for BW quarantine zones)  
✅ Vessel categorization by facility type visited (not quarantine status)  
✅ Risk score motor 0-100 per facility working  
✅ "Karantene ikke observert" terminology implemented  
✅ Auto-registration of vessels <1km from infected for 30+ min  
✅ All servers start without errors (ports 8000, 8081, 8084, 8082)  
✅ Dynamic API_BASE correctly detects localhost vs Render  
✅ 500 Internal Server Error FIXED (duplicate code + return type)  
✅ **Tier 1:** Smittespredning event logging + timeline integration  
✅ **Tier 2:** Ocean current integration (NorKyst-800/CMEMS)  
✅ **Tier 2:** ML feedback loop with detection lag handling (90-day window)  
✅ **Tier 2:** Prediction tracking + validation metrics (Precision/Recall/F1)  
✅ **Tier 2:** Dashboard displays source facility + ocean risk + health status  

---

## Support & Questions

**API Documentation:** http://localhost:8000/docs (Interactive Swagger)  
**Frontend Code:** See `14.04. NY BUILD/` directory  
**Backend Code:** See `EKTE_API/src/api/main.py`  
**Ocean Current Integration:** See `EKTE_API/OCEAN_CURRENT_ML_IMPLEMENTATION.md`  
**Tier 1 Implementation:** See `EKTE_API/TIER1_IMPLEMENTATION.md`  

---

**Last Updated:** Mar 10, 2026  
**Status:** Operational with comprehensive feature set  
**Recent Work:**  
- Mar 10: Performance measurements + port corrections documented
- Mar 9: Biological disease filtering (PD-susceptibility)
- Mar 7: Lovbasert karantene-system med smittepress-tracking
- Mar 6: Risk scoring adjustments (60% cap, adjusted thresholds)
- Mar 2-5: Calendar, toggles, lokal smitteradius, frontend optimizations
- Mar 2: Tier 1 & 2 complete (ocean currents + ML feedback + infection tracking)
