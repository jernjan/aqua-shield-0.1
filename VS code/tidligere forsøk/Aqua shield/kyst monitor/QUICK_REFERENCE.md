# AquaShield - Quick Reference

## 🚀 Starting the Application

### Development Mode

**Terminal 1 - Backend:**
```bash
cd backend
source venv/bin/activate  # Windows: venv\Scripts\activate
uvicorn app.main:app --reload
# http://localhost:8000
# API Docs: http://localhost:8000/docs
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
# http://localhost:5173
```

### Docker Mode
```bash
docker-compose up
# Backend: http://localhost:8000
# Frontend: http://localhost:3000
```

## 📋 Common Commands

### Backend

```bash
# Create venv
python -m venv venv

# Activate venv (Windows)
venv\Scripts\activate

# Activate venv (Mac/Linux)
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run server
uvicorn app.main:app --reload

# Run tests
pytest

# Check code style
flake8 app/

# Format code
black app/
```

### Frontend

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Check TypeScript
npm run type-check

# Lint code
npm run lint
```

### Docker

```bash
# Build images
docker-compose build

# Start services
docker-compose up

# Stop services
docker-compose down

# View logs
docker-compose logs -f

# Run specific service
docker-compose up backend
```

## 🔐 Default Credentials

For testing, create a user through the API:

**Register:**
```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "Password123!"
  }'
```

**Login:**
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "Password123!"
  }'
```

## 📁 Important Files

| File | Purpose |
|------|---------|
| `backend/app/main.py` | FastAPI application entry |
| `backend/app/db/models.py` | Database models |
| `backend/app/core/security.py` | JWT and authentication |
| `backend/app/services/risk_assessment_service.py` | Risk calculation |
| `frontend/src/App.tsx` | React app entry |
| `frontend/src/api/` | API client functions |
| `frontend/src/store/` | State management |
| `.env` | Environment variables |
| `docker-compose.yml` | Docker setup |
| `fly.toml` | Fly.io deployment |

## 🔧 Configuration

### Add API Key

1. Get API key from provider
2. Add to `.env`:
   ```env
   BARENTZWATCH_API_KEY=your-key-here
   AIS_API_KEY=your-key-here
   ```
3. Restart backend

### Change Database

1. Update `DATABASE_URL` in `.env`:
   ```env
   # SQLite
   DATABASE_URL=sqlite:///./aquashield.db
   
   # PostgreSQL
   DATABASE_URL=postgresql://user:pass@localhost/aquashield
   
   # MySQL
   DATABASE_URL=mysql+pymysql://user:pass@localhost/aquashield
   ```
2. For PostgreSQL/MySQL, install driver:
   ```bash
   pip install psycopg2-binary  # PostgreSQL
   pip install pymysql          # MySQL
   ```

### Change Port

**Backend:**
```bash
uvicorn app.main:app --port 9000
```

**Frontend:**
```bash
npm run dev -- --port 3000
```

## 🧪 Testing

### Test Login Flow

```bash
# 1. Register
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test","email":"test@test.com","password":"Test123!"}'

# 2. Login (get token)
TOKEN=$(curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"Test123!"}' \
  | jq -r '.access_token')

# 3. Get current user
curl -X GET http://localhost:8000/api/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

### Test Farm Creation

```bash
# 1. Get token (from above)

# 2. Create farm
curl -X POST http://localhost:8000/api/farms \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Test Farm",
    "latitude": 60.5,
    "longitude": 5.5,
    "description": "Test farm location"
  }'

# 3. List farms
curl -X GET http://localhost:8000/api/farms \
  -H "Authorization: Bearer $TOKEN"
```

## 🐛 Debugging

### View Backend Logs

```bash
# Console output
tail -f logs/aquashield.log

# With grep
grep ERROR logs/aquashield.log
grep WARNING logs/aquashield.log
```

### View Frontend Logs

- Open browser DevTools (F12)
- Check Console tab

### Database Issues

```bash
# Check database (SQLite)
sqlite3 aquashield.db ".tables"
sqlite3 aquashield.db ".schema"

# Reset database (development only)
rm aquashield.db
python -c "from app.db.database import engine; from app.db.models import Base; Base.metadata.create_all(bind=engine)"
```

### Port Already in Use

**Find process:**
```bash
# macOS/Linux
lsof -i :8000

# Windows
netstat -ano | findstr :8000
```

**Kill process:**
```bash
# macOS/Linux
kill -9 <PID>

# Windows
taskkill /PID <PID> /F
```

## 📊 API Quick Reference

### Authentication
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Get token
- `GET /api/auth/me` - Current user

### Farms
- `POST /api/farms` - Create farm
- `GET /api/farms` - List farms
- `GET /api/farms/{id}` - Get farm
- `PUT /api/farms/{id}` - Update farm
- `DELETE /api/farms/{id}` - Delete farm

### Risk
- `POST /api/risk/assess/{id}` - Assess farm
- `GET /api/risk/latest/{id}` - Latest assessment
- `GET /api/risk/history/{id}` - Assessment history

### Alerts
- `GET /api/alerts` - List alerts
- `PATCH /api/alerts/{id}` - Mark read
- `DELETE /api/alerts/{id}` - Delete alert

### Dashboard
- `GET /api/dashboard` - Dashboard data

### Health
- `GET /health` - Health status

## 📈 Monitoring

### Check Application Health

```bash
curl http://localhost:8000/health
```

### View API Docs

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### Monitor Processes

```bash
# Docker
docker-compose ps
docker stats

# System
top -p $(pgrep -f uvicorn)
```

## 🔄 Deployment Steps

### To Fly.io

```bash
# 1. Install Fly CLI
# https://fly.io/install/

# 2. Login
flyctl auth login

# 3. Deploy
flyctl deploy

# 4. Check status
flyctl status
```

### To Docker Registry

```bash
# 1. Build images
docker build -f Dockerfile.backend -t your-registry/aquashield-backend .
docker build -f Dockerfile.frontend -t your-registry/aquashield-frontend .

# 2. Push
docker push your-registry/aquashield-backend
docker push your-registry/aquashield-frontend

# 3. Deploy using images
```

## 📚 Documentation Links

- **Full Docs**: See README.md
- **API Docs**: See API.md
- **Deployment**: See DEPLOYMENT.md
- **Configuration**: See CONFIGURATION.md
- **Summary**: See PROJECT_SUMMARY.md

## 💡 Tips & Tricks

1. **Hot reload**: Changes auto-refresh in development
2. **API playground**: Use `/docs` for interactive testing
3. **Database reset**: Safe in development with single command
4. **Environment variables**: Change `.env` without restarting (requires reload)
5. **Frontend only changes**: Don't need backend restart
6. **Backend only changes**: Don't need frontend restart

## ⚡ Performance Tips

1. Enable database indexing for large datasets
2. Use PostgreSQL instead of SQLite for production
3. Cache API responses with Redis
4. Implement pagination for large lists
5. Compress frontend assets (done automatically)
6. Use CDN for static files
7. Enable GZIP compression in Nginx

## 🛟 Getting Help

1. Check logs first: `logs/aquashield.log`
2. Review relevant documentation
3. Check API documentation: `/docs`
4. Search GitHub issues
5. Check FastAPI docs: https://fastapi.tiangolo.com
6. Check React docs: https://react.dev

---

**Last Updated:** January 2024
**Version:** 1.0.0
