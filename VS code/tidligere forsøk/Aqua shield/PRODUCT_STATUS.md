# AquaShield - Produktstatus & Arkitektur (Januar 2026)

## 🎯 Hva er AquaShield?

**Rask risiko-varsling for norsk akvakultur.**

Et system som kombinerer:
- **BarentsWatch** data (2686 registrerte oppdrettsanlegg)
- **Havstrøm-modeller** (bruk bare åpen data)
- **AI-prediksjon** (7-dag risk forecast per anlegg)
- **Validering** (track prediksjoner mot reality)

**Målgruppe (Dag 1):**
1. 🌾 **Oppdrettere** (FarmerDashboard) - Daglig risiko-oversikt
2. ⛵ **Båt-operatører** (VesselDashboard) - Smittesone-advarsler
3. 📊 **Admin** (ValidationDashboard) - Modell-nøyaktighet

## 📊 Kjerne Data (Live)

### BarentsWatch Integration
- 2686 registrerte anlegg med åpne koordinater
- Lus-data: Smittesnivå per anlegg (0-100%)
- Oppdateres kontinuerlig

### Risk Engine
- **Threshold:** 50% (lowered from 70% for faster data collection)
- **Expected:** ~500 anlegg/uke med alerts = 26,000 prognoser/år
- **Validation cycle:** 24h after forecast created

### Forecast System
- **Period:** 7 dager framover per anlegg
- **Method:** Trend-based prediction (risk % per dag)
- **Output:** Risk score + actionable message

### Vessel Proximity Warnings
- **Radius:** 3 km fra anlegget
- **Distance-based measures:**
  - Grad 3 (Red): <1km + HØY risiko → Desinfeksjon
  - Grad 2 (Orange): 1-3km HØY risiko → Karantene 48h
  - Grad 1 (Blue): 1-3km MODERAT → Info only

## 🚀 Live Endpoints (Production)

```
GET  /api/farmer/my-facilities          → List all facilities + 7-day forecast
GET  /api/farmer/facility/:id           → Detail + alert message
GET  /api/vessel/:vesselId/nearby       → Nearby anlegg within 3km
GET  /api/admin/validation/metrics      → Accuracy/Precision/Recall/FPR
POST /api/admin/validation/auto-validate → Run validation on old forecasts
```

## 🎨 Frontend Pages (All Live)

| Page | Purpose | Status | Role |
|------|---------|--------|------|
| **FarmerDashboard** | Risk overview + 7-day forecast | ✅ Live | Farmers |
| **VesselDashboard** | Nearby anlegg + proximity warnings | ✅ Live | Boat operators |
| **ValidationDashboard** | Model accuracy metrics | ✅ Live | Admin |
| **DashboardSelector** | Role-based navigation menu | ✅ Live | All users |
| **Login** | MVP quick-access roles | ✅ Live | All users |

## 💾 Backend Structure

```
/server
  ├─ index.js                    (API endpoints)
  ├─ db.js                       (BarentsWatch data + forecast history)
  ├─ routes/
  │  ├─ alerts.js               (Alert endpoints)
  │  ├─ auth.js                 (MVP login)
  │  └─ user.js                 (User endpoints)
  └─ utils/
     ├─ forecast.js             (7-day prediction, 50% threshold)
     ├─ validation.js           (Track TP/FP/TN/FN vs BarentsWatch)
     ├─ vessel-proximity.js      (Haversine distance, measure calc)
     ├─ risk.js                 (Risk calculations)
     ├─ ais.js                  (AIS data parsing)
     ├─ barentswatch.js         (BarentsWatch API)
     └─ notify.js               (Email notifications - designed, not built)
```

## 🎁 Frontend Structure

```
/client/src
  ├─ App.jsx                     (Main router + MVP login)
  ├─ pages/
  │  ├─ Login.jsx              (MVP role selector)
  │  ├─ DashboardSelector.jsx  (Role-aware navigation)
  │  ├─ FarmerDashboard.jsx    (Farmer view - 270 lines)
  │  ├─ VesselDashboard.jsx    (Vessel view - 300+ lines)
  │  ├─ ValidationDashboard.jsx (Admin metrics - 277 lines)
  │  └─ [others: SelectSites, FarmerMVP, VesselMVP, AdminMVP, etc]
  └─ components/
     └─ Toast.jsx              (Notifications)
```

## 🔑 Key Achievements (This Session)

1. ✅ **Lowered alert threshold** 70% → 50%
   - Expected: 26,000 prognoser/år (was 365)
   - Goal: Collect 6000+ data points in 3-4 months

2. ✅ **Built Farmer Dashboard**
   - 2686+ facilities visible
   - 7-day forecast per facility
   - Real-time risk updates

3. ✅ **Built Vessel Dashboard**
   - Proximity warnings (3km radius)
   - Distance-based measures (Grad 1-3)
   - Actionable safety recommendations

4. ✅ **Built Validation System**
   - Tracks predictions vs reality
   - Metrics: Accuracy, Precision, Recall, FPR
   - Ready for Innovation Norge proposal

5. ✅ **Direct MVP Access**
   - Click role → immediate dashboard access
   - No password system (pragmatic for testing)

6. ✅ **Performance Optimizations**
   - Memoized React components
   - useCallback hooks on handlers
   - Reduced re-renders

## 📦 Deployment

**Platform:** Render.com

**Current Status:**
- Frontend: Live at aqua-shield-0.1-production (Vite build)
- Backend: Live Node.js server
- Database: PostgreSQL with BarentsWatch data cache
- Build time: ~1.25s
- JS bundle: 322.3 kB (gzip: 86.9 kB)

**Last Deploy:** Today (commit: fb19876)
- Change: Performance optimizations (Memoize + useCallback)

## 📈 Data Collection Phase (Next Weeks)

**Week 1-2:**
- Test with real farmers & boat operators
- Collect ~500 anlegg/week with alerts
- Monitor for false positives

**Week 3-4:**
- ~2000 validated prognoser collected
- Calculate accuracy metrics
- Present early results

**Week 8-12:**
- 6000+ validated prognoser
- Strong statistical evidence
- Ready for full Innovation Norge proposal

## ❌ Not Yet Built (Lower Priority)

- Email system (batch daily at 07:00)
- Model training UI (waits for ML engineers)
- Arbeidshistorikk (deferred - using open data only)
- Parkerings-tracking (too complex, deferred)
- Monitoring group API (future)

## 🔐 Authentication (MVP)

**No password system day-1 (pragmatic for testing):**

```
Click role button → Direct dashboard access

Roles:
- farmer/anleggsseler → FarmerDashboard
- vessel/brønnbåt → VesselDashboard
- admin → AdminMVP + ValidationDashboard
- fisher → FisherDashboard
- analytics → AnalyticsMVP
```

## 💡 Recent Code Changes

**Performance Optimizations (Today):**
- Memoized RoleButton component (Login.jsx)
- Added useCallback to all event handlers
- Memoized MVPWrapper component
- Result: Reduced re-renders on user interaction

**MVP Login Fix (Yesterday):**
- Direct routing to role-specific dashboards
- Eliminated intermediate DashboardSelector step

## 🎯 Innovation Norge Preparation

**Data needed:**
- ✅ Accuracy metrics (Precision, Recall, F1)
- ✅ False-positive rate
- ✅ Coverage (how many anlegg monitored)
- ✅ Alert response time
- ⏳ ROI calculation (cost per alert vs value)

**Timeline:**
- January: Collect ~2000 data points
- February: Collect 6000+ data points
- March: Submit proposal with strong metrics

---

**Last Updated:** January 12, 2026
**Maintainer:** GitHub Copilot
**Repository:** https://github.com/jernjan/aqua-shield-0.1
