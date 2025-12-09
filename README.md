# 🐟 AquaShield MVP 0.1

**Varslingssystem for norsk akvakultur** – Varsler før smittespredning, algeutbrudd, og lusexplosjon.

## Oversikt

- **Kjerneverdien:** Automatiske SMS/email-varsler 1–4 uker før sykdomsutbrudd basert på:
  - Lakseluspredning fra nærliggende anlegg
  - Sjøtemperatur (varmere = raskere spredning)
  - Vannstrømmer
  - Båttrafikk (wellbåter som besøker diseased facilities)
  - Alger fra Copernicus (Sentinel-5P)
- **Målgruppe:** Små–medium norske lakseanlegg, regnbueøreanlegg, torskeanlegg + båtoperatører
- **Teknologi:** React/Vite (frontend) + Node/Express (API) + BarentsWatch (open data)
- **Database:** JSON-fil (MVP), senere Postgres

---

## Struktur

```
aqua-shield-0.1/
├── client/                    # React + Vite frontend
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx           # Router
│   │   ├── index.css         # Global styles
│   │   ├── pages/
│   │   │   ├── Login.jsx     # Register/Login
│   │   │   ├── SelectSites.jsx # Choose facilities/vessels
│   │   │   └── Dashboard.jsx  # Inbox with alerts
│   │   └── components/
│   │       └── Toast.jsx
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── server/                    # Node/Express API
│   ├── index.js              # Main server
│   ├── db.js                 # JSON-fil database wrapper
│   ├── routes/
│   │   ├── auth.js           # Login/Register
│   │   ├── user.js           # Profile, select sites
│   │   └── alerts.js         # Get/mark alerts
│   ├── cron/
│   │   └── nightly.js        # 03:00 analysis
│   ├── utils/
│   │   ├── barentswatch.js   # Fetch facilities + lice/disease
│   │   ├── ais.js            # Fetch vessels
│   │   ├── risk.js           # Risk calculation (0-100)
│   │   └── notify.js         # SMS/Email templates
│   ├── package.json
│   ├── .env.example
│   └── .gitignore
├── README.md                 # This file
├── DEPLOY.md                 # Step-by-step Render deploy
└── NOTES.md                  # Future improvements
```

---

## Funksjonalitet (MVP)

### Frontend (React)
1. **Login/Register** – Epost + passord, JWT token i localStorage
2. **SelectSites** – Søk og velg egne anlegg + båter fra BarentsWatch/AIS
3. **Dashboard** – Inbox-stil varsler (rød/gul/grønn), mark as read, test-varsel

### Backend (Node/Express)
1. **Auth** – JWT login/register, bcrypt passwords
2. **Nightly Cron** (03:00 UTC+1) – Hent alle facilities + vessels, kalkuler risiko, lag varsler
3. **Risk Engine** – Avstandsveiet regel (1km=100%, 20km=20%, >20km=0) + disease + temperatur + båter
4. **Alerts** – CRUD alerts, filter per bruker, mark as read

### Data sources (open)
- **BarentsWatch API** – ~1100 lakseanlegg, lusantall, sykdommer
- **Kystverket AIS** – Wellbåter + servicebåter (real-time posisjon)
- **Copernicus Sentinel-5P** (future) – Algae/clorophyll
- **NorKyst-800** (future) – Vannstrømmer

---

## Enkel setup (lokal dev)

### Forutsetninger
- Node 16+
- Git

### 1. Clone / setup

```bash
cd aqua-shield-0.1

# Server
cd server
npm install
cp .env.example .env
# Edit .env with your Twilio/SMTP (optional for MVP)
npm run dev

# Åpne nytt terminal
cd client
npm install
npm run dev
```

Åpne http://localhost:5173 → Dashboard kjører på http://localhost:3001/api

### 2. Logg inn
- Registrer bruker (epost: test@example.com, passord: 123456)
- Velg test-anlegg og båter
- Se dashboard

### 3. Test varsler
- Klikk "🧪 Send test-varsel"
- Sjekk server-konsoll (varsel logg)
- Varslet dukker opp i dashboard

---

## Deploy på Render (2 services + cron)

Se **DEPLOY.md** for detaljer.

**Kort oppsummering:**
1. **API Service** – Node express server
2. **Static Site** – React build (dist/)
3. **Cron Job** – Nightly analysis (03:00)

Prisklasse: ~$15/month (free tier mulig, men liten grense på data-fetch)

---

## Varsling (SMS/Email)

**For MVP:**
- SMS/email kode ligger i `utils/notify.js`
- Foreløpig logget til konsoll, ikke sendt echt
- Test-varsel gjør API-kall som logg-eres

**For produksjon:**
1. Sett Twilio API-nøkkel i .env (SMS)
2. Sett SMTP-detaljer i .env (Email, f.eks. Gmail)
3. Dekk `sendSMS()` og `sendEmail()` i `notify.js`
4. Webhook for received SMS (optionalt)

---

## Risiko-algoritme (0-100)

```
Facility Risk = 
  + Lice count (0-40 pts) 
  + Disease (0-35 pts, +15 for ILA, +10 for PD)
  + Nearby diseased (0-20 pts, distance-weighted)
  + Temp > 8°C (+5 pts, >10°C +5 more)
  + Current strength > 0.3 m/s (+5 pts)
  
Threshold:
  >= 60: KRITISK (red alert)
  40-59: VARSEL (warning, yellow)
  <40:   GRØNN (safe)

Vessel Risk =
  + Visited diseased facilities (30 pts each)
  + Recent visits >3 in 1h (+20 pts)
  + Wellboat type (+20 pts)
```

---

## Ønsket pilotkunder

- **Små lakselaksanlegg** (50–500 tonn)
- **Regnbueøre-anlegg**
- **Torskeanlegg**
- **Båt-operatører** (wellboat fleet)

Pilot: 10–20 gratis for 3–6 måneder, samle feedback + kalibrere terskler

---

## Brukerbetaling (etter MVP)

- **Anlegg:** 4.000 kr/måned
- **Båt-fleet:** 10.000 kr/måned
- **Forskning/studenter:** Gratis

Mål år 1: 20–50 betalende kunder = 10–30 mill kr ARR

---

## Kjente svakheter

1. **Data-nøyaktighet:** BarentsWatch lat/lng kan være unøyaktig → offset + brukerfeedback
2. **Båt-posisjoner:** AIS kan ha forsinkelser, ikke alle båter registrert
3. **Temperatur/strøm:** Mock-data MVP, trenger ekte API (NorKyst-800, Copernicus)
4. **Algae-data:** Ikke implementert enda (Copernicus Sentinel-5P)

---

## Forslagsmessig utvidelse (comments i kode)

1. **Admin-panel** – Justere risiko-terskler på flygende foten
2. **Error logging** – Sentry, Datadog, eller Cloud Logging
3. **User analytics** – Hvor mange varsler ignoreres? Treffraten?
4. **Offline mode** – Service worker for PWA
5. **Webhook** – Integrer med BarentsWatch real-time notifications (når de finnes)
6. **Multi-lang** – Engelsk versjon for international launch
7. **PDF export** – Detaljert risk-rapport (jsPDF)

---

## Henvendelser / support

Denne MVPen er designd for raskt iterasjon med pilot-kunder. Alle data-kilder er open, ingen lisenser-kostnad.

**Neste steg:**
1. Deploy på Render
2. Finn 10 pilot-kunder
3. Kjør nightly for 3 måneder, samle feedback
4. Kalibrert algoritmen basert på ekte utbrudd
5. Launch betalt versjon

---

God lykke! 🐟
