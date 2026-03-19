# Backend - FastAPI Setup Guide

## Installation

### 1. Create Virtual Environment

```bash
# Windows
python -m venv venv
venv\Scripts\activate

# macOS/Linux
python3 -m venv venv
source venv/bin/activate
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure Environment

```bash
cp .env.example .env
# Edit .env with your settings
```

## Running the Server

### Development Mode (with auto-reload)

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Access:**
- API: http://localhost:8000
- Docs (Swagger): http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### Production Mode

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

## Database

### Initialize Database

Database tables are created automatically on first run.

### View Database

SQLite file: `aquashield.db` (in backend folder)

Use SQLite viewer or CLI:
```bash
sqlite3 aquashield.db
```

### Future: Alembic Migrations

When schema changes needed:
```bash
alembic init migrations
alembic revision --autogenerate -m "Add new field"
alembic upgrade head
```

## API Documentation

All endpoints are documented in Swagger UI at `/docs`

### Quick Test

```bash
# Register user
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"123456"}'

# Login
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"123456"}'

# Get facilities
curl http://localhost:8000/facilities
```

## Project Structure

```
app/
├── main.py              # FastAPI application
├── core/
│   ├── config.py        # Settings from environment
│   └── security.py      # JWT & password hashing
├── api/
│   └── routes/
│       ├── auth.py      # Authentication endpoints
│       ├── facilities.py # Facility endpoints
│       └── alerts.py    # Alert endpoints
├── models/
│   ├── user.py
│   ├── facility.py
│   ├── vessel.py
│   └── alert.py
├── schemas/
│   ├── user.py
│   ├── facility.py
│   └── alert.py
├── services/
│   ├── barentswatch.py  # BarentsWatch API client
│   ├── ais.py          # AIS (vessel) API client
│   └── risk.py         # Risk calculation logic
├── utils/
│   ├── logger.py       # Logging setup
│   └── ...
└── db/
    └── database.py     # SQLAlchemy setup
```

## Key Modules

### Services (Business Logic)

**`services/risk.py`** – Risk calculation
```python
from app.services.risk import RiskCalculationService

score, level = RiskCalculationService.calculate_facility_risk(
    lice_count=500,
    temperature=10,
    has_ila=True
)
```

**`services/barentswatch.py`** – BarentsWatch API
```python
from app.services.barentswatch import BarentsWatchService

service = BarentsWatchService()
facilities = await service.get_facilities()
```

### Database

All models extend SQLAlchemy `Base`:

```python
from app.db.database import get_db

def my_endpoint(db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == "test@example.com").first()
```

## Environment Variables

See `.env.example` for all available settings.

**Important for development:**
```
DEBUG=True
DATABASE_URL=sqlite:///./aquashield.db
SECRET_KEY=your-secret-key
```

**For BarentsWatch integration:**
```
BARENTSWATCH_API_KEY=your_key
BARENTSWATCH_API_SECRET=your_secret
```

## Troubleshooting

### Port Already in Use
```bash
# Find process on port 8000
lsof -i :8000  # macOS/Linux
netstat -ano | findstr :8000  # Windows

# Kill process and restart
```

### Database Locked
Delete `aquashield.db` and restart (development only!)

### Import Errors
Ensure you're in virtual environment: `pip install -r requirements.txt`

## Next Steps

1. Test API endpoints with Swagger UI
2. Connect to BarentsWatch API (add API key to .env)
3. Implement cron job for nightly analysis
4. Add email/SMS notifications
5. Deploy to Fly.io / Railway

---

**Python:** 3.8+  
**FastAPI:** 0.104+  
**SQLite:** Included
