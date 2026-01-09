# AquaShield — Backend scaffold

This folder contains a minimal Express backend used for prototyping data ingest and rule‑based alerts.

How to run locally:

```powershell
cd server
npm install
npm run dev
# Server runs on http://localhost:4000
```

Endpoints:
- `GET /api/alerts` - list alerts
- `POST /api/alerts/test` - create a test alert
- `POST /api/admin/run-cron` - manually trigger nightly analysis

Replace mock ingestion in `server/cron/nightly.js` with real API calls to BarentsWatch, NorKyst, Copernicus and Kystverket when ready.
