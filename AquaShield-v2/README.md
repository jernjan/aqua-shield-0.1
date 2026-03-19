# AquaShield v2 - Clean Restart

**Varslingssystem for norsk akvakultur** – Prognoser for lakselus, sykdommer, og algeutbrudd

## 🚀 Quick Start

### Backend Setup

```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # macOS/Linux

pip install -r requirements.txt
cp .env.example .env

# Edit .env with your API keys (optional for MVP)

# Run development server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Server runs on: **http://localhost:8000**
API docs: **http://localhost:8000/docs**

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on: **http://localhost:5173**

## 📁 Project Structure

```
AquaShield-v2/
├── backend/
│   ├── app/
│   │   ├── api/routes/        # API endpoints
│   │   ├── models/            # Database models
│   │   ├── schemas/           # Request/response schemas
│   │   ├── services/          # Business logic & API integration
│   │   ├── utils/             # Utilities
│   │   ├── db/                # Database setup
│   │   ├── core/              # Config & security
│   │   └── main.py            # FastAPI app
│   ├── requirements.txt
│   ├── .env.example
│   └── .gitignore
│
├── frontend/
│   ├── src/
│   │   ├── pages/             # Page components
│   │   ├── components/        # Reusable components
│   │   ├── services/          # API calls
│   │   ├── utils/             # Helper functions
│   │   ├── styles/            # CSS files
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── public/
│
└── README.md
```

## 🔧 Features

### Backend (FastAPI)
- ✅ User authentication (JWT + bcrypt)
- ✅ SQLite database with SQLAlchemy ORM
- ✅ Clean API structure (auth, facilities, alerts)
- ✅ Risk calculation engine (0-100 scale)
- ✅ BarentsWatch API integration
- ✅ AIS (vessel tracking) integration
- ✅ CORS configured for development
- ✅ Comprehensive logging

### Frontend (React + Vite)
- ✅ Login/Register pages
- ✅ Dashboard with facilities & alerts
- ✅ Real-time alert system
- ✅ Responsive design
- ✅ API client with axios
- ✅ Token-based authentication

## 📡 API Endpoints

### Auth
- `POST /auth/register` – Register user
- `POST /auth/login` – Login user

### Facilities
- `GET /facilities` – Get all facilities
- `POST /facilities` – Add facility
- `GET /facilities/{id}` – Get facility details
- `PUT /facilities/{id}` – Update facility

### Alerts
- `GET /alerts` – Get alerts (supports ?unread_only=true)
- `GET /alerts/{id}` – Get alert
- `PUT /alerts/{id}` – Mark as read/acknowledged
- `DELETE /alerts/{id}` – Delete alert

## 🎯 Risk Model (0-100 scale)

**Facility Risk:**
- Lice count: 0-40 pts
- Diseases (ILA, PD): 0-35 pts
- Temperature (>8°C): 0-10 pts
- Nearby diseased: 0-20 pts

**Thresholds:**
- ≥60: RED (critical)
- 40-59: YELLOW (warning)
- <40: GREEN (safe)

## 🔌 External APIs

### BarentsWatch (Open Data)
- Facilities (fish farms)
- Lice counts
- Disease status
- Requires: API key + secret (optional for MVP)

### AIS (Vessel Tracking)
- Wellboat positions
- Service vessel movements
- Open data (no auth required)

## 📝 Environment Variables

Create `.env` in backend folder:

```
DATABASE_URL=sqlite:///./aquashield.db
SECRET_KEY=your-secret-key-change-in-production
BARENTSWATCH_API_KEY=your_key
BARENTSWATCH_API_SECRET=your_secret
DEBUG=True
```

## 🚀 Deployment

### Option 1: Fly.io (Recommended)
1. Install Fly CLI: `brew install flyctl` (or download)
2. Configure `fly.toml` (to be created)
3. Deploy: `flyctl deploy`

### Option 2: Railway.app
1. Connect GitHub repo
2. Set environment variables
3. Auto-deploy on push

### Option 3: Docker
Dockerfile and compose files (to be created)

## 🧪 Testing

```bash
# Backend tests (to be added)
pytest

# Frontend tests (to be added)
npm test
```

## 📚 Architecture Decisions

1. **FastAPI** – Faster, better for API-heavy projects, cleaner async support
2. **SQLAlchemy ORM** – Type-safe, easy migrations, good relationships
3. **React + Vite** – Fast dev experience, modern tooling
4. **SQLite MVP** – Simple, no server setup, easy testing
5. **Clean separation** – Services, models, schemas all organized

## ⚠️ MVP Limitations

- Auth is basic (JWT only)
- No email/SMS notifications yet
- No scheduled cron jobs yet
- SQLite (upgrade to PostgreSQL for production)
- No advanced role-based access control

## 📋 Next Steps

1. ✅ Basic project scaffolding
2. 🔲 Connect BarentsWatch API (live data)
3. 🔲 Implement scheduled tasks (risk analysis)
4. 🔲 Add email/SMS notifications
5. 🔲 Deploy to Fly.io / Railway
6. 🔲 Add comprehensive tests
7. 🔲 Database migrations (Alembic)
8. 🔲 Advanced filtering & search

## 🤝 Contact

Questions? Check the old project docs at `../aqua-shield-0.1/`

---

**Started:** January 15, 2026  
**Status:** Early MVP Setup  
**Stack:** FastAPI + React + SQLite
