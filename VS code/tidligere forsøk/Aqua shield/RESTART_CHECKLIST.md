# 🚀 Restart Chat Checklist

Når du restarter chatten, start her for å få kontekst raskt:

## 📋 Essensielle Filer (Les først)

1. **[PRODUCT_STATUS.md](./PRODUCT_STATUS.md)** (5 min)
   - Hva systemet gjør
   - Kjernefunksjonalitet
   - Live endpoints
   - Status på alt

2. **[aqua-shield-0.1/README.md](./aqua-shield-0.1/README.md)** (3 min)
   - Setup instruksjoner
   - Env variabler
   - How to run locally

3. **[aqua-shield-0.1/ARCHITECTURE.md](./aqua-shield-0.1/ARCHITECTURE.md)** (5 min)
   - Systemarkitektur
   - Data flow
   - API design

## 🎯 Viktige Konstanter (Endres ofte)

**Alert Threshold:**
```javascript
// /server/utils/forecast.js
const ALERT_THRESHOLD = 50  // ← Changed from 70%
```

**Expected Data Volume:**
- 500 anlegg/uke med alerts
- 26,000 prognoser/år
- 3-4 months to collect 6000 data points

## 📦 Mappen Struktur

```
/aqua-shield-0.1
  ├─ client/              ← React frontend
  │  └─ src/
  │     ├─ App.jsx        (Router + MVP login)
  │     └─ pages/         (All dashboards)
  ├─ server/              ← Node.js backend
  │  └─ utils/            (forecast, validation, vessel-proximity)
  └─ render.yaml          (Deployment config)
```

## 🚀 Live Deployment

**URL:** aqua-shield-0.1-production.onrender.com

**Backend API:**
- GET `/api/farmer/my-facilities` - All facilities + 7-day forecast
- GET `/api/vessel/:id/nearby` - Nearby anlegg
- GET `/api/admin/validation/metrics` - Accuracy metrics

## 📱 Dashboards (What Works)

| Name | Route | Feature |
|------|-------|---------|
| FarmerDashboard | `/farmer-dashboard` | Risk overview + 7-day forecast |
| VesselDashboard | `/vessel-dashboard` | Proximity warnings |
| ValidationDashboard | `/validation-dashboard` | Model metrics |
| DashboardSelector | `/dashboard` | Role navigation |

## ✅ Most Recent Changes

**Commit: fb19876** (Today - Jan 12)
- Performance: Memoize components + useCallback

**Commit: a7db1aa** (Yesterday)
- Fix MVP login: Direct routing to role dashboards

## 💡 Key Decision: 50% Threshold

**Why lowered from 70%:**
- 70% = ~1 alert/day = 365/år (too slow for training)
- 50% = ~500 alerts/week = 26,000/år (good for 3-4 months)

**Updated in:**
- ✅ `/server/utils/forecast.js` - shouldSendAlert()
- ✅ `/server/utils/validation.js` - validateForecast()
- ✅ `/server/utils/vessel-proximity.js` - calculateMeasure()

## 🔄 Next Steps

1. Wait for farmers to test FarmerDashboard
2. Wait for boats to test VesselDashboard
3. System auto-validates predictions 24h later
4. After 3-4 weeks: Present metrics to Innovation Norge

## 🐛 Known Issues

- None currently blocking (performance optimized today)

## 📞 Quick Contact Points

**GitHub:** https://github.com/jernjan/aqua-shield-0.1

**Main Contact:** Janin (you)

---

**Last Updated:** January 12, 2026, 14:30 CET
