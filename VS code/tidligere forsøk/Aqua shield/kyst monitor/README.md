# AquaShield - Aquaculture Monitoring System

A modern full-stack web application for monitoring aquaculture farms with real-time risk assessment, alert management, and data integration from external sources like BarentsWatch and AIS.

## 🎯 Features

### Backend (FastAPI)
- ✅ RESTful API with comprehensive documentation
- ✅ JWT-based authentication and authorization
- ✅ SQLite database with ORM (SQLAlchemy)
- ✅ External API integrations (BarentsWatch, AIS)
- ✅ Risk assessment engine with multi-factor analysis
- ✅ Scheduled background tasks (nightly analysis)
- ✅ Comprehensive error handling and logging
- ✅ CORS support for frontend communication

### Frontend (React + TypeScript)
- ✅ Modern React with TypeScript
- ✅ Responsive design with Tailwind CSS
- ✅ State management with Zustand
- ✅ Real-time data synchronization
- ✅ Interactive farm maps with Leaflet
- ✅ Risk indicators and visualizations
- ✅ Alert notifications system
- ✅ User authentication flow

### DevOps & Deployment
- ✅ Docker containerization for both services
- ✅ Docker Compose for local development
- ✅ Fly.io deployment configuration
- ✅ Nginx reverse proxy setup
- ✅ Environment variable management
- ✅ Health checks and monitoring

## 📋 Prerequisites

- Python 3.11+
- Node.js 18+
- Docker & Docker Compose (optional, for containerized setup)
- Git

## 🚀 Quick Start

### 1. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy environment file
cp .env.example .env

# Initialize database
python -c "from app.db.database import engine; from app.db.models import Base; Base.metadata.create_all(bind=engine)"

# Start development server
uvicorn app.main:app --reload
```

Backend API will be available at: **http://localhost:8000**
API Documentation: **http://localhost:8000/docs**

### 2. Frontend Setup

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Frontend will be available at: **http://localhost:5173**

### 3. Docker Setup (Alternative)

```bash
# Build and run all services
docker-compose up --build

# Backend: http://localhost:8000
# Frontend: http://localhost:3000
```

## 📁 Project Structure

```
aquashield/
├── backend/
│   ├── app/
│   │   ├── api/              # API endpoints
│   │   ├── core/             # Config, security, auth
│   │   ├── db/               # Database models
│   │   ├── services/         # Business logic
│   │   ├── schemas/          # Pydantic models
│   │   ├── tasks/            # Scheduled tasks
│   │   ├── logging/          # Logging setup
│   │   ├── utils/            # Utility functions
│   │   └── main.py           # FastAPI app
│   ├── requirements.txt       # Python dependencies
│   ├── .env.example           # Environment template
│   └── README.md              # Backend docs
├── frontend/
│   ├── src/
│   │   ├── api/               # API clients
│   │   ├── components/        # React components
│   │   ├── pages/             # Page components
│   │   ├── store/             # Zustand stores
│   │   ├── App.tsx            # Main app
│   │   └── main.tsx           # Entry point
│   ├── package.json           # Node dependencies
│   ├── vite.config.ts         # Vite config
│   ├── tailwind.config.js      # Tailwind config
│   └── README.md              # Frontend docs
├── docker-compose.yml         # Docker Compose config
├── Dockerfile.backend         # Backend Docker image
├── Dockerfile.frontend        # Frontend Docker image
├── nginx.conf                 # Nginx reverse proxy
├── fly.toml                   # Fly.io config
└── README.md                  # This file
```

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user

### Farms
- `POST /api/farms` - Create farm
- `GET /api/farms` - List farms
- `GET /api/farms/{id}` - Get farm details
- `PUT /api/farms/{id}` - Update farm
- `DELETE /api/farms/{id}` - Delete farm

### Risk Assessment
- `POST /api/risk/assess/{farm_id}` - Assess farm risk
- `GET /api/risk/history/{farm_id}` - Get assessment history
- `GET /api/risk/latest/{farm_id}` - Get latest assessment

### Alerts
- `GET /api/alerts` - Get alerts
- `PATCH /api/alerts/{id}` - Mark as read
- `DELETE /api/alerts/{id}` - Delete alert
- `GET /api/alerts/stats/summary` - Alert summary

### Dashboard
- `GET /api/dashboard` - Get dashboard data

## 🔑 Environment Variables

### Backend (.env)

```env
# Database
DATABASE_URL=sqlite:///./aquashield.db

# JWT
SECRET_KEY=your-secret-key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# API Keys
BARENTZWATCH_API_KEY=your-key
AIS_API_KEY=your-key

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173

# Logging
LOG_LEVEL=INFO
LOG_FILE=logs/aquashield.log

# Environment
ENVIRONMENT=development

# Scheduled Tasks
ENABLE_SCHEDULED_TASKS=true
NIGHTLY_ANALYSIS_HOUR=23
```

### Frontend (.env)

```env
VITE_API_URL=http://localhost:8000
```

## 🧪 Testing

### Backend Tests
```bash
cd backend
pip install pytest pytest-asyncio
pytest
```

## 📦 Deployment

### Fly.io Deployment

```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh

# Login to Fly
flyctl auth login

# Deploy
flyctl deploy --remote-only
```

### Docker Deployment

```bash
# Build images
docker build -f Dockerfile.backend -t aquashield-backend .
docker build -f Dockerfile.frontend -t aquashield-frontend .

# Push to registry (optional)
docker push your-registry/aquashield-backend
docker push your-registry/aquashield-frontend
```

## 🔐 Security Features

- ✅ JWT-based authentication
- ✅ Password hashing with bcrypt
- ✅ CORS protection
- ✅ Environment variable management
- ✅ Secure headers
- ✅ Input validation with Pydantic
- ✅ SQL injection prevention (ORM)

## 📊 Risk Assessment Algorithm

The risk assessment engine calculates individual scores for:

1. **Disease Risk**: Based on disease outbreak data from BarentsWatch
2. **Sea Lice Risk**: Calculated from pest monitoring data
3. **Water Quality Risk**: Evaluated from water parameters
4. **Escape Risk**: Based on vessel proximity from AIS data

Overall risk level is determined by the maximum component risk:
- **CRITICAL**: 75-100%
- **HIGH**: 50-74%
- **MEDIUM**: 25-49%
- **LOW**: 0-24%

## 🔄 Scheduled Tasks

The application runs nightly analysis at a configurable hour (default: 23:00):

1. Fetches data from BarentsWatch and AIS APIs
2. Calculates risk assessments for all farms
3. Generates alerts for high-risk situations
4. Logs all analysis results

## 📝 Logging

Logs are written to:
- **Console**: All log levels
- **File**: `logs/aquashield.log` with rotation (10MB max, 5 backups)

Configure log level via `LOG_LEVEL` environment variable.

## 🐛 Troubleshooting

### Backend won't start
```bash
# Check Python version
python --version  # Should be 3.11+

# Verify dependencies
pip list | grep fastapi

# Check port availability
netstat -tulpn | grep 8000  # Linux/Mac
netstat -ano | findstr 8000  # Windows
```

### Frontend build fails
```bash
# Clear cache
rm -rf node_modules package-lock.json
npm install

# Rebuild
npm run build
```

### Database issues
```bash
# Reset database (development only)
rm aquashield.db
python -c "from app.db.database import engine; from app.db.models import Base; Base.metadata.create_all(bind=engine)"
```

## 🤝 Contributing

1. Create a feature branch
2. Make your changes
3. Add tests
4. Submit a pull request

## 📄 License

MIT License - See LICENSE file for details

## 📧 Support

For issues and questions, please open a GitHub issue or contact the development team.

---

**AquaShield** - Protecting aquaculture with intelligent monitoring 🐟
