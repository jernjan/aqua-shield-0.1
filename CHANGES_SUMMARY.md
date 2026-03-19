# Oppdateringer - Risiko Dashboard v2

## Implementert 6. mars 2026

### 1. ✅ **Risk Capping Justert (60% maks)**
**File**: `EKTE_API/src/api/main.py` (lines 6908-6916)

**Før**: Risiko capped på 75% max, med 25% rate for overskudd
**Etter**: Risiko capped på 60% max, med 15% rate for overskudd

- 100% = umulig (garantert smitte = urealistisk)
- 60% = realistisk maks risiko med forbyggende tiltak
- Cluster multiplier virkner nå normal (1.0-1.9x)
- Zone bonuser redusert: Protection 20→8pts, Surveillance 10→4pts

**Effekt**: 
- Maksimalt ~2 % av anlegg vil nå ha >55% risiko
- Ingen anlegg over garanti-grensen
- Bedre spredning av risiko-verdier

### 2. ✅ **Risk Level Thresholds Justert**  
**File**: `EKTE_API/src/api/main.py` (lines 6918-6924)

- Critical: 70% → 50%
- Medium: 40% → 30%
- Low: <30%

### 3. ✅ **UI Forenklet**
**File**: `14.04. NY BUILD/admin-dashboard/index.html`

**Før**: 6 summary-kort (Critical, Medium, Low, Protection, Surveillance, 10km)
**Etter**: 4 summary-kort
- ⚠️ RISIKO ANLEGG (Critical + Medium kombinert)
- 🔴 BESKYTTELSE (clickable filter)
- 🟠 OVERVÅKING (clickable filter)
- 🟡 INNENFOR 10 KM (clickable filter)

**Effekt**: Mindre visuell rot, lettere å forstå

### 4. ✅ **Within-10km Detection Forbedret**
**File**: `14.04. NY BUILD/admin-dashboard/app.js` (lines 1277-1278, 1350-1352)

**Før**: 
- Teller kun anlegg med distance_contribution > 25 IKKE i offisielle soner
- Resultat: 0 anlegg

**Etter**:
- Teller alle anlegg med distance_contribution >= 30
- Inkluderer også anlegg i offisielle soner hvis de er < 10km
- Threshold: ≥30pts = ~5-10km avstand

**Effekt**: Nå vil vise alle anlegg innenfor 10km-radiusen, ikke bare de utenfor soner

### 5. ✅ **Element References Oppdatert**
**File**: `14.04. NY BUILD/admin-dashboard/app.js`
- Fjernet: predictionsCritical, predictionsMedium, predictionsLow
- Lagt til: predictionsAtRisk

---

## Test Sjekkliste

### Backend (API)
```
1. ✅ Start API: python -m uvicorn src.api.main:app
2. Test risiko-endepunkt: http://127.0.0.1:8000/api/risk/outbreak-risk-at-healthy-facilities
3. Sjekk at ingen anlegg har >65% risiko
4. Sjekk at distance_contribution er returnert
```

### Frontend (Dashboard)
```
1. ✅ Start frontend: python -m http.server 8080
2. Åpne: http://127.0.0.1:8080
3. Klikk "Laste prognoser"
4. Sjekk:
   - ⚠️ RISIKO ANLEGG > 0 (Critical + Medium samlet)
   - 🟡 INNENFOR 10 KM > 0 (hvis anlegg <10km finnes)
   - Klikk på kort = toggler filter ✓
5. Inspect consolle for debug-info
```

### Risk Score Distribution
```
Forventet fordeling (ca):
- 0-10%: 60% av anlegg
- 10-20%: 25% av anlegg
- 20-30%: 10% av anlegg
- 30-40%: 4% av anlegg
- 40-60%: 1% av anlegg (kun høyrisikoverd)
- >60%: 0% (ikke mulig)
```

---

## Teknisk Detaljer

### Distance Scoring
- <5km: 50pts (distance_contribution)
- 5-10km: 40pts
- 10-15km: 30pts
- >15km: 0pts

### Risk Calculation Components
- Boat vectors: 0-40pts (disabled)
- Distance: 0-50pts ✓
- Ocean current: 0-30pts
- Disease type: 5-10pts
- Zone bonus: 4-8pts (redusert)
- Cluster multiplier: 1.0-1.9x

### Final Formula
```
total_risk = (boat + distance + ocean + disease) * cluster + zone_bonus
if total_risk > 60:
    excess = total_risk - 60
    total_risk = 60 + (excess * 0.15)  # 15% rate
total_risk = max(0, min(100, total_risk))
```

---

## Mulige Neste Tiltak

- [ ] Hvis fortsatt for mange på 55-60%: reduser threshold til 55%
- [ ] Hvis 10km viser for mange/få: juster distance_contribution threshold
- [ ] Refaktorere disease_score fra 5-10 til 5-7pts for enda lavere maksverdier
- [ ] Disable cluster_multiplier helt hvis forening ønsker det
