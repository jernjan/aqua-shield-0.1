# Kyst Monitor - Universal Båt Dashboard

## ✅ FIKSET - Dashboard virker nå!

### Hva som ble fikset:

#### 1. **Knapper virker ikke** ✅
- **Problem**: JavaScript funksjoner responderte ikke
- **Løsning**: Redesignet dashboard med korrekte event handlers
- **Result**: Alle knapper fungerer nå

#### 2. **Kart mangler** ✅
- **Problem**: Kartet viste ikke "Din posisjon og anlegg i området"
- **Løsning**: Fikset map initialisering og element IDs
- **Resultat**: Leaflet map vises korrekt med anlegg

#### 3. **Kun for Labridae** ✅
- **Problem**: Dashboard var hardkodet for én båt
- **Løsning**: Laget universelt system for alle båter
- **Resultat**: Du kan nå bruke HVILKEN SOM HELST båt

---

## Ny funksjonalitet

### Båtvelger 🚢
Når du åpner dashbordet ser du:
- **Input-felt** for MMSI
- **"Last båt"** knapp
- **Hint**: "Prøv Labridae: 257051270"

### Slik bruker du:

#### Alternatif 1: Bruk Labridae (test)
```
MMSI: 257051270
Klikk "Last båt"
```
- Navn: LABRIDAE
- Callsign: LH2880
- Posisjon: Trondheim (63.4305°N, 10.3951°E)

#### Alternativ 2: Bruk hvilken som helst båt
```
MMSI: [skriv inn hvilket MMSI du vil]
Klikk "Last båt"
```
- Systemet lager profil for denne båten
- Samme funksjonalitet som Labridae
- Historikk lagres separat per båt

#### Alternativ 3: Bytt båt
```
Klikk "Bytt båt" øverst
Velg ny MMSI
```
- Historikk bevares for hver båt
- Kan bytte fram og tilbake

---

## Dashboard Funksjoner

### 1. **Båtinformasjon**
- MMSI nummer
- Navn (hvis kjent)
- Callsign
- Nåværende posisjon

### 2. **Status**
- 🟢 **Klar til besøk** - Ingen restriksjoner
- 🟡 **Karantene** - 48 timer etter smittet anlegg
- 🔴 **Begrenset** - Kan ikke besøke anlegg

### 3. **Kart** 🗺️
- 🟢 Friske oppdrettsanlegg (grønne prikker)
- 🔴 Smittede anlegg (røde pulserende prikker)
- 🚢 Din båt (båt-emoji)
- Zoom/pan med mus
- Klikk på anlegg for info

### 4. **Raske Handlinger**
- **📝 Logg besøk nå** - Registrer anleggsbesøk
- **🗺️ Planlegg rute** - Optimaliser besøk til flere anlegg
- **⏱️ Se karantene** - Sjekk gjenværende tid

### 5. **Besøkslogging**
- Velg anlegg fra liste
- Huk av hvis desinfeksjon er utført
- Automatisk karantene hvis smittet anlegg

### 6. **Ruteplanlegger**
- Velg flere anlegg
- Beregner optimal rekkefølge (nærmeste nabo-algoritme)
- Viser distanse og estimert tid (10 knop)
- Starter automatisk rute

### 7. **Besøkshistorikk**
- Alle registrerte besøk
- Tidsstempel
- Smittestatus
- Desinfeksjon-info

---

## Teknisk Oppbygging

### Frontend
- **Port**: 8081
- **Server**: Python HTTP server
- **Framework**: Vanilla JavaScript (ingen dependencies)
- **Map**: Leaflet.js 1.9.4
- **Storage**: localStorage (browser)

### Backend API
- **Port**: 8002
- **Framework**: FastAPI (Python)
- **Data**: 2,689 oppdrettsanlegg
- **Smittede**: 60 anlegg med FRANCISELLOSE

### Filstruktur
```
vessel-dashboard/
├── index.html          # Ny universal dashboard
├── index-backup.html   # Gammel Labridae-versjon
├── styles.css          # Komplett styling
├── vessel-storage.js   # localStorage + vessel management
├── vessel-map.js       # Leaflet map integration
├── routes-planner.js   # Route optimization
├── vessel.js           # Main controller
├── server.py           # HTTP server
└── test.html           # Test/debug page
```

---

## Start Systemet

### Manuell Start

**Terminal 1 - API:**
```powershell
cd "c:\Users\janin\OneDrive\Skrivebord\Kyst monitor DEMO\EKTE_API"
python -m uvicorn src.api.main:app --host 127.0.0.1 --port 8002
```

**Terminal 2 - Dashboard:**
```powershell
cd "c:\Users\janin\OneDrive\Skrivebord\Kyst monitor DEMO\14.04. NY BUILD\vessel-dashboard"
python server.py
```

### Åpne Dashboard
```
http://localhost:8081
```

**VIKTIG**: Bruk Chrome, Firefox eller Edge (ikke VS Code Simple Browser)

---

## Testing

### Test 1: Labridae (kjent båt)
1. Skriv inn MMSI: `257051270`
2. Klikk "Last båt"
3. Se fullstendig dashboard med kart
4. Prøv å klikke på anlegg i kartet
5. Logg et besøk
6. Se historikk

### Test 2: Annen båt
1. Skriv inn et annet MMSI (f.eks. `123456789`)
2. Klikk "Last båt"
3. Samme funksjonalitet
4. Historikk lagres separat

### Test 3: Bytt båt
1. Klikk "Bytt båt"
2. Velg ny MMSI
3. Se at historikk bevares for første båt

---

## Eksempel: Full Workflow

### Scenario: Båten "NORDLYS" skal besøke 3 anlegg

1. **Åpne dashboard**
   - Gå til http://localhost:8081

2. **Registrer båt**
   - MMSI: 999999999
   - Klikk "Last båt"
   - Navn vises som "VESSEL-999999999"

3. **Se kartet**
   - Kart laster med 2,689 anlegg
   - Zoom inn på ditt område
   - Se grønne (friske) og røde (smittede) anlegg

4. **Planlegg rute**
   - Klikk "Planlegg rute"
   - Velg 3 anlegg fra lista
   - Klikk "Beregn optimal rekkefølge"
   - Se distanse og tid
   - Klikk "Start rute"

5. **Besøk anlegg**
   - Når du ankommer, klikk "Logg besøk nå"
   - Velg anlegg
   - Huk av desinfeksjon hvis utført
   - Lagre

6. **Sjekk karantene**
   - Hvis anlegg var smittet: 48 timer karantene
   - Hvis desinfeksjon: ingen karantene
   - Se timer i "Se karantene"

7. **Se historikk**
   - Alle besøk vises i historikken
   - Sortert etter nyeste først
   - Tøm historikk hvis ønskelig

---

## Neste Steg

### Mulige utvidelser:
1. **AIS Integration** - Hent real-time båtposisjon
2. **Værdata** - Vis bølgehøyde og vind
3. **Notifikasjoner** - Varsle når 10 km fra smittet anlegg
4. **Multi-bruker** - Flere båter samtidig
5. **Render Deploy** - Publiser online

### For produksjon:
- Koble til BarentsWatch AIS API
- Autentisering med OAuth
- Logging til server (ikke bare localhost)
- Mobile-optimalisering
- Push-varsler

---

## Viktige Detaljer

### Lagring
- Alt lagres i **browser localStorage**
- Hver båt har sin egen profil (basert på MMSI)
- Historikk bevares selv om du lukker nettleseren
- Tøm localStorage for å starte på nytt

### Kartet
- **Zoom**: Musehjul eller +/- knapper
- **Pan**: Klikk og dra
- **Popup**: Klikk på anlegg for info
- **Filter**: "Vis kun smittet" for å kun se røde anlegg

### Performance
- 2,689 anlegg lastes (kan ta 1-2 sekunder)
- Kartet bruker clustering hvis for mange markører
- localStorage max 5MB (mer enn nok for flere båter)

---

## Feilsøking

### Kartet vises ikke
- **Sjekk**: Browser må være Chrome/Firefox/Edge
- **Fikk**: Åpne console (F12) og se etter feil
- **Test**: http://localhost:8081/test.html

### Knapper virker ikke
- **Sjekk**: JavaScript er enabled i browser
- **Fikk**: Refresh siden (Ctrl+F5)
- **Test**: Klikk "Last båt" - skal respondere

### API feil
- **Sjekk**: `netstat -ano | findstr 8002`
- **Fikk**: Restart API server
- **Test**: http://127.0.0.1:8002/health

---

## Support

- Alle funksjoner er testet og virker
- Bruk **Chrome** for beste opplevelse
- Console logging (F12) for debugging
- Test-side: http://localhost:8081/test.html

**Status**: ✅ **KLAR TIL BRUK**
