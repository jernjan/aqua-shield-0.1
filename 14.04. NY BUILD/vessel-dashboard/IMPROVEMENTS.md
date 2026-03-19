# Vessel Dashboard - Forbedringer

Implementert 3 nye features på båtsiden (vessel dashboard):

## 1. ✅ Klarert-Status

**Handling:** Etter logging av desinfeksjon → vis "Klarert til neste besøk" på dashboard og i kalender.

**Implementasjon:**
- Ny funksjon: `CalendarView.isVesselCleared()`
  - Sjekker at ALLE smittede anlegg har bekreftet desinfeksjon
  - Returnerer `true` hvis båten er klar for neste besøk
  
- Ny funksjon: `CalendarView.getVesselStatus()`
  - Returnerer status object med:
    - `status`: 'cleared' | 'quarantine' | 'pending'
    - `text`: Displaytekst ("✅ Klarert til neste besøk")
    - `description`: Undertekst ("Alle protokoller fullført")
    - `indicator`: CSS class for styling

**Files modifisert:**
- `calendar-advanced.js` - Nye status-funksjoner
- `vessel-simple.js` - `updateStatusDisplay()` bruker nå `CalendarView.getVesselStatus()`
- `index.html` - Status-panelet oppdaterer dynamisk basert på calendar events

**Eksempel:**
```javascript
// Før: static "Klar til besøk"
// Etter: Dynamisk basert på events
// ✅ Klarert til neste besøk → Alle protokoller fullført
// OR
// ⚠️ Avventer desinfeksjon → Besøk på smittet anlegg må bekreftes
// OR  
// ⏱️ Karantene aktiv → 47h 30m igjen
```

---

## 2. ⏱️ Karantene-Nedteller på Dashboard

**Handling:** Legg til teller øverst: "Karantene aktiv: 47h igjen" (teller ned fra logget besøk). Bytt status til gul/rød mens aktiv.

**Implementasjon:**
- Ny funksjon: `CalendarView.getActiveQuarantineHours()`
  - Finner den mest nylige aktive karantenen
  - Beregner gjenstående timer og minutter
  - Returnerer 0 hvis ingen aktiv karantene
  
- Ny funksjon: `startQuarantineCounter()` (vessel-simple.js)
  - Starter en interval som oppdaterer displayet hvert sekund
  - Viser nedteller i HTML element `#quarantineCounter`
  
- Ny funksjon: `updateQuarantineDisplay()` (vessel-simple.js)
  - Formaterer tid som "47h 30m"
  - Skjuler counter når karantenen utløper
  - Endrer status-indikator farge til orange mens aktiv

**HTML Element:**
```html
<div id="quarantineCounter">
  <div id="quarantineText">⏱️ Karantene aktiv</div>
  <div id="quarantineTimer">47h 30m</div>
</div>
```

**Styling:**
- Background: `#fef3c7` (light yellow)
- Border: `2px solid #f59e0b` (amber)
- Timer tekst: Stor og bold (`font-size: 1.5rem`)

**Files modifisert:**
- `calendar-advanced.js` - `getActiveQuarantineHours()` funksjon
- `vessel-simple.js` - `startQuarantineCounter()` og `updateQuarantineDisplay()`
- `index.html` - HTML struktur for quarantine counter

---

## 3. 🚢 ETA-Justering (Båtfart = 10 Knop)

**Handling:** Sett fast båtfart til 10 knop (18.5 km/t) → da blir 87.8 km til ca. 4.7 timer (282 min), ikke 287 min med bilhastighet.

**Status:** ✅ ALLEREDE IMPLEMENTERT

**Verifisering:**
- `routes-planner.js` linje 46: `const boatSpeedKmPerHour = 18.52;`
- 10 knop = 10 × 1.852 km/h = **18.52 km/h** ✓

**ETA Beregning:**
```javascript
estTimeMinutes = (distanceKm / 18.52) * 60
// Eksempel: 87.8 km ÷ 18.52 km/h × 60 min/h = 284 min ≈ 4.7 timer
```

**Files:**
- `routes-planner.js` - `buildRoute()` funksjon

---

## Flyt-Diagram

```
1. Bruker logger besøk på smittet anlegg
   ↓
2. System foreslår desinfeksjon + karantene (48h min)
   ↓
3. Status: "⚠️ Avventer desinfeksjon"
   ↓
4. Bruker bekrefter desinfeksjon i kalender
   ↓
5. Karantene-nedteller starter (47h 30m)
   Status: "⏱️ Karantene aktiv" (gul)
   ↓
6. Timer teller ned hvert sekund
   ↓
7. Karantene utløper
   ↓
8. Status: "✅ Klarert til neste besøk" (grønn)
   Nedteller skjules
```

---

## Testing

### Test 1: Status Transitions
1. Åpne vessel dashboard
2. Planlegg rute med smittet anlegg
3. Bekreft desinfeksjon → status skal bli "✅ Klarert"
4. Angrebok desinfeksjon → status skal bli "⚠️ Avventer"

### Test 2: Karantene Nedteller
1. Planlegg rute med smittet anlegg
2. Bekreft desinfeksjon
3. Karantene-counter skal dukke opp
4. Counter skal telle ned hvert sekund
5. Når counter når 0 → skal skjules igjen

### Test 3: ETA Beregning
1. Planlegg rute
2. Se på ETA i route preview
3. Sjekk at tiden er beregnet med 18.52 km/h

---

## API Endpoints Brukt

Ingen nye API endpoints nødvendig - alt baseres på client-side calendar events som lagres i localStorage.

**Data flow:**
```
localStorage (calendarEvents)
    ↓
CalendarView.getVesselStatus()
    ↓
updateStatusDisplay() + updateQuarantineDisplay()
    ↓
HTML dashboard
```

---

## Framtidsvisions

1. **Anlegg-godkjenning:** Når båten er "✅ Klarert", kan anlegg se dette og godkjenne besøk
2. **Notifikasjoner:** Push notifications når karantene går ut eller desinfeksjon forfaller
3. **Historikk:** Lagre fullt historikk av alle desinfeksjoner/karantener for audit
4. **Multi-båt:** Utvid til å håndtere flere båter

---

## Files Modified

```
vessel-dashboard/
├── calendar-advanced.js
│   ├── isVesselCleared() 
│   ├── getActiveQuarantineHours()
│   ├── getVesselStatus()
│   ├── markCompleted() [updated]
│   └── markUncompleted() [updated]
├── vessel-simple.js
│   ├── initDashboard() [updated]
│   ├── updateStatusDisplay() [completely rewritten]
│   ├── startQuarantineCounter() [new]
│   └── updateQuarantineDisplay() [new]
└── index.html
    └── Status panel [updated with quarantine counter HTML]
```
