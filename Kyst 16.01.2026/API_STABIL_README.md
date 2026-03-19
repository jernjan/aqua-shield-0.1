# Kyst Monitor API - Stabil løsning

## Oppstart

Start alltid backend med denne kommandoen fra rotmappen:

```
$env:PYTHONPATH="."; python -m uvicorn src.api.main:app --host 127.0.0.1 --port 8004
```

## API-ruter (faste)

- **Status:**
  - GET /api/dashboard/status
  - Svar: { "status": "ok", "message": "API-server kjører" }
- **Testdata for dashboard:**
  - GET /api/dashboard/facility/10001
  - Svar: Testdata for anlegg 10001

## Frontend

- Frontend.html skal alltid bruke:
  - `http://127.0.0.1:8004/api/dashboard/facility/10001`

## Feilsøking

- Sjekk status: Åpne http://127.0.0.1:8004/api/dashboard/status i nettleser
- Sjekk testdata: Åpne http://127.0.0.1:8004/api/dashboard/facility/10001
- Sjekk at backend-terminal viser "Uvicorn running..."

## Endringspolicy

- API-ruter og port endres kun etter avtale.
- Testdata beholdes for utvikling.
- Dokumentasjonen oppdateres ved endringer.

---

Denne README sikrer stabil API og enkel feilsøking. Kontakt ansvarlig før endringer!
