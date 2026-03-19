# AquaShield - Coastal Aquaculture Monitoring

**Status**: Early development. Backend API partially working. Frontend starting fresh.

---

## 🎯 What We're Building

A real-time monitoring system for salmon farms in Norwegian coastal waters.

**The Vision:**
- Monitor fish farms with live AIS vessel data
- Track disease spread + risk assessment
- Alert system for health threats
- Dashboard with real-time data visualization

**Current Focus:**
1. ✅ Backend API (FastAPI) - partially working
2. ⚠️ Frontend (React) - needs rebuild
3. ⚠️ BarentsWatch integration - syncs but needs testing
4. ⚠️ Database models - schema ready
5. ❌ Authentication - currently disabled for dev (we want it simple)

---

## 🚀 Quick Start (Development)

### Prerequisites
- Python 3.9+
- Node.js 16+
- Git

### 1. Backend Setup

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate

# Mac/Linux
source venv/bin/activate

pip install -r requirements.txt
```

### 2. Set Environment Variables

Create `.env` in `backend/` folder:

```env
# Database (dev uses SQLite)
DATABASE_URL=sqlite:///./aquashield.db

# BarentsWatch API (get from: https://www.barentswatch.no/)
BARENTSWATCH_CLIENT_ID=your_client_id_here
BARENTSWATCH_CLIENT_SECRET=your_client_secret_here

# JWT Secret (can be anything for dev)
JWT_SECRET_KEY=super-secret-key-change-in-production

# Dev Mode (skips login)
ENVIRONMENT=development
SKIP_AUTH_FOR_DEVELOPMENT=true
ENABLE_SCHEDULED_TASKS=false
```

### 3. Run Backend

```bash
cd backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

**Expected output:**
```
INFO:     Uvicorn running on http://127.0.0.1:8000
INFO:     Application startup complete
```

Visit: http://127.0.0.1:8000/docs (Swagger UI - all endpoints)

### 4. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Visit: http://localhost:5173

---

## 📡 API Endpoints (No Auth Required in Dev)

### Test Endpoints

```bash
# Get all vessels
curl http://127.0.0.1:8000/api/vessels/

# Get farms
curl http://127.0.0.1:8000/api/farms/

# Get disease zones
curl http://127.0.0.1:8000/api/disease/zones

# Sync vessels from BarentsWatch
curl -X POST http://127.0.0.1:8000/api/sync/vessels-from-barentswatch

# Get risk assessments
curl http://127.0.0.1:8000/api/risk-assessment/

# Get alerts
curl http://127.0.0.1:8000/api/alerts/
```

### Using PowerShell

```powershell
# Get vessels
Invoke-WebRequest -Uri "http://127.0.0.1:8000/api/vessels/" | ConvertFrom-Json

# Sync vessels from BarentsWatch
$result = Invoke-WebRequest -Uri "http://127.0.0.1:8000/api/sync/vessels-from-barentswatch" -Method POST
$result.Content | ConvertFrom-Json | ConvertTo-Json -Depth 5
```

---

## 📁 Project Structure

```
.
├── backend/
│   ├── app/
│   │   ├── main.py                 # FastAPI app entry
│   │   ├── core/
│   │   │   └── config.py           # Environment config
│   │   ├── models/
│   │   │   ├── farm.py
│   │   │   ├── vessel.py
│   │   │   ├── disease.py
│   │   │   ├── risk.py
│   │   │   └── user.py
│   │   ├── api/                    # API routes
│   │   │   ├── farms.py
│   │   │   ├── vessels.py
│   │   │   ├── disease.py
│   │   │   ├── risk.py
│   │   │   ├── alerts.py
│   │   │   ├── sync.py             # BarentsWatch sync
│   │   │   └── auth.py
│   │   └── services/
│   │       ├── barentswatch_service.py   # OAuth + API calls
│   │       ├── risk_assessment_service.py
│   │       └── alert_service.py
│   ├── requirements.txt
│   ├── .env                        # Environment variables (create this!)
│   └── venv/
│
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx       # (to build)
│   │   │   ├── DashboardPage.tsx   # (to build)
│   │   │   └── FarmsPage.tsx       # (to build)
│   │   ├── components/             # (to build)
│   │   └── App.tsx
│   ├── package.json
│   └── venv (if using Python)
│
└── README.md
```

---

## 🔧 Key Technologies

| Layer | Tech | Purpose |
|-------|------|---------|
| Backend | FastAPI | REST API |
| Database | SQLAlchemy + SQLite (dev) | ORM + Data persistence |
| Frontend | React + TypeScript | Web UI |
| Build | Vite | Frontend bundler |
| API Source | BarentsWatch | Live AIS vessel data |

---

## 🚨 Known Issues

1. **Backend shuts down after ~12 seconds**
   - Status: Unresolved
   - Workaround: Restart server, still works for testing
   - Investigation needed: Scheduler/lifespan issue

2. **Frontend hasn't been built yet**
   - Pages need implementation
   - Login bypassed in dev mode
   - Components need to integrate with API

3. **BarentsWatch API**
   - Sometimes returns different JSON format
   - Parser handles both GeoJSON and flat JSON now

---

## 📊 Database Schema

### Tables Created Automatically

- **farms** - Aquaculture farm locations
- **vessels** - Ships/boats (from AIS data)
- **users** - System users
- **disease_occurrence** - Fish disease events
- **infection_zones** - Geographic disease spread areas
- **risk_assessments** - Health risk calculations
- **alerts** - System notifications

---

## 🧪 What Works Now (Tested ✅)

- ✅ Backend app imports without errors
- ✅ Database models initialize
- ✅ BarentsWatch OAuth token acquisition
- ✅ Vessel data syncs to database
- ✅ API endpoints return data
- ✅ CORS configured for frontend

---

## ❌ What Needs Work

- ⚠️ Backend stability (12-second shutdown issue)
- ❌ Frontend UI completely
- ❌ Login system (disabled for now, will add later)
- ❌ Real-time WebSocket updates
- ❌ Risk assessment algorithm
- ❌ Alert notifications

---

## 🎓 How to Test

### 1. Start Backend
```bash
cd backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

### 2. In Another Terminal - Test Sync
```bash
cd backend
curl -X POST http://127.0.0.1:8000/api/sync/vessels-from-barentswatch
```

### 3. Check Results
```bash
curl http://127.0.0.1:8000/api/vessels/ | python -m json.tool
```

### 4. Start Frontend
```bash
cd frontend
npm run dev
```

---

## 🌍 Deployment (When Ready)

### Backend → Render.com

```bash
# 1. Push to GitHub
git push origin main

# 2. Create new Web Service on Render
#    - Connect GitHub repo
#    - Set Start Command: gunicorn app.main:app
#    - Set Environment:
#      DATABASE_URL=postgresql://...
#      BARENTSWATCH_CLIENT_ID=...
#      BARENTSWATCH_CLIENT_SECRET=...
#      JWT_SECRET_KEY=... (CHANGE THIS!)
#      ENVIRONMENT=production
#      SKIP_AUTH_FOR_DEVELOPMENT=false
```

### Frontend → Render (Static Site)

```bash
# 1. Build
npm run build

# 2. Create Static Site on Render
#    - Connect GitHub
#    - Build Command: npm run build
#    - Publish Directory: dist
```

---

## 📝 Next Steps (Priority Order)

1. **Fix backend stability** → Investigate 12-second shutdown
2. **Build login page** → Simple form + JWT tokens
3. **Build dashboard** → Display farm data + vessels
4. **Add charts** → Recharts for visualizations
5. **Implement alerts** → Toast notifications
6. **Test full flow** → Login → View data → Sync
7. **Deploy to Render** → Production setup

---

## 🔐 Authentication (For Later)

When we add login back:

```
POST /api/auth/login
{
  "username": "farmer@example.com",
  "password": "password123"
}

Response:
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "token_type": "bearer"
}
```

Then use token in requests:
```bash
curl -H "Authorization: Bearer <token>" http://127.0.0.1:8000/api/farms/
```

---

## 🤝 Contributing

When building new features:

1. Create feature branch: `git checkout -b feature/my-feature`
2. Make changes
3. Test: `npm run dev` + manually test endpoints
4. Commit: `git commit -m "Add my feature"`
5. Push: `git push origin feature/my-feature`
6. Create Pull Request

---

## ❓ Troubleshooting

### Backend won't start
```bash
# Check if port is in use
netstat -ano | findstr :8000

# Kill process if needed
taskkill /PID <PID> /F

# Try again
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

### Database errors
```bash
# Delete old database
rm aquashield.db

# Restart backend - new DB created automatically
```

### BarentsWatch not working
- Check `.env` has correct CLIENT_ID and SECRET
- Verify credentials at https://www.barentswatch.no/

### Frontend can't reach API
- Ensure backend is running on port 8000
- Check CORS is enabled in `app/main.py`
- Check browser console for errors

---

## 📚 Resources

- **FastAPI Docs**: https://fastapi.tiangolo.com/
- **React Docs**: https://react.dev/
- **BarentsWatch API**: https://www.barentswatch.no/
- **Render.com Docs**: https://render.com/docs
- **SQLAlchemy**: https://docs.sqlalchemy.org/

---

**Last Updated**: January 2026  
**Next Milestone**: Stable API + Working Frontend
