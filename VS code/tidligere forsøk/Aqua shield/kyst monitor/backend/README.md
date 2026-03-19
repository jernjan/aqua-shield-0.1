# Backend - FastAPI AquaShield Service

FastAPI-based backend for the AquaShield aquaculture monitoring system.

## Setup

1. Create virtual environment:
```bash
python -m venv venv
venv\Scripts\activate  # Windows
source venv/bin/activate  # Linux/Mac
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Configure environment:
```bash
cp .env.example .env
# Edit .env with your API keys and settings
```

4. Run migrations (database setup):
```bash
python -c "from app.db.database import engine; from app.db.models import Base; Base.metadata.create_all(bind=engine)"
```

5. Start development server:
```bash
uvicorn app.main:app --reload
```

API will be available at http://localhost:8000
Documentation: http://localhost:8000/docs

## Project Structure

- `app/main.py` - FastAPI application entry point
- `app/api/` - API endpoints (auth, farms, risk, alerts, dashboard)
- `app/core/` - Core configuration and security
- `app/db/` - Database models and sessions
- `app/schemas/` - Pydantic validation schemas
- `app/services/` - Business logic services
- `app/tasks/` - Scheduled background tasks
- `app/logging/` - Logging configuration
- `app/utils/` - Utility functions

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user

### Farms
- `POST /api/farms` - Create farm
- `GET /api/farms` - List user's farms
- `GET /api/farms/{id}` - Get farm details
- `PUT /api/farms/{id}` - Update farm
- `DELETE /api/farms/{id}` - Delete farm

### Risk Assessment
- `POST /api/risk/assess/{farm_id}` - Assess farm risk
- `GET /api/risk/history/{farm_id}` - Get assessment history
- `GET /api/risk/latest/{farm_id}` - Get latest assessment

### Alerts
- `GET /api/alerts` - Get alerts
- `GET /api/alerts/{id}` - Get alert details
- `PATCH /api/alerts/{id}` - Update alert
- `DELETE /api/alerts/{id}` - Delete alert
- `GET /api/alerts/stats/summary` - Get alert summary

### Dashboard
- `GET /api/dashboard` - Get dashboard data
