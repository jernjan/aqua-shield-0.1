# Changelog – Pilot Lite · Mars 2026

> Kronologisk oversikt over alt som er gjort i Pilot Lite-pakken i mars 2026.
> Sist oppdatert: 19. mars 2026.

---

## 19. mars 2026 – Rute-telling, hero-kort og dokumentasjon

### Bugfiks: Bekreftede ruter talt feil
- `getConfirmedRoutesForSelected()` i `vessel-dashboard-lite.js` brukte kun `getRoutePlans()` med én fast actor-nøkkel (`pilotActor`). Ruter lagret under andre actor-nøkler ble aldri talt med.
- **Løsning:** Ny hjelpefunksjon `getConfirmedRoutesForVessel(vessel, routePlans)` som kaller `getAllRoutePlans(profileName)` og slår sammen ruter fra alle aktører. Duplikater fjernes via `plan.id`, og listen sorteres nyeste-først.
- `renderCards()` kaller nå `getAllRoutePlans()` én gang og sender resultatet videre til per-båt-kall – unngår gjentatte localStorage-oppslag.
- `getAllRoutePlans` lagt til i import-listen øverst i `vessel-dashboard-lite.js`.

### UI: Vessel hero-kort (høyre rail)
- `.vessel-hero-card` i `dashboard-lite.css` fått sterkere ramme (`#93c5fd`), rikere blå gradient, skygge (`box-shadow: 0 14px 28px rgba(30,64,175,0.12)`) og `overflow: hidden`.
- Ny pseudo-element `::before` gir et 5 px blå-til-teal accent-stripe langs venstre kant.
- `.vessel-hero-card.empty` beholder nøytral stil uten skygge.
- Ny CSS-klasse `.vessel-hero-stat.split` – to-kolonnes CSS-grid for å vise Posisjon og Planstart side om side.
- `@media (max-width: 720px)`: split kollapser til én kolonne på smale skjermer.

### HTML: `vessel-dashboard-lite.html`
- Seksjonstittelen endret fra «Valgt båt» til **«Operativ båtstatus»**.
- Undertekst endret til «Valgt båt, posisjon og planstatus.»
- `selectedVesselMetaRail`-paragrafen skjult som standard (`hidden`-attributt) – duplikatinfo i hero-kortet.
- Position + Planstart-stats slått sammen til én `split`-rad i hero-kortmalen.
- Cache-bust-versjon bumped: `20260319ak` → `20260319al`.

### Dokumentasjon
- `pilot-lite/README.md` utvidet fra ~123 til ~427 linjer:
  - Ny seksjon «Status nå»
  - Ny seksjon «Hva som er bygget siden sist»
  - Ny seksjon «Samspill mellom dashboardene» (7-stegs arbeidsflyt)
  - Fullstendig kapittel «Vessel Dashboard Lite» med 12 nummererte underseksjoner
  - Fullstendig kapittel «Facility Dashboard Lite» med 10 nummererte underseksjoner
  - Tabell over delte lagre og støttefiler
- `14.04. NY BUILD/README.md` oppdatert:
  - «Last Updated» satt til 19. mars 2026
  - Ny underseksjon «Pilot Lite status (March 19, 2026)» under Latest Changes
  - Utvidet beskrivelse av Pilot Lite-omfang

### Smoke-test
- `preflight.ps1 -SkipRender` kjørt etter alle endringer: **9/9 tester bestått** (HTTP 200 på alle frontend-sider og API-endepunkter).

---

## Tidligere i mars 2026

### Vessel Dashboard Lite – operasjonell status
- Hero-kort for valgt båt lagt til i høyre rail med live-oppdatering fra AIS + plandata.
- Kalender-basert tilgjengelighetsvisning implementert (availability windows).
- Jobbforespørsler fra anlegg (facility-dashboard) kan aksepteres/avvises direkte i vessel-dashboard.
- Clearance-signering lagt til i høyre rail – pilot kan bekrefte og signere klarering med ett klikk.
- Ruteplanlegger med validering mot policy-parametere (avstand, tid, bølgehøyde).

### Facility Dashboard Lite – jobbflyt
- Firetrinns jobbflyt implementert: Opprett → Send til båt → Båt bekrefter → Fullfør.
- Job-store (`job-store.js`) delt mellom facility og vessel via localStorage.
- Anleggsinfo-panel viser sanntidsstatus for aktive jobber og historikk.
- Lus-data og sone-informasjon integrert i anleggskortet.
- Clearance-request sendes automatisk til pilot ved jobbaksept.

### Delte komponenter
- `pilot-shared-store.js`: Multi-actor arkitektur for clearances og ruteplaner.
- `shared-colors.js`, `shared-roles.json`, `shared-glossary.json`: Felles fargepalett, roller og begrepsordliste brukt på tvers av alle dashboarder.
- `role-system.js`: Tilgangskontroll basert på rolle (pilot, anlegg, admin).
- `auto-load-manager.js`: Automatisk lasting av profil og data ved oppstart.

---

*Filen vedlikeholdes manuelt. For tekniske detaljer, se `README.md` i samme mappe.*
