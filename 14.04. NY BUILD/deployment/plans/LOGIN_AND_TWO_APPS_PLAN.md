# Plan: Innlogging + 2 deployede apper

## Mål

1. Innlogging må være på plass.
2. Kun to frontend-apper deployes:
   - `admin` (egen)
   - `main` (samlet båt + anlegg)
3. `main` lar bruker velge rolle/visning: båt eller anlegg.

## Anbefalt arkitektur

- `main` frontend (Cloudflare Pages)
- `admin` frontend (Cloudflare Pages)
- API backend (Render, 1 service)

## Brukerflyt

1. Bruker går til `main` eller `admin`.
2. Login mot API (`/api/auth/login`).
3. API returnerer JWT med roller.
4. Frontend viser kun sider brukeren har rolle til.
5. I `main` får bruker valg mellom:
   - Båt-visning
   - Anlegg-visning

## Foreslåtte roller

- `admin`
- `vessel_user`
- `facility_user`

Eksempel:
- `admin` kan bruke admin-app + eventuelt main.
- `vessel_user` ser kun båtvisning i `main`.
- `facility_user` ser kun anleggsvisning i `main`.

## API-endepunkter (minimum)

- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/refresh` (valgfritt, men anbefalt)

## Frontend-endringer (minimum)

- Ny login-side for `main`
- Ny login-side for `admin`
- Route-guard basert på JWT + rolle
- Rollevelger i `main` etter login

## Deploymentrekkefølge

1. Implementer auth i API
2. Legg inn route-guards i begge frontends
3. Slå sammen båt/anlegg til `main`
4. Deploy `main` + `admin` til Cloudflare Pages
5. Deploy API til Render
6. Sett env vars (`JWT_SECRET`, `ALLOWED_ORIGINS`, `API_BASE_URL`)

## Akseptansekriterier

- Uten login får bruker ikke tilgang til data-sider.
- `main` viser riktig meny/visning for båt/anlegg basert på rolle.
- `admin` er separat URL og krever admin-rolle.
- Lokalkjøring fungerer fortsatt uten tvungen produksjonskonfig.