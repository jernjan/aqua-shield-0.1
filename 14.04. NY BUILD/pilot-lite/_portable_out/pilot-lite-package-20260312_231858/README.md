# Pilot Lite (isolert testprodukt)

Denne mappen er en separat, lettvekts testpakke for kunde-demo og rask onboarding.

## Mål
- Beholde eksisterende dashboards urørt.
- Kjøre liten profil (typisk 10 båter + 10 anlegg) for høy hastighet.
- Kun bytte datafil for ny kundeprofil.

## Filer
- `index.html` – startside for hele pilotpakken
- `data/profile.json` – kundepakke (selskap, båter, anlegg, kalenderhendelser)
- `vessel-dashboard-lite.html` – inngang for båt-orientert visning
- `facility-dashboard-lite.html` – inngang for anlegg-orientert visning
- `ops-lite.html` – operativ oversikt for liten profil
- `calendar-lite.html` – kalenderoversikt + iCal-eksport
- `validate-profile.py` – validerer profile.json før demo
- `start-pilot-lite.ps1` – starter statisk server på port 8085
- `package-pilot-lite.ps1` – lager portable kopi (og valgfri zip) for minnepenn

## Onboarding (mål: ~1 time)
1. Oppdater `data/profile.json` med båter/anlegg for kunden.
2. Kjør `python validate-profile.py`.
3. Start siden med `./start-pilot-lite.ps1`.
4. Åpne:
  - `http://localhost:8085/index.html`
  - `http://localhost:8085/vessel-dashboard-lite.html`
  - `http://localhost:8085/facility-dashboard-lite.html`

## Portable / minnepenn
Kjør:

`./package-pilot-lite.ps1 -CreateZip`

Dette lager en komplett, separat pakke i `_portable_out/` som kan kopieres direkte til minnepenn.

## Datakontrakt (kort)
- `vessels[].mmsi`:
  - Tallstreng for AIS-tracking (eks. `"257075200"`)
  - `null` hvis ukjent (vises i kalender, men ikke trackes live)
- `facilities[].localityNo`:
  - Tallstreng når kjent
  - `null` hvis kun navn er kjent
