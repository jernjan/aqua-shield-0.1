# Kyst Monitor DEMO - README

Dette er en kort oppsummering for å ta med videre:

## Oppsett

1. Installer nødvendige Python-pakker:
   ```
   pip install fastapi uvicorn python-dotenv netcdf4
   ```
2. Start serveren fra prosjektmappen:
   ```
   python -m uvicorn src.api.main:app --host 127.0.0.1 --port 0
   ```
   (Bruk port 0 for automatisk valg av ledig port)

3. Åpne dashboardet i nettleseren:
   - Gå til: `http://127.0.0.1:<PORT>/` (bytt ut `<PORT>` med portnummeret som vises i terminalen)

## Filer
- `frontend.html`: Dashboard for visning
- `src/api/main.py`: FastAPI-backend

## Feilsøking
- Sjekk at alle avhengigheter er installert
- Sjekk at serveren starter uten feil
- Sjekk at dashboardet ikke er tomt

---
Dette er kun en enkel start. Resten må tilpasses etter behov og videre utvikling.
