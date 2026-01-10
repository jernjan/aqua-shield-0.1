# AquaShield Phase 2 - PostgreSQL Setup Guide

## Prerequisites

- PostgreSQL 12+ installed locally
- Node.js 16+
- npm

## Quick Start

### 1. Install PostgreSQL

**Windows (using chocolatey or direct installer):**
```bash
# Using chocolatey
choco install postgresql

# Or download from https://www.postgresql.org/download/windows/
```

**macOS (using Homebrew):**
```bash
brew install postgresql
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get install postgresql postgresql-contrib
```

### 2. Start PostgreSQL Service

**Windows:**
- PostgreSQL Service should auto-start
- Or: `Services` → PostgreSQL → Start

**macOS/Linux:**
```bash
# Start service
brew services start postgresql

# Or check status
pg_isready
```

### 3. Create Database and User

```bash
# Connect to PostgreSQL
psql -U postgres

# Inside psql:
CREATE USER aquashield WITH PASSWORD 'your_password_here';
CREATE DATABASE aquashield_dev OWNER aquashield;
GRANT ALL PRIVILEGES ON DATABASE aquashield_dev TO aquashield;
\q
```

### 4. Initialize Schema

```bash
cd aqua-shield-0.1/server
node init-db.js
```

Output should show:
```
[DB] ✓ Connected to PostgreSQL
[Init DB] ✓ Created alerts_history table
[Init DB] ✓ Created vessel_movements table
[Init DB] ✓ Created indices
[Init DB] ✓ Schema initialization complete
```

### 5. Start Servers

```bash
# Terminal 1: Backend
cd aqua-shield-0.1/server
node index.js

# Terminal 2: Frontend
cd aqua-shield-0.1/client
npm run dev
```

### 6. Test Connection

Visit http://localhost:3001/api/datalog/stats

Should return:
```json
{
  "ok": true,
  "stats": {
    "total_alerts_logged": 0,
    "confirmed_outbreaks": 0,
    "false_positives": 0,
    "pending_review": 0,
    "total_vessel_movements": 0,
    ...
  }
}
```

## Troubleshooting

### "Connection refused"
- Check PostgreSQL is running: `pg_isready`
- Check credentials in `server/database.js`

### "Database aquashield_dev does not exist"
- Run the psql commands above to create database

### "Column does not exist"
- Delete the database and run `node init-db.js` again:
```bash
psql -U postgres
DROP DATABASE aquashield_dev;
CREATE DATABASE aquashield_dev OWNER aquashield;
\q

node init-db.js
```

### Windows: "Password authentication failed"
- Check PostgreSQL started with correct user
- Reset password: `ALTER USER aquashield WITH PASSWORD 'newpassword';`

## Data Persistence

✅ **Now working!**
- Alerts persist across server restarts
- Vessel movements logged permanently
- Outbreak confirmations saved for ML training

## Next Steps

✓ Phase 2: PostgreSQL ✅
→ Phase 2: Real Kystverket AIS API
→ Phase 3: ML Model Training
