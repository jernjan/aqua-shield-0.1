# ⚡ Quick Reference - After Chat Restart

Copy-paste this into Copilot Chat to get context quickly:

---

## System Status (Jan 12, 2026)

**AquaShield:** Risk forecasting + validation system for Norwegian aquaculture

**What's Live:**
- ✅ FarmerDashboard: 2686 facilities + 7-day risk forecast
- ✅ VesselDashboard: Proximity warnings within 3km
- ✅ ValidationDashboard: Model accuracy metrics
- ✅ All API endpoints working
- ✅ Performance optimized (memoized components)

**Key Metrics:**
- Alert threshold: 50% (down from 70%)
- Expected: 500 anlegg/week = 26,000 prognoser/år
- Validation: Auto-runs 24h after forecast
- Data collection goal: 6000+ validated prognoser in 3-4 months

## Last Changes

**Today (Jan 12):** Performance optimization - Memoize components + useCallback

**Code Changes:**
- `/client/src/pages/Login.jsx` - RoleButton memoization
- `/client/src/App.jsx` - useCallback on handlers, memoized MVPWrapper

**Live Deployment:** aqua-shield-0.1-production.onrender.com

## Key Files to Know

| File | Purpose |
|------|---------|
| `/server/utils/forecast.js` | 7-day forecast (ALERT_THRESHOLD = 50) |
| `/server/utils/validation.js` | Compare predictions vs BarentsWatch |
| `/server/utils/vessel-proximity.js` | Distance calculation + measures |
| `/client/src/pages/FarmerDashboard.jsx` | Farmer view (270 lines) |
| `/client/src/pages/VesselDashboard.jsx` | Vessel view (300+ lines) |
| `/client/src/pages/ValidationDashboard.jsx` | Admin metrics (277 lines) |

## API Endpoints

```
GET  /api/farmer/my-facilities         - All facilities + 7-day forecast
GET  /api/farmer/facility/:id          - Detail + message
GET  /api/vessel/:vesselId/nearby      - Nearby anlegg
GET  /api/admin/validation/metrics     - Accuracy metrics
POST /api/admin/validation/auto-validate - Run validation
```

## Critical Constants (If you need to change)

```javascript
// ALERT_THRESHOLD in forecast.js
const ALERT_THRESHOLD = 50  // Changed from 70% (Jan 12)

// Vessel distance thresholds (3km radius total)
const DISTANCE_THRESHOLDS = {
  HIGH: 1000,    // <1km = Grad 3 (Red)
  MEDIUM: 3000   // <3km = Grad 1-2 (Orange/Blue)
}
```

## Git Status

**Repository:** https://github.com/jernjan/aqua-shield-0.1

**Main branch:** Latest deployed version

**Recent commits:**
- `fb19876` - Performance: Memoize + useCallback
- `a7db1aa` - Fix MVP login routing
- Previous: Vessel Dashboard + DashboardSelector

**Current build:** 322.3 kB JS (gzip: 86.9 kB)

## Next Steps

1. Farmers test FarmerDashboard
2. Boats test VesselDashboard
3. System auto-validates predictions 24h later
4. After 3-4 weeks: Present metrics to Innovation Norge

## Known Good Practices

- Always run `npm run build` before pushing
- Deploy with: `git push origin main` (auto-triggers Render)
- Check frontend at: `/aqua-shield-0.1/client/src/App.jsx` routes
- Check API at: `/aqua-shield-0.1/server/index.js` endpoints
- Data cache at: `/aqua-shield-0.1/server/db.js`

## Quick Debug

```bash
# Check local build
cd client && npm run build

# Check bundle size
# (output shows in terminal: 322.3 kB JS)

# View git log
git log --oneline -10

# Test endpoint
curl https://aqua-shield-0.1-production.onrender.com/api/farmer/my-facilities
```

---

**Updated:** January 12, 2026, 14:35 CET  
**Maintainer:** Janin
