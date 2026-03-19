# 📅 REALISTISK RUTEPLANLEGGING - Oppdatering 17. februar 2026

## 🎯 Problem løst

**TIDLIGERE:** Systemet godkjente å legge ALLE anlegg (inkl. flere smittede) i kalenderen samme dag, selv om dette er umulig pga. 48-timers karantene mellom smittebesøk.

**NÅ:** Automatisk oppdeling av ruter i realistiske "økter/dager" med karantenetid mellom.

---

## 🔄 Ny funksjona litet

### Eksempel: 10 anlegg (8 grønne, 1 oransje, 1 rødt)

**TIDLIGERE (UREALISTISK):**
```
DAG 1: Alle 10 anlegg besøkt ❌
→ Umulig i virkeligheten!
```

**NÅ (REALISTISK):**
```
📅 DAG 1:
  - Valøyan (grønn)
  - Mannbruholmen (grønn)
  - Grøttingsøy (oransje)  ← Desinfeksjon påkrevd
  
⏳ KARANTENE: 48 timer (desinfeksjon + ventetid)

📅 DAG 4:
  - Slettholmene (grønn)
  - Heggsøy (grønn)
  - Reitholmen (rød - smittet)  ← Desinfeksjon påkrevd
  
⏳ KARANTENE: 48 timer

📅 DAG 7:
  - 4 grønne anlegg
```

---

## 📊 Teknisk implementering

### 1. Ny `splitRouteIntoBatches()` funksjon

Deler ruten inn i "batches" basert på smittestatus:

```javascript
function splitRouteIntoBatches(facilities, start, boatSpeedKmPerHour, mode) {
  const batches = [];
  let currentDay = 1;
  
  while (remaining.length > 0) {
    const batch = {
      day: currentDay,
      facilities: [],
      totalDistance: 0,
      totalTimeMinutes: 0,
      hasInfected: false,
      needsQuarantine: false
    };
    
    // Besøk alle grønne anlegg først
    // Deretter MAKS 1 smittet/oransje anlegg
    
    if (batch.needsQuarantine && remaining.length > 0) {
      currentDay += 3; // 48t karantene ≈ 2-3 dager
    }
  }
  
  return { batches, totalDays, hasQuarantine };
}
```

**Logikk:**
- ✅ Hver batch inneholder flere grønne anlegg
- ✅ Maks 1 smittet/oransje anlegg per batch (kommer sist)
- ✅ Etter smittet besøk: +3 dager (48t karantene)
- ✅ Geografisk optimalisering innenfor hver batch

---

### 2. Oppdatert `displayPlannedRoute()`

Viser nå batches med separate dager:

```javascript
function displayPlannedRoute() {
  // ...
  
  batches.forEach((batch, idx) => {
    html += `
      📅 DAG ${batch.day} ${batch.hasInfected ? '🔴' : '🟢'}
      → ${batch.facilities.length} anlegg | ${batch.totalDistance.toFixed(1)} km
    `;
    
    // Vis alle anlegg i denne batchen
    batch.facilities.forEach(facility => { /* ... */ });
    
    // Vis karanteneperiode hvis nødvendig
    if (batch.needsQuarantine && !isLastBatch) {
      html += `⏳ KARANTENE: 48 timer`;
    }
  });
}
```

**Visning:**
- 📅 Dag 1, Dag 4, Dag 7 osv.
- 🟢 Grønn hvis bare friske anlegg
- 🔴 Rød hvis smittet anlegg inkludert
- ⏳ Karanteneperiode vist tydelig

---

### 3. Oppdatert `addPlannedRouteToCalendar()`

Legger nå til hver batch på riktig dag:

```javascript
function addPlannedRouteToCalendar() {
  const startDate = new Date(dateInput.value);
  
  plannedRoute.batches.forEach((batch, idx) => {
    // Beregn faktisk dato for denne batchen
    const batchDate = new Date(startDate);
    batchDate.setDate(batchDate.getDate() + (batch.day - 1));
    
    // Legg til i kalender
    CalendarView.addEvent({
      date: batchDate,
      title: `Rute Dag ${batch.day} (${batch.facilities.length} anlegg)`,
      type: batch.hasInfected ? 'infected-visit' : 'visit',
      facilities: batch.facilities
    });
    
    // Legg til karantenedager
    if (batch.needsQuarantine) {
      // Legg til 2 dager karantene i kalenderen
    }
  });
}
```

**Resultat:**
- ✅ Batch 1 på valgt startdato
- ✅ Batch 2 på startdato + 3 dager (hvis karantene)
- ✅ Karantenedager vises i kalenderen

---

### 4. Oppdatert `executeRoute()`

Håndterer ny batch-struktur:

```javascript
function executeRoute() {
  const firstBatch = plannedRoute.batches[0];
  const firstDestination = firstBatch.facilities[0];
  
  // Flatten alle anlegg for lagring
  const allFacilities = [];
  plannedRoute.batches.forEach(batch => {
    allFacilities.push(...batch.facilities);
  });
  
  showToast(
    `🚀 Rute startet! ${allFacilities.length} anlegg over ${plannedRoute.totalDays} dager`,
    'success'
  );
}
```

---

## 📋 Datastruktur

### Gammel struktur (flat array):
```javascript
plannedRoute = [
  { name: 'Anlegg 1', infected: false },
  { name: 'Anlegg 2', infected: true },
  { name: 'Anlegg 3', infected: false }
]
```

### Ny struktur (batches):
```javascript
plannedRoute = {
  batches: [
    {
      day: 1,
      facilities: [
        { name: 'Anlegg 1', infected: false },
        { name: 'Anlegg 2', infected: true }
      ],
      totalDistance: 12.5,
      totalTimeMinutes: 45,
      hasInfected: true,
      needsQuarantine: true
    },
    {
      day: 4,  // 3 dager senere pga. karantene
      facilities: [
        { name: 'Anlegg 3', infected: false }
      ],
      totalDistance: 5.2,
      totalTimeMinutes: 18,
      hasInfected: false,
      needsQuarantine: false
    }
  ],
  totalDays: 4,
  hasQuarantine: true
}
```

---

## 🎨 Brukergrensesnitt

### Ruteoversikt viser nå:

```
📍 Planlagt rute
8 anlegg | 45.3 km | 180 min kjøretid | 📅 7 dager totalt

⚠️ VIKTIG: Ruten krever karantenetid (48t) mellom besøk til smittede anlegg

───────────────────────────────────────

📅 DAG 1 🟢
→ 4 anlegg | 15.2 km | 55 min

1. Valøyan (FRISK) → +0.0 km
2. Mannbruholmen (FRISK) → +3.7 km (~12 min)
3. Grøttingsøy (FRISK) → +0.6 km (~2 min)
4. Slettholmene (SMITTET) → +8.3 km (~27 min)
   💉 Sykdom: PANKREASSYKDOM
   🧪 DESINFEKSJON PÅKREVD etter besøk

⏳ KARANTENE: 48 timer (desinfeksjon + ventetid)
Neste besøk: Dag 4 (om 3 dager)

───────────────────────────────────────

📅 DAG 4 🟢
→ 4 anlegg | 22.1 km | 78 min

1. Heggsøy (FRISK) → +12.5 km (~45 min)
2. Reitholmen (FRISK) → +5.7 km (~20 min)
...
```

---

## ✅ Testscenarioer

### Scenario 1: Bare grønne anlegg
```
Input: 5 grønne anlegg
Output: 1 batch, 1 dag
```

### Scenario 2: 1 rødt + 3 grønne
```
Input: 3 grønne, 1 rødt
Output: 1 batch, 1 dag
(Rødt anlegg kommer sist i batchen)
```

### Scenario 3: 2 røde + 3 grønne
```
Input: 3 grønne, 2 røde
Output: 2 batches
  - Batch 1 (Dag 1): 3 grønne + 1 rødt
  - Karantene: 48t
  - Batch 2 (Dag 4): 1 rødt
```

### Scenario 4: Kompleks (8 grønne, 1 oransje, 1 rødt)
```
Input: 8 grønne, 1 oransje, 1 rødt
Output: 2-3 batches
  - Batch 1 (Dag 1): 4-5 grønne + 1 oransje
  - Karantene: 48t
  - Batch 2 (Dag 4): 3-4 grønne + 1 rødt
  - Karantene: 48t (hvis flere besøk planlagt)
```

---

## 🔍 Endrede filer

### `routes-planner.js`

**Nye funksjoner:**
- `splitRouteIntoBatches()` - deler ruten inn i batches
- Ingen andre nye funksjoner, men store endringer i eksisterende

**Oppdaterte funksjoner:**
1. `buildRoute()` - bruker nå `splitRouteIntoBatches()`
2. `displayPlannedRoute()` - viser batches med dager
3. `planOptimalRoute()` - kaller ny `buildRoute()`
4. `executeRoute()` - håndterer batch-struktur
5. `addPlannedRouteToCalendar()` - legger til flere dager
6. `addRouteToCalendar()` - støtter batch-format
7. `clearPlannedRoute()` - resetter til tom batch-struktur

**Oppdaterte variabler:**
- `plannedRoute` - fra `[]` til `{ batches: [], totalDays: 0, hasQuarantine: false }`

---

## 📊 Ytelse og optimalisering

### Geografisk optimalisering
- ✅ Innenfor hver batch: nearest neighbor-algoritme
- ✅ Minimerer kjøretid innenfor dagen
- ✅ Respekterer smittevern (røde anlegg sist)

### Karanteneberegning
- ✅ 48 timer = 2 fulle dager + 1 dag buffer = +3 dager
- ✅ Kan justeres ved å endre `currentDay += 3` i koden

---

## 🚀 Brukseksempel

### Steg 1: Velg anlegg
```
☑ Valøyan (grønn)
☑ Mannbruholmen (grønn)
☑ Grøttingsøy (oransje)
☑ Slettholmene (grønn)
☑ Heggsøy (grønn)
☑ Reitholmen (rød - smittet)
```

### Steg 2: Klikk "Beregn rute"
```
→ Systemet analyserer og deler inn i batches
```

### Steg 3: Se resultat
```
✓ Rute planlagt: 6 anlegg over 4 dager, 45.3 km

📅 DAG 1: 4 anlegg (3 grønne + 1 oransje)
⏳ KARANTENE
📅 DAG 4: 2 anlegg (1 grønn + 1 rød)
```

### Steg 4: Legg til i kalender
```
→ Velg startdato: 18. februar 2026
→ Klikk "Legg til i kalender"
→ Systemet legger inn:
  - 18. feb: Batch 1 (4 anlegg)
  - 19-20. feb: Karantene
  - 21. feb: Batch 2 (2 anlegg)
```

---

## 💡 Fremtidige forbedringer

### Mulige utvidelser:
1. **Fleksibel batch-størrelse** - la bruker velge maks anlegg per dag
2. **Værbasert planlegging** - ta hensyn til værvarsel
3. **Automatisk optimalisering** - AI-basert rute som minimerer total tid
4. **Eksport til GPS** - eksporter rute til navigasjonssystem
5. **Epostvarsel** - send påminnelse dagen før hvert besøk
6. **PDF-rapport** - generer reiseplan som PDF

---

## 📞 Support

Ved spørsmål om den nye batch-baserte planleggingen:
1. Les denne dokumentasjonen
2. Test med forskjellige anleggkombinasjoner
3. Sjekk `BIOSECURITY_RULES.md` for smittevernregler

---

**Implementert:** 17. februar 2026  
**Versjon:** 3.0.0 (Batch Routing)  
**Status:** ✅ Produksjonsklar

**Neste steg:** Test med reelle brukere! 🚢⚓
