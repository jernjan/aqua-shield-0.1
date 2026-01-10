# Deploy på Render – Steg-for-steg

AquaShield består av 2 services + 1 cron job på Render.

## Forutsetninger

- GitHub-konto (fork/clone aqua-shield-0.1)
- Render-konto (https://render.com)
- Twilio-konto (SMS, optional for MVP)
- Gmail/SMTP-konto (Email, optional for MVP)

---

## 1. Forbered koden

### 1.1 GitHub setup

```bash
cd ~/aqua-shield-0.1
git init
git add .
git commit -m "Initial commit: AquaShield MVP 0.1"
git remote add origin https://github.com/YOUR_USERNAME/aqua-shield-0.1.git
git push -u origin main
```

### 1.2 Legg til Render config (opcional, men anbefalt)

Opprett `render.yaml` i root:

```yaml
# render.yaml
services:
  - type: web
    name: aqua-shield-api
    runtime: node
    buildCommand: "cd server && npm install"
    startCommand: "cd server && npm start"
    envVars:
      - key: PORT
        value: "3001"
      - key: JWT_SECRET
        fromService:
          name: aqua-shield-api
          property: JWT_SECRET
    routes:
      - path: /api
        rewrite: /api

  - type: static
    name: aqua-shield-web
    buildCommand: "cd client && npm install && npm run build"
    staticPublishPath: client/dist
    routes:
      - path: /
        rewrite: /index.html
```

Eller opprett manuelt via Render dashboard (se nedenfor).

---

## 2. Deploy API på Render

### 2.1 Opprett Web Service

1. Logg inn på https://render.com
2. Klikk **New +** → **Web Service**
3. Koble til GitHub repo (connect to GitHub, velg aqua-shield-0.1)
4. Fyll inn:
   - **Name:** `aqua-shield-api`
   - **Runtime:** Node
   - **Build Command:** `cd server && npm install`
   - **Start Command:** `cd server && npm start`
   - **Instance Type:** Free (eller Starter, $7/month)

### 2.2 Legg til Environment Variables

I Render dashboard, under **Environment**:

```
PORT=3001
JWT_SECRET=your-super-secret-random-string-here
TWILIO_SID=your_twilio_sid (optional)
TWILIO_TOKEN=your_twilio_token (optional)
TWILIO_PHONE=+47xxxxxxxx (optional)
SMTP_HOST=smtp.gmail.com (optional)
SMTP_PORT=587 (optional)
SMTP_USER=your_email@gmail.com (optional)
SMTP_PASS=your_app_password (optional)
```

### 2.3 Deploy

Klikk **Create Web Service**. Render bygger automatisk fra GitHub (5–10 min).

**API URL:** `https://aqua-shield-api.onrender.com`

---

## 3. Deploy Frontend på Render

### 3.1 Opprett Static Site

1. I Render dashboard: **New +** → **Static Site**
2. Koble til samme GitHub repo
3. Fyll inn:
   - **Name:** `aqua-shield-web`
   - **Build Command:** `cd client && npm install && npm run build`
   - **Publish directory:** `client/dist`

### 3.2 Configure proxy (viktig!)

I `client/vite.config.js`, endrer `/api` proxy til production URL:

```javascript
// client/vite.config.js
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': process.env.API_URL || 'http://localhost:3001'
    }
  }
})
```

Legg til env-var i Render static site:

```
VITE_API_URL=https://aqua-shield-api.onrender.com
```

Eller endre frontend kode til hardcoded URL (enklere for MVP):

```javascript
// In client/src/App.jsx or axios config
const API_BASE = 'https://aqua-shield-api.onrender.com/api'
```

### 3.3 Deploy

Klikk **Create Static Site**. Render bygger fra GitHub (3–5 min).

**Web URL:** `https://aqua-shield-web.onrender.com`

---

## 4. Setup Nightly Cron Job

**Mulighet A: Render Cron Job** (beta, kan være ustabil)

1. **New +** → **Cron Job**
2. **Name:** `aqua-shield-nightly`
3. **Runtime:** Node
4. **Build Command:** `cd server && npm install`
5. **Run Command:** `node -e "import('./cron/nightly.js').then(m => m.runNightlyAnalysis())"`
6. **Schedule:** `0 3 * * *` (03:00 UTC)
7. Samme env-vars som API

**Mulighet B: External Cron (anbefalt for MVP)**

Bruk tjeneste som `Cronhub.io` eller `EasyCron`:

```
POST https://aqua-shield-api.onrender.com/api/cron/nightly
```

Opprett endpoint i `server/routes/cron.js`:

```javascript
import { runNightlyAnalysis } from '../cron/nightly.js'

router.post('/nightly', async (req, res) => {
  await runNightlyAnalysis()
  res.json({ message: 'Analysis complete' })
})
```

---

## 5. Test Deploy

### 5.1 API health check

```bash
curl https://aqua-shield-api.onrender.com/api/health
# Expected: { "status": "ok", "timestamp": "..." }
```

### 5.2 Frontend

Åpne `https://aqua-shield-web.onrender.com` i nettleser. Burde vise login-siden.

### 5.3 Register + test alert

1. Register bruker
2. Velg test-anlegg
3. Klikk "🧪 Send test-varsel"
4. Se varsel i dashboard

---

## 6. Database backup (viktig!)

For MVP bruker vi `db.json` i root av server. **DETTE MÅ SIKRES!**

Alternativ:
1. **GitHub backup** – Commit `db.json` regelmessig
2. **Render disk persistence** – Legg til `/var/data` mount
3. **AWS S3 backup** – Script som tar sikkerhetskopi hver natt
4. **PostgreSQL** – Opprett Render PostgreSQL service ($9+/month)

For MVP: Commit `db.json` daglig til GitHub.

---

## 7. Overvåking

Legg til enkel error-logging:

```bash
# I Render dashboard, under Logs
# Kan se alle console.log(), console.error()
```

For produksjon, integrer Sentry/Datadog:

```javascript
// server/index.js
import * as Sentry from "@sentry/node"
Sentry.init({ dsn: process.env.SENTRY_DSN })
```

---

## 8. Pricing (Render)

| Service | Tier | Pris |
|---------|------|------|
| API Web Service | Free/Starter | $0/$7/month |
| Static Site | Free | $0 |
| Cron Job | Free (beta) | $0 |
| Database (Postgres) | Standard | $9+/month |

**Estimat MVP:** $7–15/month

---

## 9. Troubleshooting

| Problem | Løsning |
|---------|---------|
| API 404 errors | Sjekk `server/.env`, PORT=3001 |
| Frontend blank page | Check browser console, CORS errors? |
| Nightly cron ikke kjøring | Sjekk logs, `runNightlyAnalysis()` returnerer promise |
| Email/SMS ikke sendt | Sjekk `.env`, Twilio/Gmail detaljer, logs |
| `db.json` lost on redeploy | Legg til persistent disk i Render (Starter plan+) |

---

## 10. Next steps (når live)

1. **Monitor alerts** – Sjekk false positives/negatives daglig
2. **Contact pilot customers** – 10–20 gratis for 3 months
3. **Collect feedback** – What alerts are most useful? Which came true?
4. **Calibrate thresholds** – Øk/reduser risk score basert på real outbreaks
5. **Implement real SMS/Email** – Aktivere Twilio/SMTP
6. **Add more data sources** – NorKyst-800, Copernicus Sentinel
7. **Switch to PostgreSQL** – `db.json` blir too slow med 50+ users

---

Lykke til! 🐟 Klar for launch?
