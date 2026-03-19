# Pilot Lite (isolert testprodukt)

**Sist oppdatert:** 19. mars 2026

Denne mappen er en separat, lettvekts testpakke for kunde-demo og rask onboarding.

## Mål
- Beholde eksisterende dashboards urørt.
- Kjøre begrenset profil (typisk opptil 100 båter + 100 anlegg) for høy hastighet.
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

## Status nå
- Pilot Lite er nå mer enn en enkel profilviser; pakken fungerer som en sammenkoblet demo for planlegging mellom anlegg og båt.
- `facility-dashboard-lite.html` og `vessel-dashboard-lite.html` deler nå jobber, forespørsler, kalenderdata, policy og bekreftede ruter via lokale lagre og felles hjelpefiler.
- Løsningen er laget for demo, onboarding og hurtig validering av arbeidsflyt uten å endre hoveddashboardene.
- Kritiske sider og API-er verifiseres via `preflight.ps1` / smoke-testene i denne mappen.

## Hva som er bygget siden sist

### Kort oppsummert
- Facility og Vessel er koblet tettere sammen som én operativ flyt.
- Facility kan opprette og styre jobbetterspørsler, policy og båtutvalg.
- Vessel kan motta, akseptere og hurtigplanlegge disse jobbene.
- Ruteplanlegging, kalender, klarering og demo-metadata er utvidet betydelig.
- Kartene viser nå mer operativ informasjon, inkludert etterspørsel og bedre valg av båt/anlegg.

### Viktigste forbedringer
- Jobbforespørsler fra anlegg kan opprettes, følges opp og aksepteres på båtsiden.
- Vessel-siden har fått totrinns flyt for trygg matching:
  - `1) Velg nærmeste båt`
  - `2) Hurtigplanlegg`
- Hurtigplanlegging legger oppdrag inn på første tilgjengelige dag basert på:
  - båtens kalender
  - anleggets markerte dager
  - valgt ønsket tidspunkt
- Operasjonstid kan redigeres etter at rute er generert.
- Facility kan arbeide med policy på båter per anlegg:
  - foretrukne båter
  - blokkerte båter
  - audit/historikk
  - eksport/import
  - angre siste policy-endring
- Vessel har fått en tydelig operativ statusboks med AIS, planstatus, ruter, kontakt og demo-dokumentasjon.
- Bekreftede ruter telles nå på tvers av actor-store slik at tellerne blir riktigere i demoen.

## Samspill mellom dashboardene

Pilot Lite er nå bygget rundt en felles operativ flyt:

1. Anlegg velger dato/vindu og oppretter jobbforespørsel.
2. Facility vurderer ledige båter basert på AIS, planlagt kapasitet, policy og avstand.
3. Forespørselen publiseres i felles jobblager.
4. Vessel ser etterspørsler fra anlegg i egen høyrekolonne.
5. Vessel kan godta oppdrag direkte, velge nærmeste egnede båt eller hurtigplanlegge til ruteplanleggeren.
6. Rute kan bekreftes, signeres og gi klareringsstatus.
7. Facility får samtidig kalender- og jobbkontekst for videre oppfølging.

Det gjør at demoen kan vise en hel kjede fra behov hos anlegg til gjennomføring på båt.

## Vessel Dashboard Lite

### Formål
`vessel-dashboard-lite.html` er laget for operatør, planlegger eller kaptein som trenger én side for å:
- velge båt
- se aktuell status og AIS
- planlegge ruter mot anlegg
- håndtere innkommende jobber fra anlegg
- dokumentere og signere gjennomføring

Siden er bygget for å vise både operativ kontroll og en demo-verdig arbeidsflate.

### Hovedområder i båtsiden

#### 1. Flåteoversikt og filtrering
- KPI-kort for antall båter, AIS-sporbare båter, klarerte båter, planlagte hendelser, ventende forespørsler og bekreftede ruter.
- Filtre for selskap, AIS-sporbarhet og kategori.
- Hurtigvalg for å fokusere på én bestemt båt.
- Knapp for å hoppe til første planlagte besøk.

#### 2. Båtliste med tilgjengelighet
- Tabell med båt, status, kalender og tilgjengelighetsmodus.
- Manuell tilgjengelighet kan veksles mellom `Auto`, `Ledig` og `Ikke ledig`.
- Status viser både operativ tilstand og AIS-situasjon.
- Valg av båt i tabell eller via filter synkroniserer resten av siden.

#### 3. Kart og anleggsvalg
- Kart med anlegg og filter for normal, risiko og smittet.
- Klikk på anlegg legger dem til eller fjerner dem fra ruteplan.
- Kartet viser produksjonskategori og risikofarger.
- Anlegg som etterspør arbeid markeres med egen etterspørselsindikator.
- Frøy-båter kan velges fra kartet som del av arbeidsflyten.

#### 4. Båtens kalender
- Månedsvisning med markerte dager.
- Dag kan settes til grønn, gul, rød eller nullstilles.
- Valgt dag viser detaljer for hendelser og planlagt arbeid.
- Manuelle hendelser kan opprettes direkte fra båtsiden:
  - besøk
  - operasjon
  - desinfeksjon
  - karantene
- Hendelser kan redigeres i egen modal, inkludert varighet, kommentar og desinfeksjonsrelaterte felt.

#### 5. Ruteplanlegger
- Valg av startdato, avreise og fart.
- Valg mellom sikker og rask rute.
- Liste over valgte anlegg og tilgjengelige anlegg for planlegging.
- Generering av rute med batcher og besøksrekkefølge.
- Operasjonstid per anlegg kan redigeres etter at ruten er generert.
- Ruten kan bekreftes og lagres lokalt/API-basert avhengig av tilgjengelighet.

#### 6. Jobbetterspørsler fra anlegg
- Egen seksjon for alle jobbforespørsler fra facility-siden.
- Filtrering på kommune og nærhet.
- `Kun nærliggende (120 km)` filtrerer bare bort jobber når faktisk avstand er kjent og over grensen.
- Knappene i listen er gjort robuste med både vanlig og delegert håndtering for å tåle rerendering.
- Fra denne listen kan bruker:
  - godta jobb på valgt båt
  - velge nærmeste egnede båt
  - hurtigplanlegge til ruteplanlegger

#### 7. Hurtigplanlegging og nearest-vessel flyt
- Siden støtter trygg totrinns flyt i stedet for helautomatisk planlegging.
- `Velg nærmeste båt` velger nærmeste kvalifiserte båt, ikke bare geometrisk nærmeste punkt.
- `Hurtigplanlegg` finner første tilgjengelige dag og fyller ut planleggeren automatisk.
- Bruker kan deretter gå inn og justere ruten manuelt før bekreftelse.

#### 8. Bekreftede ruter og forespørsler
- Egen oversikt over bekreftede ruter for valgt båt.
- Egen oversikt over båtens utsendte/aktive forespørsler.
- Bekreftede ruter aggregeres nå på tvers av actor-store for mer riktig summering i demo.

#### 9. Operativ båtstatus / hero-kort
- Høyresiden viser et tydelig statuskort for valgt båt.
- Kortet viser blant annet:
  - navn og type
  - selskap
  - status
  - AIS-status
  - MMSI
  - neste besøk
  - ventende forespørsler
  - bekreftede ruter
  - valgte anlegg
  - posisjon og kilde
  - planstart og avreise
- Kortet er visuelt styrket for demo og lettere å lese.

#### 10. Demo-data for bemanning og dokumentasjon
- Demo-felter for mannskap, kontaktperson og telefon/vakt.
- Mulighet for å laste opp helseattest lokalt i nettleseren.
- Informasjonen vises både i statuskortet og i helse/klareringsfeltet.
- Dette er laget for demo og lagres lokalt, ikke som full dokumenthåndtering.

#### 11. Klarering og grønn status
- Klarering kan signeres fra båtsiden.
- Grønn status krever signert rute og fullført:
  - karantene
  - desinfeksjon
- Klarering deles gjennom felles lagring slik at facility-siden også kan bruke informasjonen.

#### 12. AIS og posisjonsfallback
- AIS brukes når tilgjengelig.
- Hvis live AIS mangler, brukes profilposisjon som fallback der det er nødvendig.
- Dette forbedrer filtrering, avstandsberegning og valg av nærmeste båt.

### Når båtsiden brukes i demo
Bruk båtsiden når du vil vise:
- hvordan en operatør velger båt og ser kalender
- hvordan jobber fra anlegg tas imot
- hvordan ruter planlegges og bekreftes
- hvordan dokumentasjon, bemanning og klarering presenteres samlet

## Facility Dashboard Lite

### Formål
`facility-dashboard-lite.html` er laget for driftsleder eller anleggsansvarlig som trenger én side for å:
- velge anlegg
- se risikobilde og driftsstatus
- finne egnede båter
- opprette jobbforespørsler
- styre policy og bookingvindu

Siden er laget for å gjøre anlegget til startpunktet i arbeidsflyten.

### Hovedområder i anleggssiden

#### 1. Mine anlegg
- Liste over anlegg med filter på kommune og aktiv/inaktiv.
- Egen legend for aktiv status, sykdom/sone, etterspørsel og anbefaling.
- Hurtig oppdatering av AIS-data.
- Valg av anlegg styrer resten av panelene.

#### 2. Ledige båter i nærheten
- Viser båter basert på AIS-posisjon, planlagt tilgjengelighet og valgt tidsrom.
- Filtrering på:
  - søk båt/MMSI
  - båttype
  - policy-status
  - kun ledige
  - radius
  - dato og sluttdato
  - ønsket tidspunkt
  - operasjonstid
- Båtlisten skiller mellom AIS-bilde nå og planlagt tilgjengelighet.
- Målet er å gjøre det mulig å velge riktig båt før man sender forespørsel.

#### 3. Policy per anlegg
- Facility kan merke båter som foretrukne eller blokkerte.
- Policy lagres lokalt per anlegg.
- Det finnes støtte for:
  - policy-historikk
  - eksport av policy for valgt anlegg
  - eksport av policy for alle anlegg
  - import av policy fra JSON
  - angre siste policy-endring
  - re-sync av jobber mot oppdatert policy
- Dette gjør demoen sterkere for governance og sporbarhet.

#### 4. Interoperabilitet og eksport
- Facility kan eksportere:
  - jobber som CSV
  - synlige båter som CSV
  - policyhistorikk
  - samlet interoperabilitetspakke
- Siden viser også siste registrerte interoperabilitetsaktivitet for valgt anlegg.
- Dette gjør det enklere å vise håndoff mellom systemer og team i demo.

#### 5. Kart, risiko og nærområde
- Kart med anlegg og risikofarger for normal, ILA-vernesone, overvåkning, smittet og lus.
- Egen visning for nærliggende anlegg.
- Eget panel for nærliggende risiko med kategorier for:
  - sykdom/smitte
  - lakselus
  - BarentsWatch-risiko
  - AIS-risikobåter
  - signert grønne båter
- Anleggssiden er dermed både et planleggingsverktøy og et situasjonsbilde.

#### 6. Kalender for valgt anlegg
- Kalenderen aktiveres når et anlegg velges.
- Dager kan markeres som ledige eller opptatte.
- Valgt dag brukes som bookinggrunnlag i videre jobbflyt.
- Kalenderen viser planlagte og importerte besøk.
- Det finnes egen 7-dagers plan under kalenderen.
- Anleggssiden kan også lese relevante hendelser fra felles båtkalender der det er kobling.

#### 7. Auto-oppsett og auto-genererte etterspørsler
- Facility kan slå på regler som genererer forslag til jobber eller oppfølging.
- Eksempler på regler:
  - lusefrist
  - B-undersøkelse NS 9410
  - sykdomstest-vindu
  - biomasse over terskel
  - månedlig vannkvalitet
- Forslagene kan brukes direkte i jobbforespørsel-flyten.

#### 8. Opprett jobbforespørsel
- Eget panel for å opprette jobber fra anleggssiden.
- Støtter blant annet:
  - jobbtype
  - senest innen-dato
  - fleksibilitet
  - prioritet
  - foretrukket tidspunkt
  - estimert timebruk
  - notat
- Opprettede jobber vises i listen `Mine besøk` med statusfilter.
- Jobbene deles med vessel-siden via felles jobblager.

#### 9. Jobbstatus og forslag
- Facility bruker jobbstatus gjennom flere steg, som for eksempel:
  - opprettet
  - forslag sendt
  - godtatt
  - pågår
  - fullført
  - avbrutt
- Jobber kan inneholde forslag til båter og policy-snapshot.
- Det finnes også støtte for å oppdage `policy drift` mellom opprinnelig jobb og nåværende policy.

#### 10. Valgt anlegg og driftsstatus
- Eget nøkkelinfopanel for valgt anlegg.
- Driftstatus-panel viser beregnede varsler og systemtolket tilstand.
- Risikovurdering vises som komprimert smitte/lus-rubrikk.
- Dette gjør siden egnet både til operativ bruk og ledelsesdemo.

### Når anleggssiden brukes i demo
Bruk anleggssiden når du vil vise:
- hvordan anlegg vurderer risiko og kapasitet
- hvordan riktige båter finnes i nærområdet
- hvordan policy styrer hvilke båter som er aktuelle
- hvordan anlegg oppretter behov som går videre til båtsiden

## Delte lagre og viktige støttefiler

Pilot Lite bruker flere delte lokale lagre og hjelpefiler for å binde workflowen sammen:

- `app/job-store.js`
  - felles jobb- og forslagshåndtering mellom facility og vessel
- `app/pilot-shared-store.js`
  - delt lagring for klareringer og bekreftede ruter
- `app/lite-map.js`
  - felles kartlogikk og markører
- `pilotLiteVesselCalendarV2`
  - lokal kalender for båter
- `pilotLiteVesselPlannerStateV2`
  - lokal ruteplanlegger-state
- `facilityOperatorPrefsV1` / audit-relaterte nøkler
  - lokal policy og historikk på anleggssiden

Dette betyr at mye av demoopplevelsen fungerer selv med lokal fallback, så lenge frontend er startet og profilfilen er gyldig.

## Onboarding (mål: ~1 time)
1. Oppdater `data/profile.json` med båter/anlegg for kunden.
2. (Valgfritt, anbefalt) Utvid med nærliggende anlegg én gang:

`python expand-nearby-facilities.py --api-base http://localhost:8000 --radius-km 20`

Dette legger til nærliggende anlegg i profilen og unngår at dashboards må beregne hele kysten ved hver sidevisning. Anbefalt radius: 20 km.
3. Kjør `python validate-profile.py`.
4. Start siden med `./start-pilot-lite.ps1`.
5. Åpne:
  - `http://localhost:8085/index.html`
  - `http://localhost:8085/vessel-dashboard-lite.html`
  - `http://localhost:8085/facility-dashboard-lite.html`

## Portable / minnepenn
Kjør:

`./package-pilot-lite.ps1 -CreateZip`

Dette lager en komplett, separat pakke i `_portable_out/` som kan kopieres direkte til minnepenn.

## Render (gratis) – rask publisering
For å teste med venner/brukere kan du publisere frontend som statisk side på Render.

### Klar oppskrift
1. Push repo til GitHub.
2. I Render: **New +** → **Blueprint**.
3. Velg repoet og deploy med `render.yaml` i repo-roten.
4. Når frontend er oppe, åpne:
  - `/system-check.html` først
  - deretter `/vessel-dashboard-lite.html` og `/facility-dashboard-lite.html`

### Viktig for API
- Frontend bruker automatisk `https://kyst-api.render.com` når hosten er `render.com`.
- API må tillate CORS fra frontend-domenet ditt på Render.

### Enkel smoke-test etter deploy
1. Åpne `system-check.html` og bekreft at hovedendepunkter svarer.
2. Test ruteflyt i vessel-dashboard.
3. Test kalender/jobbflyt i facility-dashboard.
4. Registrer observasjoner med innebygget feedback-widget og samle alt i `feedback-inbox.html`.

For en kort før-lansering gjennomgang, bruk `GO_LIVE_CHECKLIST.md` i samme mappe.
For rask ekstern testing, bruk `TEST_BRIEF_10_MIN.md` som meldingsmal til testere.

### CLI-smoketest (anbefalt)
Kjør fra `pilot-lite` mappen:

`./smoke-test-render.ps1 -BaseUrl https://<din-frontend>.onrender.com`

Scriptet sjekker både frontend-sider og kritiske API-endepunkter, og returnerer feilkode `1` ved kritisk fail.

Merk: standard `ApiBase` i script er nå `http://localhost:8000` (for lokal pre-render test).
For Render-test, angi API-base eksplisitt:

`./smoke-test-render.ps1 -BaseUrl https://<din-frontend>.onrender.com -ApiBase https://<din-api>.onrender.com`

For å kjøre lokal + Render i én kommando:

`./smoke-test-all.ps1 -RenderBaseUrl https://<din-frontend>.onrender.com -ApiBase https://<din-api>.onrender.com`

Kun lokal test:

`./smoke-test-all.ps1 -SkipRender`

### Preflight (READY/NOT READY)
Kjør automatisk preflight og få rapportfil:

`./preflight.ps1 -RenderBaseUrl https://<din-frontend>.onrender.com -ApiBase https://<din-api>.onrender.com`

Resultat skrives til `PREFLIGHT_REPORT.md` i `pilot-lite` mappen.

## API override i frontend (Render)
Dashboardene støtter API override via query-param `apiBase` og lagrer verdien i `localStorage`.

Eksempel første åpning:

`https://<din-frontend>.onrender.com/vessel-dashboard-lite.html?apiBase=https://<din-api>.onrender.com`

Etter første åpning brukes samme API-base videre i pilot-sidene i samme nettleser.

## Testgjennomføring (3 dager)
Bruk disse filene for den praktiske testplanen:

- `TEST_PLAN_3_DAYS.md` – Dag 1 smoke, dag 2 workflow, dag 3 stabilitet, inkl. go/no-go
- `DAILY_TEST_LOG_TEMPLATE.md` – daglig loggmal for funn og konklusjon

Godkjenningskriterium:
- ingen blokkende feil i kjerneflyt
- tydelig fallback-melding ved API-problemer

## Datakontrakt (kort)
- `scope` (valgfri):
  - `maxVessels`: anbefalt maks antall båter i profil (default: `100`)
  - `maxFacilities`: maks antall anlegg i profil (`0` = ingen grense)
  - Brukes av `validate-profile.py` for å varsle om for stor profil
- `vessels[].mmsi`:
  - Tallstreng for AIS-tracking (eks. `"257075200"`)
  - `null` hvis ukjent (vises i kalender, men ikke trackes live)
- `facilities[].localityNo`:
  - Tallstreng når kjent
  - `null` hvis kun navn er kjent
