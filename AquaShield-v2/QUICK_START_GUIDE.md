# 🚀 QUICK START - AquaShield Predictive Risk Model

## System Running ✅

Both servers are active:
- **Backend API:** http://localhost:8000 (FastAPI + Real BarentsWatch data)
- **Frontend Dashboard:** http://localhost:5173 (React with Vite)
- **API Docs:** http://localhost:8000/docs (Swagger)

---

## Login
```
User: Anlegg (Fish Farm Operator)
Password: password123
```

---

## What You'll See

### 1. Dashboard Header
🌊 AquaShield - Prediktiv Risiko Varsling
- Real-time data from BarentsWatch API
- Predictive model calculating infection risks

### 2. Information Banner
> "Modellen varsler anlegg som står i fare for å bli smittet fra andre anlegg og båter"
> ("Model alerts farms at risk of infection from other farms and boats")

### 3. Facility Cards (Left Panel)
Shows all facilities with predictive risk scores:
- 🟢 **GREEN (0-39 pts):** Safe, normal monitoring
- 🟡 **YELLOW (40-69 pts):** Moderate risk, prepare precautions
- 🔴 **RED (70+ pts):** High risk, immediate action needed

**Each card shows:**
- Risk score and level
- Current lice count (informational)
- Temperature (affects virus spread speed)
- Risk factors that contributed to the score

### 4. Alert Cards (Right Panel)
Automatic alerts generated from high-risk facilities:
- Shows WHY the facility is at risk
- Lists all contributing factors
- Timestamp and "Mark as read" option

---

## Understanding Risk Factors

### ⚠️ Upstream Infection Source
```
"Upstream infection from Anlegg A at 8.5km (28pts)"
= Ocean currents carrying virus from infected farm
```

### ⚠️ Wellboat from Infected Area
```
"Wellboat from infected area: Båt X (12pts)"
= Boat recently visited a farm with disease
```

### ⚠️ Disease Transmission Risk
```
"Disease transmission risk: ISA from Anlegg D (14pts)"
= Nearby farm has genetic disease that could spread
```

### ⚠️ Favorable Infection Conditions
```
"Favorable infection conditions: 12.1°C (5pts)"
= Water temperature is optimal for lice reproduction
```

---

## How It Works

### OLD System (❌ Removed)
- "Farm X has 320 lice" ← Farm already knows this
- "Farm Y has disease" ← Farm already knows this

### NEW System (✅ Active)
- "Farm B is at 45-point risk from upstream infection" ← Can prevent it
- "Farm C threatened by boat from infected area" ← Can refuse/test boat
- "Farm D genetically vulnerable to ISA" ← Can test/vaccinate
- "Farm E has optimal temperature for infection" ← Can cool water

---

## API Response Example

```json
GET /api/facilities

[
  {
    "id": 1,
    "name": "Anlegg Nord",
    "latitude": 70.82,
    "longitude": 28.25,
    "lice_count": 0,
    "temperature": 12.1,
    "diseases": [],
    "risk_score": 45,
    "risk_level": "yellow",
    "risk_factors": [
      "⚠️ Upstream infection from Anlegg Vest at 8.5km (28pts)",
      "⚠️ Wellboat from infected area: Båt X (12pts)",
      "⚠️ Favorable infection conditions: 12.1°C (5pts)"
    ],
    "prediction_type": "external_infection_risk",
    "data_source": "BarentsWatch API"
  }
]
```

---

## Key Points

✅ **Real Data:** All data from actual BarentsWatch API
✅ **No Mock:** No simulated/fake data in production
✅ **Predictive:** Calculates risks, doesn't just report status
✅ **Actionable:** Each alert tells you WHY and what to do
✅ **Professional:** Ready for industry use

---

## Refresh Data
Click the "Oppdater" (Update) button in the header to:
- Fetch latest data from BarentsWatch API
- Recalculate all risk scores
- Update alerts

---

## How the Model Predicts

### Scenario Example
```
1. Anlegg A has 320 luse (known issue)
2. Ocean current flows NE from A toward B
3. Anlegg B is 8km downwind
4. Båt X recently visited A, now at B
5. Temperature at B is 12°C (optimal for lice)

RESULT:
Anlegg B = 45 points RISK (yellow alert)
├─ Upstream infection (28pts)
├─ Wellboat vector (12pts)
└─ Optimal conditions (5pts)

PREDICTION: B will likely get infected in 5-7 days
ACTION: Biosecurity protocols, consider treatment options
```

---

## Questions?

The model implements this principle:
> **"Alert us to threats we can PREVENT, not threats we already know about"**

---

*AquaShield - Prediktiv varsling for akvakultur* 🌊
