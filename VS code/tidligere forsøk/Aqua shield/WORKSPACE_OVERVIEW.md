# 📦 Workspace Overview (Jan 12, 2026)

## 🗂️ Root Level Files

| File | Purpose | Keep? |
|------|---------|-------|
| **PRODUCT_STATUS.md** | ✅ System overview + status | **READ THIS FIRST** |
| **RESTART_CHECKLIST.md** | ✅ What to read after chat restart | **START HERE** |
| **QUICK_REFERENCE.md** | ✅ Code snippets + constants | For development |
| **FEATURE_LIST.md** | ✅ Planned features (archived) | Reference only |
| COPILOT_CHAT_PROMPT.md | Old prompt (from previous session) | Archive |
| COPILOT_PROMPT_PLAIN_TEXT.txt | Old prompt (from previous session) | Archive |
| VS code aquashield 01.txt | Old notes | Archive |
| package.json | Root package config | Keep (but not used) |
| package-lock.json | Root lockfile | Auto-generated |
| node_modules/ | Installed deps (root) | Auto-generated |

## 📂 Main Folders

### `/aqua-shield-0.1` ← **MAIN PROJECT**

This is where everything lives.

**Key files:**
- `README.md` - How to setup
- `ARCHITECTURE.md` - Technical design
- `DEPLOY.md` - How to deploy
- `QUICKSTART.md` - 5-minute reference
- `render.yaml` - Render deployment config

**Subfolders:**
- `/client` - React frontend (Vite)
- `/server` - Node.js API (Express)
- `/public` - Static assets

### `/Luse-Varsel` ← **DIFFERENT PROJECT**

This is a separate project (not maintained currently).

### `/DOKUMENTASJON` ← **NEW (Today)**

Organizational folder for documentation (optional, but helps organize).

---

## 🎯 "Start Here" Reading Order (After Chat Restart)

**5 minutes:**
1. [RESTART_CHECKLIST.md](./RESTART_CHECKLIST.md) - Get context
2. [PRODUCT_STATUS.md](./PRODUCT_STATUS.md) - Understand system

**10 minutes:**
3. [aqua-shield-0.1/README.md](./aqua-shield-0.1/README.md) - Setup guide
4. [aqua-shield-0.1/ARCHITECTURE.md](./aqua-shield-0.1/ARCHITECTURE.md) - How it works

**For coding:**
5. [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) - Constants & endpoints

---

## 🚀 Live System

**Frontend:** https://aqua-shield-0.1-production.onrender.com

**Backend API:** Same URL + `/api/...`

**GitHub:** https://github.com/jernjan/aqua-shield-0.1

---

## 📊 Current Architecture

```
┌─────────────────────────────────────────────────────────┐
│  React Frontend (Vite)                                  │
│  - FarmerDashboard   (risk overview)                    │
│  - VesselDashboard   (proximity warnings)               │
│  - ValidationDashboard (metrics)                        │
│  - DashboardSelector (navigation)                       │
│  - Login (MVP role selector)                            │
└────────────────┬────────────────────────────────────────┘
                 │ API calls
┌────────────────▼────────────────────────────────────────┐
│  Node.js Express API                                    │
│  - /api/farmer/my-facilities                            │
│  - /api/vessel/:id/nearby                               │
│  - /api/admin/validation/metrics                        │
└────────────────┬────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────┐
│  Data Layer                                             │
│  - BarentsWatch API (2686 facilities)                   │
│  - Forecast engine (50% threshold)                      │
│  - Validation system (TP/FP/TN/FN)                      │
│  - Vessel proximity (3km radius)                        │
└─────────────────────────────────────────────────────────┘
```

---

## 💾 Database

**Current:** JSON files (MVP)

**Location:** `/server/db.js` (in-memory cache of BarentsWatch data)

**Data:**
- 2686 registered aquaculture facilities
- Risk scores (0-100%)
- Forecast history
- Validation results

---

## 🔄 Deployment

**Trigger:** Push to `main` branch

**Process:** Render.com auto-deploys

**Build:** ~1.25 seconds

**Result:** aqua-shield-0.1-production.onrender.com

---

## 📈 Data Collection Status

**Goal:** 6000+ validated prognoser by March 2026

**Current rate:** ~500 facilities/week with alerts (50% threshold)

**Expected timeline:**
- Jan 12 - Jan 31: ~2000 data points
- Feb 1 - Feb 28: ~4000 total
- Mar 1 - Mar 15: 6000+ total (ready for Innovation Norge)

---

## ✅ Everything Working

- ✅ Frontend dashboards
- ✅ API endpoints
- ✅ Data validation
- ✅ Performance optimized
- ✅ Deployment automated

---

**Last Updated:** January 12, 2026, 14:40 CET  
**Status:** All systems green
