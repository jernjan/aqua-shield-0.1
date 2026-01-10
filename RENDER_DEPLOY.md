# Deploy til Render - Steg-for-steg

## Status: KLART FOR DEPLOY ✅

**Alt er commitet og pushet til GitHub:**
- Frontend: Bygget (`client/dist/` klart)
- Backend: Konfigurert med `npm start`
- render.yaml: Konfigurert for deployment
- GitHub: Kode pushet til `feature/backend-scaffold`

---

## Deploy prosess (manual)

### 1. Logg inn på Render.com
```
https://dashboard.render.com
```

### 2. Koble GitHub
- Click "New +"
- Select "Blueprint"
- Connect GitHub repo: `jernjan/aqua-shield-0.1`
- Select branch: `feature/backend-scaffold`

### 3. Render leser `render.yaml` automatisk
Deployment vil startes med:
- **Backend API**: `aqua-shield-api` (Node.js)
- **Frontend**: `aqua-shield-web` (Static)
- **Database**: `aqua-shield-db` (PostgreSQL)
- **Cron Job**: Nightly analysis

### 4. Miljøvariabler
Render genererer automatisk:
- `JWT_SECRET` - autogenerert
- `NODE_ENV` = production

**Legg til hvis nødvendig:**
```
DATABASE_URL=<auto-set av Render>
CORS_ORIGIN=https://aqua-shield-web-xxx.onrender.com
```

### 5. Vent på deployment
- Backend starter først: ~2-3 min
- Frontend bygges: ~2 min
- Database provisjoneres: ~1-2 min

### 6. Verifiser deployment
```
Backend API:  https://aqua-shield-api-xxx.onrender.com
Frontend:     https://aqua-shield-web-xxx.onrender.com
```

Test:
```bash
curl https://aqua-shield-api-xxx.onrender.com/api/health
```

---

## Hvis noe feiler

### Backend starter ikke
```
Check: server/index.js is correct
Check: All dependencies in package.json
Check: render.yaml buildCommand er korrekt
```

### Frontend loading tak
```
Check: VITE build worked locally
Check: vite.config.js har riktig base URL
Check: render.yaml staticPublishPath = client/dist
```

### Database connection fails
```
Render provisjonerer automatisk PostgreSQL
Men vi bruker in-memory fallback så det er OK
Upgrade til PostgreSQL senere når needed
```

---

## Etter deployment

### Push main branch
```bash
git checkout main
git merge feature/backend-scaffold
git push origin main
```

### Uppdater Render til main
- I Render dashboard: Change deploy branch to `main`

### Phase 3: BarentsWatch API
- Debugg API-connection når Render er live
- Eller implementer VesselFinder API
- Update `server/utils/barentswatch.js`

---

## Tilbake til lokal utvikling
```bash
# Backend
cd server
npm install
npm start

# Frontend (annen terminal)
cd client
npm install
npm run dev
```

---

**Status:** Ready for production deployment! 🚀
