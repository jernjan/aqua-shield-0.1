# Deployment (isolert fra lokal utvikling)

Denne mappen inneholder kun deployment-relaterte templates og notater.
Ingen av filene her påvirker lokal kjøring før du aktivt kobler dem inn.

## Anbefalt løsning nå

For lav kostnad + enkel drift:

- Frontend: **Cloudflare Pages** (2 prosjekter)
	- `main` (samlet båt + anlegg med rollevalg)
	- `admin` (egen side)
- API: **Render** (1 web service for backend)
- Jobb: **GitHub Actions cron** for periodisk innsamling av karantenebrudd

Dette gir gratisvennlig oppsett uten å låse alt til Render.

## Struktur

- `env/` – eksempler på miljøvariabler
- `providers/render/` – Render-template for API
- `providers/free-static/` – statisk hosting-notater
- `jobs/github-actions/` – planlagt cron-jobb for datainnsamling
- `plans/` – konkrete implementasjonsplaner

## Viktig prinsipp

Lokal utvikling fortsetter uendret.
Deployment styres via miljøvariabler (`API_BASE_URL`, `DATABASE_URL`, `JWT_SECRET`, osv.), ikke hardkodet plattformlogikk.
