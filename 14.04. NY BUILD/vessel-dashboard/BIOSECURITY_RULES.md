# Smittevernsregler for Ruteplanlegging

## Oversikt
Ruteplanleggeren implementerer Mattilsynets krav fra Transportforskriften §20a (2026) for desinfeksjon og karantene ved besøk til akvakulturanlegg.

## Regelverket

### 1. Desinfeksjon
**Når:** Påkrevd etter hvert besøk til:
- Smittet anlegg (🔴 rød markering)
- Anlegg i smittesone/overvåkningssone (🟠 oransje markering)

**Godkjente midler:**
- Virkon S (1%)
- Natriumhypokloritt (50 ppm klor)
- Peroksyeddiksyre
- Hydrogenperoksid

**Prosess:**
1. Grovvask av utstyr
2. Desinfeksjon med virketid 30-60 minutter
3. Skylling og tørking
4. Attest fra fiskehelsepersonell

**Tid:** 60 minutter for fullstendig desinfeksjon

### 2. Karantene
**Varighet:** 48 timer etter attestert desinfeksjon

**Viktig:** 
- Karantenetid er kumulativ - 48 timer etter SISTE smittebesøk
- Seilingstid regnes med i karantenetid
- Karantene gjelder både for bekreftet smitte og overvåkningssoner

### 3. Ruteplanlegging

#### Automatisk sortering
Systemet sorterer anlegg automatisk:
1. 🟢 **Friske anlegg først** - ingen smitte detektert
2. 🟠 **Oransje anlegg** - mulig smitte (innen 10 km av smittet anlegg)
3. 🔴 **Røde anlegg sist** - bekreftet smitte

#### Karantenekontroll
Før rutestart sjekker systemet:
- Hvis <48 timer siden siste smittebesøk → blokkerer besøk
- Viser varsling: "⛔ KARANTENE AKTIV - Vent X timer"

#### Under rute
For hvert anlegg vises:
- 🧪 **Desinfeksjon påkrevd** (røde anlegg)
- 🧪 **Desinfeksjon anbefalt** (oransje anlegg)
- ⛔ **Karantenevarsel** hvis brudd på 48-timers regel

## Implementering i kode

### Datastruktur for rute
```javascript
{
  name: "Facility Name",
  infected: true/false,
  proximityRisk: true/false,
  distanceFromPrevious: 15.5,  // km
  estTimeMinutes: 50,
  quarantineRequired: true/false,
  quarantineHoursRemaining: 12.5,
  disinfectionRequired: true/false
}
```

### Funksjoner

#### `buildRoute(start, facilities, mode)`
Bygger optimal rute med biosecurity-regler:
- Sorterer anlegg etter sikkerhet
- Beregner kumulativ tid
- Sjekker karantenekrav
- Markerer desinfeksjonsbehov

#### `logDisinfection(facilityName, method)`
Logger desinfeksjon etter besøk:
```javascript
RoutePlanner.logDisinfection('Valøyan', 'Virkon S');
```

Lagrer:
- Anleggsnavn
- Tidspunkt
- Desinfeksjonsmetode
- Når karantene utløper (48t senere)

#### `isInQuarantine()`
Sjekker om båten er i karantene:
```javascript
if (RoutePlanner.isInQuarantine()) {
  alert('Karantene aktiv!');
}
```

#### `getRemainingQuarantineHours()`
Returnerer gjenværende karantetid i timer:
```javascript
const hours = RoutePlanner.getRemainingQuarantineHours();
console.log(`${hours} timer igjen av karantene`);
```

## Brukseksempel

### Scenario 1: Besøk til friske anlegg
```
1. Mannbruholmen (🟢 frisk) → +0.0 km (~0 min)
2. Grøttingsøy (🟢 frisk) → +3.7 km (~12 min)
3. Slettholmene (🟢 frisk) → +0.6 km (~2 min)

Total: 12.5 km | 41 min kjøretid
✓ Ingen desinfeksjon påkrevd
```

### Scenario 2: Besøk inkluderer smittet anlegg
```
1. Mannbruholmen (🟢 frisk) → +0.0 km (~0 min)
2. Grøttingsøy (🟢 frisk) → +3.7 km (~12 min)
3. Slettholmene (🟢 frisk) → +0.6 km (~2 min)
4. Valøyan (🔴 SMITTET) → +8.3 km (~27 min)
   Sykdom: PANKREASSYKDOM
   🧪 DESINFEKSJON PÅKREVD (Virkon S/klor - 60 min virketid)

Total: 12.5 km | 41 min kjøretid + 60 min desinfeksjon
⚠️ Karantene: 48 timer etter desinfeksjon
```

### Scenario 3: Flere smittede anlegg
```
1. Ålesund Havn (🟢 start)
2. Frisk anlegg 1 (🟢) → 10 km
3. Frisk anlegg 2 (🟢) → 5 km
4. Smittet anlegg A (🔴) → 15 km
   🧪 Desinfeksjon → 48t karantene starter
5. Smittet anlegg B (🔴) → 20 km
   ⛔ KARANTENE AKTIV - Vent 48 timer etter anlegg A
   
LØSNING: Besøk smittet anlegg B først, så A, så desinfeksjon
```

## Datalagring

### LocalStorage keys
```javascript
// Desinfeksjonslogg
localStorage.getItem('disinfectionLog')
// Array of: { facility, timestamp, method, quarantineEnds }

// Rutehistorikk
localStorage.getItem('routeHistory')
// Array of: { name, facilities, startTime, biosecurity }
```

## Varsler i UI

### Ruteoversikt
- 🟢 Grønn kant: Friskt anlegg
- 🟠 Oransje kant: Mulig smitte (sone)
- 🔴 Rød kant: Bekreftet smitte

### Tekstlige varsler
- "⛔ KARANTENE AKTIV - Vent X timer"
- "🧪 DESINFEKSJON PÅKREVD (Virkon S/klor - 60 min virketid)"
- "🧪 DESINFEKSJON ANBEFALT (smittesone)"
- "⚠️ SMITTET"

## Testing

### Test 1: Friske anlegg
1. Velg kun grønne anlegg
2. Klikk "Beregn rute"
3. Forventet: Ingen desinfeksjonsvarsler

### Test 2: Smittet anlegg
1. Velg ett rødt anlegg
2. Klikk "Beregn rute"
3. Forventet: "🧪 DESINFEKSJON PÅKREVD"

### Test 3: Karantenebrudd
1. Logger manuelt desinfeksjon for anlegg A
2. Prøv å lage rute til anlegg B (også smittet) 10 timer senere
3. Forventet: "⛔ KARANTENE AKTIV - Vent 38 timer"

### Test 4: Blandet rute
1. Velg 2 grønne + 2 røde anlegg
2. Klikk "Beregn rute"
3. Forventet: Grønne først, røde sist, desinfeksjonsvarsler på røde

## Vedlikehold

### Oppdatere karantetid
I `routes-planner.js`, endre:
```javascript
const QUARANTINE_HOURS = 48; // Endre til ny verdi
```

### Legge til nytt desinfeksjonsmiddel
Oppdater `logDisinfection()` funksjonen med ny metode i dropdown.

### Justere sorteringsregler
Endre `sortFacilitiesBySafety()` funksjonen for annen prioritering.

## Kilder
- Transportforskriften §20a (2026)
- Mattilsynets retningslinjer for smittevern i akvakultur
- BarentsWatch smittedata API

---

**Sist oppdatert:** 17. februar 2026  
**Versjon:** 1.0
