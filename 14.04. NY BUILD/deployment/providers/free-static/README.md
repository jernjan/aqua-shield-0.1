# Gratis statisk hosting (anbefalt)

Anbefalt for frontend:
- Cloudflare Pages

Foreslått prosjektoppsett:
- `kyst-main` = hovedside for operatørbruker (velg båt eller anlegg etter innlogging)
- `kyst-admin` = separat admin-side

Strategi:
1. Host begge frontend-prosjekter statisk på Cloudflare Pages
2. Koble mot backend-API via miljøvariabel (`API_BASE_URL`)
3. Kjør backend som én Render web service (API)
4. Kjør periodisk datainnsamling via GitHub Actions cron

Hvorfor denne kombinasjonen:
- Lav kostnad (frontend gratis)
- Render brukes kun der det trengs (API/runtime)
- Unngår begrensning med mange Render-tjenester

Merk:
- Klient-side prosessering virker kun når en bruker har siden åpen.
- Kontinuerlig innsamling av karantenebrudd må kjøre i backend/job.
