# Pilot Lite – 3-dagers testplan

## Mål
Verifisere at kjerneflyten fungerer stabilt før bredere brukertest:
- ingen blokkende feil i kjerneflyt
- tydelig fallback-melding ved API-problemer

## Miljø før oppstart
- Frontend URL: `https://<din-frontend>.onrender.com`
- API URL: `https://kyst-api.render.com`
- Kjør preflight: `./preflight.ps1 -RenderBaseUrl https://<din-frontend>.onrender.com`

---

## Dag 1 – Smoke test
Fokus: load, API-chip, kart, AIS refresh, jobbopprettelse.

### Teststeg
- [ ] Åpne `index.html` uten feil i lasting
- [ ] Åpne `system-check.html` og kjør sjekk (kritiske sjekker OK)
- [ ] Åpne `vessel-dashboard-lite.html`:
  - [ ] side laster
  - [ ] kart vises
  - [ ] AIS-meta/posisjon oppdateres ved refresh/valg av båt
- [ ] Åpne `facility-dashboard-lite.html`:
  - [ ] side laster
  - [ ] kart vises
  - [ ] opprett én jobbforespørsel
  - [ ] jobb vises i liste med riktig status

### Pass/Fail dag 1
- [ ] PASS
- [ ] FAIL
- Notater:

---

## Dag 2 – Workflow test
Fokus: facility → request, vessel → accept/share, kalender-sync.

### Teststeg
- [ ] Facility: opprett ny request med realistiske felter
- [ ] Vessel: finn request som matcher og aksepter
- [ ] Vessel: bruk share-flyt for besøk/hendelse
- [ ] Bekreft at kalender oppdateres på relevant side
- [ ] Verifiser at statusfelt/varsler oppdateres riktig etter aksept/deling

### Kritisk kontroll
- [ ] Ingen manuell side-reload er nødvendig for å fullføre kjerneflyten
- [ ] Tids-/datofelter viser forventet verdi etter sync

### Pass/Fail dag 2
- [ ] PASS
- [ ] FAIL
- Notater:

---

## Dag 3 – Stabilitetstest
Fokus: cold start, refresh, ny browser, mobilvisning, feilscenario.

### Teststeg
- [ ] Cold start: første lasting etter inaktiv periode
- [ ] Hard refresh i aktiv sesjon
- [ ] Test i ny browser/privat vindu (ren local state)
- [ ] Mobilvisning (responsiv): åpne vessel/facility/system-check
- [ ] Feilscenario: API delvis utilgjengelig (eller simulert timeout)

### Fallback-krav
- [ ] Bruker får tydelig melding ved API-problem
- [ ] UI forblir brukbar uten total lås
- [ ] Det er forståelig hva som mangler (kilde/helsechip/status)

### Pass/Fail dag 3
- [ ] PASS
- [ ] FAIL
- Notater:

---

## Endelig godkjenning (go/no-go)
Godkjent når begge er oppfylt:
- [ ] Ingen blokkende feil i kjerneflyt
- [ ] Tydelig fallback-melding ved API-problemer

## Beslutning
- [ ] GO
- [ ] NO-GO
- Eier:
- Dato:
- Kommentar:
