# AquaShield - Aquaculture Monitoring System

> Comprehensive monitoring and risk assessment system for Norwegian aquaculture farms

**Live Demo:**
- API: https://aqua-shield-api.onrender.com
- Frontend: https://kyst-monitor.onrender.com
- API Docs: https://aqua-shield-api.onrender.com/docs

---

## 📑 Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Architecture](#architecture)
4. [Installation](#installation)
5. [Environment Setup](#environment-setup)
6. [Running Locally](#running-locally)
7. [API Documentation](#api-documentation)
8. [Authentication](#authentication)
9. [Database](#database)
10. [Deployment](#deployment)
11. [Project Structure](#project-structure)

---

## 🎯 Overview

AquaShield is a monitoring system designed to:
- Track aquaculture farm locations and status
- Monitor nearby vessel activity via AIS data (BarentsWatch API)
- Assess disease risk and biosecurity alerts
- Provide real-time dashboard for farm managers
- Integration with BarentsWatch for Norwegian coastal data

**Technologies:**
- FastAPI (Python backend)
- React + TypeScript (Frontend)
- SQLAlchemy ORM
- SQLite/PostgreSQL
- JWT Authentication

---

## ✨ Features

### Backend API
- ✅ RESTful API with OpenAPI documentation (`/docs`)
- ✅ JWT-based authentication
- ✅ Farm management (CRUD operations)
- ✅ Vessel tracking from BarentsWatch AIS API
- ✅ Disease risk assessment
- ✅ Alert system
- ✅ Dashboard analytics
- ✅ Data synchronization endpoints

### Frontend
- ✅ React dashboard
- ✅ Login/authentication
- ✅ Farm monitoring view
- ✅ Vessel tracking visualization
- ✅ Risk assessment display
- ✅ Alert management

### Data Integration
- ✅ BarentsWatch OAuth2 integration
- ✅ Live AIS vessel data
- ✅ Disease zone tracking
- ✅ Risk propagation analysis

---

## 🏗️ Architecture

```
aqua-shield/
├── backend/              # FastAPI application
│   ├── app/
│   │   ├── main.py              # Application entry point
│   │   ├── core/
│   │   │   ├── config.py        # Configuration management
│   │   │   └── security.py      # JWT & auth utilities
│   │   ├── db/
│   │   │   ├── database.py      # Database connection
│   │   │   ├── models.py        # SQLAlchemy models (farms, alerts, etc)
│   │   │   ├── models_vessel.py # Vessel-related models
│   │   │   └── models_disease.py# Disease-related models
│   │   ├── api/
│   │   │   ├── auth.py          # Login/registration endpoints
│   │   │   ├── farms.py         # Farm management
│   │   │   ├── vessels.py       # Vessel data
│   │   │   ├── disease.py       # Disease zones
│   │   │   ├── sync.py          # Data sync endpoints
│   │   │   ├── risk.py          # Risk assessment
│   │   │   ├── alerts.py        # Alert management
│   │   │   ├── dashboard.py     # Dashboard data
│   │   │   └── research.py      # Research/ML endpoints
│   │   ├── services/
│   │   │   ├── barentswatch_service.py  # BarentsWatch API integration
│   │   │   ├── risk_assessment_service.py
│   │   │   └── alert_service.py
│   │   └── logging/
│   │       └── logger.py        # Logging configuration
│   ├── requirements.txt         # Python dependencies
│   └── venv/                    # Virtual environment
│
├── frontend/            # React application
│   ├── src/
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx     # **IMPORTANT: Login page**
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── FarmsPage.tsx
│   │   │   └── AlertsPage.tsx
│   │   ├── components/
│   │   ├── services/
│   │   │   └── api.ts           # API client (includes auth headers)
│   │   ├── types/
│   │   └── App.tsx
│   ├── package.json
│   └── vite.config.ts
│
└── README.md            # This file
```

---

## 🚀 Installation

### Prerequisites
- Python 3.9+
- Node.js 16+
- npm or yarn
- Git

### Backend Setup

```bash
# Navigate to backend
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env file (see Environment Setup section)
```

### Frontend Setup

```bash
# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Create .env file (see Environment Setup section)
```

---

## 🔑 Environment Setup

### Backend `.backend/.env`

```env
# Database
DATABASE_URL=sqlite:///./aquashield.db
# For production: DATABASE_URL=postgresql://user:password@host/dbname

# JWT Configuration
SECRET_KEY=your-super-secret-key-change-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# BarentsWatch OAuth2
BARENTZWATCH_CLIENT_ID=your_client_id
BARENTZWATCH_CLIENT_SECRET=your_client_secret
BARENTZWATCH_TOKEN_URL=https://id.barentswatch.no/connect/token
BARENTZWATCH_API_BASE_URL=https://www.barentswatch.no/bwapi/v1

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173,http://localhost:5174

# Logging
LOG_LEVEL=INFO
LOG_FILE=logs/aquashield.log

# Environment
ENVIRONMENT=development
ENABLE_SCHEDULED_TASKS=false
```

### Frontend `frontend/.env`

```env
VITE_API_URL=http://localhost:8000
VITE_API_TIMEOUT=30000
```

### For Render Deployment

**Backend Environment Variables** (on Render):
```
DATABASE_URL=postgresql://[user]:[password]@[host]/[database]
SECRET_KEY=[generate-strong-key]
ENVIRONMENT=production
BARENTZWATCH_CLIENT_ID=[your-id]
BARENTZWATCH_CLIENT_SECRET=[your-secret]
```

---

## 🏃 Running Locally

### Terminal 1: Backend

```bash
cd backend
venv\Scripts\activate  # Windows
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

✅ Backend running at: `http://127.0.0.1:8000`
✅ API Docs at: `http://127.0.0.1:8000/docs`

### Terminal 2: Frontend

```bash
cd frontend
npm run dev
```

✅ Frontend running at: `http://localhost:5173`

---

## 📚 API Documentation

### OpenAPI / Swagger

The API is fully documented with Swagger UI:
- **Local**: http://127.0.0.1:8000/docs
- **Production**: https://aqua-shield-api.onrender.com/docs

### Key Endpoints

#### Authentication
```
POST   /api/auth/login           # Login with username/password
POST   /api/auth/register        # Register new user
POST   /api/auth/refresh         # Refresh JWT token
GET    /api/auth/me              # Get current user info
```

#### Farms
```
GET    /api/farms                # List all farms
POST   /api/farms                # Create new farm
GET    /api/farms/{id}           # Get farm details
PUT    /api/farms/{id}           # Update farm
DELETE /api/farms/{id}           # Delete farm
```

#### Vessels (AIS Data)
```
GET    /api/vessels              # List tracked vessels
GET    /api/vessels/{mmsi}       # Get vessel details
POST   /api/vessels              # Add vessel
```

#### Sync & Integration
```
POST   /api/sync/farms-from-barentswatch          # Sync farms
POST   /api/sync/vessels-from-barentswatch        # Sync AIS vessels
GET    /api/sync/status                          # Check sync status
```

#### Disease & Risk
```
GET    /api/disease/zones        # Get infection zones
GET    /api/risk/assessment/{farm_id}  # Risk assessment
POST   /api/alerts               # Create alert
GET    /api/alerts               # List alerts
```

#### Dashboard
```
GET    /api/dashboard/summary    # Dashboard overview
GET    /api/dashboard/analytics  # Analytics data
```

---

## 🔐 Authentication

### Login Flow

1. **User submits credentials** (username + password)
   ```
   POST /api/auth/login
   {
     "username": "user@example.com",
     "password": "password123"
   }
   ```

2. **API returns JWT token**
   ```json
   {
     "access_token": "eyJhbGc...",
     "token_type": "bearer",
     "expires_in": 1800
   }
   ```

3. **Frontend stores token** in localStorage/sessionStorage

4. **All subsequent requests** include Authorization header:
   ```
   Authorization: Bearer eyJhbGc...
   ```

### Example API Request with Auth

```typescript
// Frontend service/api.ts
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

// Add auth token to all requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Login
const login = async (username: string, password: string) => {
  const response = await api.post('/api/auth/login', {
    username,
    password,
  });
  localStorage.setItem('token', response.data.access_token);
  return response.data;
};
```

### Token Refresh

Tokens expire after `ACCESS_TOKEN_EXPIRE_MINUTES` (default: 30 min).

Refresh endpoint:
```
POST /api/auth/refresh
Headers: Authorization: Bearer [token]
```

Frontend should:
1. Detect 401 response
2. Call refresh endpoint
3. Store new token
4. Retry original request

---

## 💾 Database

### Models

**Core Models:**
- `User` - Authentication & user management
- `Farm` - Aquaculture farm locations
- `Vessel` - AIS vessel tracking
- `Alert` - System alerts

**Disease Models:**
- `DiseaseOccurrence` - Confirmed disease cases
- `InfectionZone` - Affected regions
- `RiskPropagation` - Predicted spread
- `VesselDiseaseExposure` - Vessel exposure risk

**Assessment Models:**
- `RiskAssessment` - Farm-level risk scores
- `ModelPrediction` - ML predictions
- `MLTrainingData` - Training dataset

### Database Setup

**Development (SQLite):**
```python
# Automatic - creates aquashield.db on first run
```

**Production (PostgreSQL):**
```bash
# Set DATABASE_URL in .env
DATABASE_URL=postgresql://user:password@host/aquashield

# Run migrations (when applicable)
alembic upgrade head
```

---

## 🚀 Deployment

### Render.com Setup

#### Backend Deployment

1. **Create Web Service on Render**
   - Connect GitHub repo
   - Environment: Python 3.10+
   - Build command: `pip install -r requirements.txt`
   - Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

2. **Add PostgreSQL Database**
   - Create PostgreSQL instance
   - Copy connection string
   - Add to environment variables

3. **Set Environment Variables**
   ```
   DATABASE_URL=postgresql://...
   SECRET_KEY=your-secret-key
   ENVIRONMENT=production
   BARENTZWATCH_CLIENT_ID=...
   BARENTZWATCH_CLIENT_SECRET=...
   ```

#### Frontend Deployment

1. **Create Static Site on Render**
   - Connect GitHub repo
   - Build command: `npm install && npm run build`
   - Publish directory: `dist`

2. **Configure API URL**
   - Add environment variable:
     ```
     VITE_API_URL=https://aqua-shield-api.onrender.com
     ```

3. **CORS Configuration**
   - Backend `.env`:
     ```
     ALLOWED_ORIGINS=https://kyst-monitor.onrender.com,https://aqua-shield-api.onrender.com
     ```

### GitHub Integration

1. Push code to GitHub
2. Render auto-deploys on push
3. Logs available in Render dashboard

---

## 🗂️ Project Structure Details

### Backend Request Flow

```
Request
  ↓
CORS Middleware (FastAPI)
  ↓
Authentication (auth.py)
  ↓
API Router (e.g., farms.py)
  ↓
Service Layer (e.g., risk_assessment_service.py)
  ↓
Database Models (models.py)
  ↓
SQLAlchemy Query
  ↓
Response (JSON)
```

### Frontend Data Flow

```
User Action
  ↓
React Component
  ↓
API Service Call (with JWT token)
  ↓
Backend API
  ↓
Response
  ↓
State Management (useState/Context)
  ↓
Component Re-render
```

---

## 📊 Key Features Implementation

### 1. Authentication System
- JWT tokens with expiration
- Secure password hashing (bcrypt)
- Token refresh mechanism
- Protected endpoints

### 2. BarentsWatch Integration
- OAuth2 authentication
- Live AIS vessel data
- Farm location data
- Disease zone information

### 3. Risk Assessment
- Multi-factor risk calculation
- Vessel proximity analysis
- Disease zone proximity
- Historical trend analysis

### 4. Real-time Alerts
- Risk threshold monitoring
- Vessel proximity alerts
- Disease outbreak alerts
- Notification system

---

## 🐛 Common Issues & Solutions

### Backend Won't Start
```bash
# Check if port 8000 is in use
netstat -ano | findstr :8000

# Kill process or use different port
python -m uvicorn app.main:app --port 8001
```

### Database Errors
```bash
# Reset database (development only)
rm aquashield.db

# Restart backend to recreate
```

### CORS Errors
```
# Check ALLOWED_ORIGINS in .env matches frontend URL
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
```

### Token Expired
```
# Frontend should catch 401 and refresh token
# Check token refresh endpoint works
```

---

## 📝 Development Checklist

- [ ] Login page created and working
- [ ] JWT token generation & validation
- [ ] API authentication on all protected endpoints
- [ ] Frontend stores & sends token in headers
- [ ] Dashboard displays after login
- [ ] Farm data sync from BarentsWatch
- [ ] Vessel tracking updates
- [ ] Alert system functioning
- [ ] Risk assessment calculating correctly
- [ ] Tests written for critical paths
- [ ] API documentation complete (`/docs`)
- [ ] Environment variables configured
- [ ] Database migrations tested
- [ ] Error handling comprehensive
- [ ] Logging configured
- [ ] Deployed to Render successfully
- [ ] CORS configured correctly
- [ ] Performance optimized (indexes on DB, caching)

---

## 🔗 Useful Links

- **FastAPI Docs**: https://fastapi.tiangolo.com
- **React Docs**: https://react.dev
- **BarentsWatch API**: https://www.barentswatch.no/api
- **Render Docs**: https://render.com/docs
- **SQLAlchemy**: https://www.sqlalchemy.org/

---

## 📞 Support

For issues or questions:
1. Check API docs at `/docs`
2. Review environment variables
3. Check application logs
4. Verify database connection
5. Test endpoints with Postman/curl

---

## 📄 License

Confidential - AquaShield Project

---

## ✅ Last Updated

January 16, 2026

**Version**: 1.1  
**Status**: Development + Render Deployment Ready
