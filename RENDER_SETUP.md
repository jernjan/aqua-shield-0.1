# Deploying to Render — Quick guide

This document explains how to connect this GitHub repo to Render and create the required services (web, cron job and Postgres). It also explains how to generate a Render API token if you want the automated script/assistant to create resources for you.

1) Connect repo to Render (UI)
  - Sign into https://dashboard.render.com
  - Click "New" → "Web Service" → "Connect a repository" and choose this GitHub repo.
  - Select branch (`main`) and set the root to the repository root.
  - Build command: `cd server && npm install`
  - Start command: `cd server && npm start`
  - Environment: `Node` (or `Node 18+`), region as appropriate.

2) Add a managed Postgres database
  - In Render dashboard, click "New" → "PostgreSQL" and create a new database.
  - Note the `DATABASE_URL` connection string Render provides.
  - Add `DATABASE_URL` as a secret to the web service (in the service's Environment tab) or use the dashboard's automatic injection.

3) Cron job (nightly)
  - Option A (recommended): Use the `render.yaml` present in the repo root. In Render, import the spec or create a new Cron Job with:
    - Command: `cd server && node -e \"require('./cron/nightly').runNightlyAnalysis().then(r=>console.log(r)).catch(e=>console.error(e))\"`
    - Schedule: `0 3 * * *` (03:00 daily)
  - Option B: Create a new cron job in the UI with the same command/schedule.

4) Environment variables / secrets
  - Required (example):
    - `NODE_ENV=production`
    - `DATABASE_URL` (from managed Postgres)
    - `BARENTSWATCH_API_KEY` (optional)
    - `KYSTVERKET_API_KEY` (optional)
    - `TWILIO_API_KEY` / `SMTP_*` (for notifications)

5) Auto‑deploy
  - Enable auto‑deploy on push to `main` or choose to deploy from your feature branch.

6) Generating a Render API key (if you want automated resource creation)
  - In Render dashboard: Account → API Keys → Create API Key
  - Copy the token to a safe place.
  - If you provide this token to me, I can try to create services automatically using the Render REST API. If you prefer not to share the token, follow the steps above manually.

7) If you want me to create services automatically
  - Reply with the Render API token (or paste it into a secure channel). I will then run the create calls and configure the web service, db and cron job for you.
  - Alternatively I can produce a ready-to-run script that you run locally with `RENDER_API_KEY` set to create the resources.

Notes
  - The repo already contains `render.yaml` which defines a web service, a cron job and a database placeholder. You can import this spec in Render (Dashboard → New → Import spec) to create resources from the file.
  - I will not store your API key; if you give it to me I will use it only to create the resources and then you can revoke it.
