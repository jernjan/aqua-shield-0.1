# VS Code Copilot Chat Prompt - Copy-Paste Directly

Lim inn EXACTY denne teksten i Copilot Chat-vinduet (Ctrl + Shift + I):

---

Gjør AquaShield ferdig for salg – fikset alle gjenværende problem i én operasjon.

**1. Endre tagline til "Overvåking og varsling for havbruk"**
   - Oppdater `client/src/lib/branding.ts` TAGLINE fra "Overvåking og spredningsreduksjon" til "Overvåking og varsling for havbruk"
   - Oppdater alle steder som bruker TAGLINE (header, footer, meta-tags)

**2. Fiks PDF-rapport – gjør download ekte**
   - Gjør `generatePDFReport()` i `client/src/lib/pdf-report.ts` fullt funksjonell
   - Legg til logo, dato, kart-snapshot, topp 20-tabell, varsler og fartøy-liste
   - Bruk jsPDF og html2canvas riktig – test at PDF faktisk lastes ned
   - Endre knappetekst fra "Last ned PDF-rapport" til "Generer Rapport" og vis success-toast når ferdig

**3. Vis alle ~1 100 anlegg – ingen begrensning**
   - I `client/src/lib/data.ts` `getLiceData()` – fjern alle `.slice(0, 200)` og mock-begrensninger
   - Hent FULL data fra BarentsWatch API uten pagination-limit
   - Fjern mock-data fallback – bruk bare ekte data eller prøv igjen ved feil
   - Logg antall anlegg hentet: console.log(`Hentet ${items.length} anlegg`);

**4. Fiks klikk på anlegg med piler – gjør current-direction piler transparent**
   - I `client/src/components/RiskMap.tsx` – gjør current-direction polyline piler `opacity: 0.1` eller `pointerEvents: 'none'`
   - Sikr at CircleMarker for anlegget selv `pointerEvents: 'auto'` slik at popup fungerer
   - Test: Klikk på anlegg med piler → popup skal dukke opp

**5. Fiks Vessel 108 og lignende – bruk ekte AIS-data**
   - I `client/src/lib/data.ts` `getVesselData()` – hent fra Kystverket AIS API i stedet for mock
   - Endpoint: https://www.barentswatch.no/bwapi/v2/vessel/
   - Map riktig: `type: 'Wellboat' | 'Service' | 'Fishing' | 'Cable'` basert på API
   - Fjern all mock-data (mockVessels) – bruk bare ekte AIS-posisjon og fartøy-type

**6. Legg til admin-side – /admin uten login**
   - Opprett `client/src/pages/Admin.tsx` som viser:
     - Alle anlegg (ingen filter)
     - Alle fartøy
     - "Generer PDF" og "Send varsler til båter" knapper
     - Export data as CSV
   - I `client/src/App.tsx` – legg til route: `<Route path="/admin" component={Admin} />`
   - Ingen auth-sjekk for /admin – den skal være åpen for testing

**7. Gjør alt i én commit**
   - Commit melding: "Final versjon – fikset PDF, alle anlegg, klikk, Vessel, admin-side"
   - Kjør: `npm run build` for å sikre ingen type-feil
   - Push til main

---

Kjør nå. Gjør alt i én operasjon.

