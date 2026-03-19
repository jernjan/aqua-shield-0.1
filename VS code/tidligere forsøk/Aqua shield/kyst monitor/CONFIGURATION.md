# AquaShield Configuration Guide

## Overview

This guide covers configuration of AquaShield for different environments and use cases.

## Environment Setup

### Development Environment

```env
# .env (Development)
DATABASE_URL=sqlite:///./aquashield.db
SECRET_KEY=dev-secret-key-change-in-production
ENVIRONMENT=development
LOG_LEVEL=DEBUG
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173,http://127.0.0.1:5173
ENABLE_SCHEDULED_TASKS=false
```

### Production Environment

```env
# .env.production
DATABASE_URL=postgresql://user:password@prod-db.example.com/aquashield
SECRET_KEY=<use-secure-random-key>
ENVIRONMENT=production
LOG_LEVEL=WARNING
ALLOWED_ORIGINS=https://yourdomain.com
ENABLE_SCHEDULED_TASKS=true
```

## API Key Configuration

### BarentsWatch API

1. Register at https://www.barentswatch.no/
2. Get API key from dashboard
3. Set in environment:
```env
BARENTZWATCH_API_KEY=your-api-key-here
```

### AIS Service

1. Register with your AIS provider
2. Get API key/credentials
3. Set in environment:
```env
AIS_API_KEY=your-ais-api-key
```

Note: Update the AIS service base URL in [app/services/ais_service.py](backend/app/services/ais_service.py#L9)

## Database Configuration

### SQLite (Development/Small deployments)

Default configuration - requires no additional setup.

```python
DATABASE_URL=sqlite:///./aquashield.db
```

### PostgreSQL (Production)

1. Install PostgreSQL
2. Create database:
```bash
createdb aquashield
```

3. Set connection string:
```env
DATABASE_URL=postgresql://username:password@localhost:5432/aquashield
```

4. Install Python driver:
```bash
pip install psycopg2-binary
```

### MySQL (Alternative)

```env
DATABASE_URL=mysql+pymysql://username:password@localhost/aquashield
```

```bash
pip install pymysql
```

## Authentication Configuration

### JWT Settings

```env
# Token expiration in minutes
ACCESS_TOKEN_EXPIRE_MINUTES=30

# JWT algorithm
ALGORITHM=HS256

# Secret key (generate new one for production)
SECRET_KEY=<secure-random-32-character-string>
```

### Generate Secure Secret Key

```bash
# Python
python -c "import secrets; print(secrets.token_urlsafe(32))"

# OpenSSL
openssl rand -base64 32

# /dev/urandom (Linux/Mac)
head -c 32 /dev/urandom | base64
```

## Logging Configuration

### Log Levels

- `DEBUG`: Detailed information for debugging
- `INFO`: General information about application state
- `WARNING`: Warning messages for important events
- `ERROR`: Error messages for exceptions
- `CRITICAL`: Critical errors that may cause shutdown

### Log Output

Logs are written to:
- **Console**: All configured levels
- **File**: `logs/aquashield.log` with rotation

```env
LOG_LEVEL=INFO
LOG_FILE=logs/aquashield.log
```

### Log Rotation

- Max file size: 10MB
- Backup count: 5 files
- Oldest logs are automatically deleted

## Scheduled Tasks

### Enable/Disable

```env
ENABLE_SCHEDULED_TASKS=true
```

### Nightly Analysis Timing

```env
# Hour (0-23) when nightly analysis runs
NIGHTLY_ANALYSIS_HOUR=23  # 11 PM
```

### Custom Scheduling

Edit [app/tasks/scheduler.py](backend/app/tasks/scheduler.py) to add custom tasks:

```python
schedule.every().day.at("02:00").do(lambda: asyncio.run(custom_task()))
```

## CORS Configuration

### Allowed Origins

```env
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173,https://yourdomain.com
```

### By Environment

```python
# Automatic based on ENVIRONMENT variable
if settings.is_production:
    ALLOWED_ORIGINS = "https://yourdomain.com"
else:
    ALLOWED_ORIGINS = "http://localhost:3000,http://localhost:5173"
```

## Frontend Configuration

### API URL

```env
# vite.config.ts
VITE_API_URL=http://localhost:8000
```

### Build Configuration

```javascript
// vite.config.ts
export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      }
    }
  }
})
```

## Docker Configuration

### Environment in Docker Compose

```yaml
environment:
  DATABASE_URL: sqlite:///./aquashield.db
  SECRET_KEY: ${SECRET_KEY}
  ENVIRONMENT: ${ENVIRONMENT}
  BARENTZWATCH_API_KEY: ${BARENTZWATCH_API_KEY}
  AIS_API_KEY: ${AIS_API_KEY}
```

### Build Args

```dockerfile
ARG ENVIRONMENT=development
ARG LOG_LEVEL=INFO
```

## SSL/TLS Configuration

### Self-signed Certificates (Development)

```bash
# Generate self-signed certificate
openssl req -x509 -newkey rsa:4096 -nodes \
  -out cert.pem -keyout key.pem -days 365
```

### Let's Encrypt (Production)

```bash
# Install Certbot
sudo apt-get install certbot python3-certbot-nginx

# Generate certificate
sudo certbot certonly --standalone -d yourdomain.com

# Renew certificate
sudo certbot renew --dry-run
```

### Nginx Configuration

```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
```

## Performance Configuration

### Database Connection Pool

For PostgreSQL:

```python
# app/db/database.py
from sqlalchemy.pool import QueuePool

engine = create_engine(
    DATABASE_URL,
    poolclass=QueuePool,
    pool_size=10,
    max_overflow=20,
    pool_recycle=3600,
)
```

### Async Support

Already enabled in FastAPI:

```python
# app/api endpoints use async/await
async def assess_farm_risk(...):
    await risk_service.assess_farm_risk(...)
```

### Caching

Consider adding Redis for caching:

```python
from redis import Redis

redis_client = Redis(host='localhost', port=6379, db=0)
```

## Monitoring Configuration

### Health Checks

The application provides health endpoint:

```
GET /health
```

### Logging to External Services

```python
# Add to app/logging/logger.py
import logging
from pythonjsonlogger import jsonlogger

# JSON logging for ELK stack, Splunk, etc
json_handler = logging.StreamHandler()
json_handler.setFormatter(jsonlogger.JsonFormatter())
logger.addHandler(json_handler)
```

### Metrics

Add Prometheus metrics:

```bash
pip install prometheus-client
```

## Security Configuration

### Password Hashing

Uses bcrypt with automatic salt generation:

```python
from passlib.context import CryptContext
pwd_context = CryptContext(schemes=["bcrypt"])
```

### Rate Limiting

Add to FastAPI:

```bash
pip install slowapi
```

```python
from slowapi import Limiter

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
```

### HTTPS/TLS

Always enable in production:

```python
# Force HTTPS
@app.middleware("http")
async def force_https(request, call_next):
    if request.url.scheme == "http":
        return RedirectResponse(url=request.url.replace(scheme="https"))
    return await call_next(request)
```

## Backup Configuration

### Database Backups

```bash
# SQLite
0 2 * * * cp /app/aquashield.db /backups/aquashield.db.$(date +\%Y\%m\%d)

# PostgreSQL
0 2 * * * pg_dump aquashield > /backups/aquashield_$(date +\%Y\%m\%d).sql
```

### File Backups

```bash
0 3 * * * tar -czf /backups/aquashield_$(date +\%Y\%m\%d).tar.gz /app/logs /app/data
```

## Testing Configuration

### pytest Configuration

```ini
# pytest.ini
[pytest]
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*
asyncio_mode = auto
```

### Test Environment

```env
# .env.test
DATABASE_URL=sqlite:///:memory:
ENVIRONMENT=testing
LOG_LEVEL=ERROR
SECRET_KEY=test-secret-key
```

## Troubleshooting Configuration

### Port Already in Use

```bash
# Find process using port
lsof -i :8000  # macOS/Linux
netstat -ano | findstr :8000  # Windows

# Kill process
kill -9 <PID>  # macOS/Linux
taskkill /PID <PID> /F  # Windows
```

### Database Locked

```bash
# Remove lock file (SQLite only)
rm aquashield.db-journal

# Reset database (development only)
rm aquashield.db
python -c "from app.db.database import engine; from app.db.models import Base; Base.metadata.create_all(bind=engine)"
```

### Memory Issues

```env
# Reduce worker processes
WORKERS=2

# Increase timeout
TIMEOUT=120
```

---

For more information, check individual README.md files in each component directory.
