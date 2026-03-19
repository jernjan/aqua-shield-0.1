# Deployment Guide

## Overview

This guide covers deploying AquaShield to production environments.

## Fly.io Deployment

### Prerequisites

- Fly CLI installed: https://fly.io/install/
- Fly account created
- Docker installed

### Step 1: Setup

```bash
# Login to Fly
flyctl auth login

# Create app
flyctl launch
```

### Step 2: Environment Variables

```bash
# Set production secrets
flyctl secrets set SECRET_KEY="your-secure-random-key"
flyctl secrets set BARENTZWATCH_API_KEY="your-key"
flyctl secrets set AIS_API_KEY="your-key"
flyctl secrets set ENVIRONMENT="production"
```

### Step 3: Database Persistence

```bash
# Create volume for data persistence
flyctl volumes create aquashield_data --size 10 --region <your-region>

# Verify volume
flyctl volumes list
```

### Step 4: Deploy

```bash
# Deploy application
flyctl deploy --remote-only

# Check logs
flyctl logs

# View status
flyctl status
```

### Step 5: Verify

```bash
# Get app URL
flyctl info

# Test health endpoint
curl https://your-app.fly.dev/health
```

## Docker Deployment

### Build Images

```bash
# Backend
docker build -f Dockerfile.backend -t aquashield-backend:latest .

# Frontend
docker build -f Dockerfile.frontend -t aquashield-frontend:latest .
```

### Push to Registry

```bash
# Tag images
docker tag aquashield-backend:latest registry.example.com/aquashield-backend:latest
docker tag aquashield-frontend:latest registry.example.com/aquashield-frontend:latest

# Push
docker push registry.example.com/aquashield-backend:latest
docker push registry.example.com/aquashield-frontend:latest
```

### Deploy with Docker Compose

```bash
# Pull latest images
docker-compose pull

# Start services
docker-compose up -d

# View logs
docker-compose logs -f
```

## Kubernetes Deployment

### Prerequisites

- kubectl installed
- Kubernetes cluster
- Docker registry access

### Create Deployment

```bash
# Create namespace
kubectl create namespace aquashield

# Create secrets
kubectl create secret generic aquashield-secrets \
  --from-literal=SECRET_KEY=your-key \
  --from-literal=BARENTZWATCH_API_KEY=your-key \
  --from-literal=AIS_API_KEY=your-key \
  -n aquashield

# Apply deployment (create k8s-deployment.yaml first)
kubectl apply -f k8s-deployment.yaml -n aquashield

# Check status
kubectl get pods -n aquashield
kubectl logs -f deployment/aquashield-backend -n aquashield
```

## Environment Configuration

### Production Environment Variables

```env
ENVIRONMENT=production
SECRET_KEY=<generate-secure-random-key>
DATABASE_URL=sqlite:///./aquashield.db
# Or use PostgreSQL in production:
# DATABASE_URL=postgresql://user:pass@localhost/aquashield

LOG_LEVEL=WARNING
ALLOWED_ORIGINS=https://yourdomain.com

BARENTZWATCH_API_KEY=<your-key>
AIS_API_KEY=<your-key>

ENABLE_SCHEDULED_TASKS=true
NIGHTLY_ANALYSIS_HOUR=23
```

### Generate Secure Secret

```bash
# Python
python -c "import secrets; print(secrets.token_urlsafe(32))"

# OpenSSL
openssl rand -base64 32
```

## Database Setup

### SQLite (Development/Small deployments)

```bash
# Already set up in app startup
# Database file: aquashield.db
```

### PostgreSQL (Production)

```bash
# Create database
createdb aquashield

# Update DATABASE_URL
DATABASE_URL=postgresql://user:password@localhost:5432/aquashield

# Apply migrations (already automatic)
```

## SSL/TLS Configuration

### Fly.io

Automatic with custom domain:

```bash
flyctl certs create yourdomain.com
flyctl certs show yourdomain.com
```

### Self-hosted with Let's Encrypt

```bash
# Using Certbot
sudo certbot certonly --standalone -d yourdomain.com

# Update nginx.conf
ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
```

## Monitoring & Logging

### Health Checks

```bash
# Backend health
curl https://your-app.fly.dev/health

# Frontend check
curl https://your-app.fly.dev/

# API documentation
https://your-app.fly.dev/docs
```

### Log Management

```bash
# Fly.io logs
flyctl logs

# Docker logs
docker-compose logs -f service-name

# Kubernetes logs
kubectl logs -f deployment/aquashield-backend -n aquashield
```

## Backup & Recovery

### Database Backup

```bash
# SQLite
cp aquashield.db aquashield.db.backup

# PostgreSQL
pg_dump aquashield > backup.sql
```

### Restore Database

```bash
# SQLite
cp aquashield.db.backup aquashield.db

# PostgreSQL
psql aquashield < backup.sql
```

## Scaling

### Horizontal Scaling (Multiple Instances)

```bash
# Fly.io
flyctl scale count 3

# Docker Swarm
docker service scale aquashield-backend=3

# Kubernetes
kubectl scale deployment aquashield-backend --replicas=3 -n aquashield
```

### Vertical Scaling (More Resources)

```bash
# Fly.io
flyctl scale vm shared-cpu-4x
```

## Performance Optimization

1. **Enable Caching**: Add Redis for session/cache
2. **Database Indexing**: Ensure indexes on frequently queried columns
3. **API Rate Limiting**: Implement rate limiting
4. **CDN**: Use CDN for frontend static assets
5. **Monitoring**: Set up performance monitoring

## Troubleshooting

### Application won't start

```bash
# Check logs
flyctl logs  # or docker-compose logs

# Check environment
flyctl ssh console  # or docker-compose exec

# Verify database
sqlite3 aquashield.db ".tables"
```

### High memory usage

```bash
# Check process
flyctl scale show

# Optimize memory
# - Implement connection pooling
# - Cache frequent queries
# - Limit worker processes
```

### API rate limiting

```bash
# Implement rate limiting middleware
from slowapi import Limiter
limiter = Limiter(key_func=get_remote_address)
```

## Security Checklist

- [ ] Change SECRET_KEY in production
- [ ] Use strong database password
- [ ] Enable HTTPS/SSL
- [ ] Configure CORS properly
- [ ] Set secure cookies
- [ ] Implement rate limiting
- [ ] Regular security updates
- [ ] Monitor logs for suspicious activity
- [ ] Backup database regularly
- [ ] Test disaster recovery

---

For more information, see:
- [Fly.io Docs](https://fly.io/docs/)
- [Docker Docs](https://docs.docker.com/)
- [FastAPI Deployment](https://fastapi.tiangolo.com/deployment/)
