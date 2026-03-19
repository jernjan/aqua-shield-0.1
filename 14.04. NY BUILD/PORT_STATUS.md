# Port Status & System Overview

**Generert:** 4. mars 2026, 15:45  
**Sist oppdatert:** 16. mars 2026  
**System:** Kyst Monitor DEMO - 14.04 NY BUILD

## 🔌 Port Policy (Canonical)

- **Admin Dashboard:** http://localhost:8080
- **Båtside (Vessel Dashboard):** http://127.0.0.1:8082
- **Facility Dashboard:** http://127.0.0.1:8084
- **Backend API (primary):** http://127.0.0.1:8000
- **Pilot Lite (isolert):** http://127.0.0.1:8085

---

## 🚦 Nåværende Port Status (faktisk bruk)

### ✅ Primære porter i bruk

| Port | Tjeneste | Status | URL | Beskrivelse |
|------|----------|--------|-----|-------------|
| **8000** | Backend API (primær) | 🟢 RUNNING | http://127.0.0.1:8000 | FastAPI backend – hoved-API |
| **8080** | Admin Dashboard | 🟢 RUNNING | http://localhost:8080 | Adminsiden i aktiv bruk |
| **8082** | Båtside / Vessel Dashboard | 🟢 RUNNING | http://127.0.0.1:8082 | Båtsiden i aktiv bruk |
| **8084** | Facility Dashboard | 🟡 VALGFRI | http://127.0.0.1:8084 | End-user visning for anlegg |

### ⚙️ Sekundære/valgfrie porter

| Port | Tjeneste | Status | URL | Notat |
|------|----------|--------|-----|-------|
| **8002** | Backend API (sekundær) | 🟡 VALGFRI | http://127.0.0.1:8002 | Samme EKTE_API-backend, parallell instans |
| **8081** | Vessel Dashboard (alternativ/legacy) | ⚪ VALGFRI | http://127.0.0.1:8081 | Tidligere dokumentert båt-port |
| **8085** | Pilot Lite | 🟡 VALGFRI | http://127.0.0.1:8085 | Isolert kundedemo-produkt (`pilot-lite/`) |

---

## 📊 Arkitektur (forenklet)

```
Frontend
├─ Admin Dashboard (8080)
├─ Båtside / Vessel Dashboard (8082)
├─ Facility Dashboard (8084)
└─ Pilot Lite (8085, isolert demo)

Backend
├─ FastAPI primær (8000)
└─ FastAPI sekundær (8002, valgfri)

Datakilder
└─ SQLite + BarentsWatch API + Copernicus Marine
```

---

## 🔧 Quick Commands

### Sjekk om porter svarer
```powershell
Test-NetConnection -ComputerName localhost -Port 8000 -InformationLevel Quiet
Test-NetConnection -ComputerName localhost -Port 8002 -InformationLevel Quiet
Test-NetConnection -ComputerName localhost -Port 8080 -InformationLevel Quiet
Test-NetConnection -ComputerName localhost -Port 8082 -InformationLevel Quiet
Test-NetConnection -ComputerName localhost -Port 8084 -InformationLevel Quiet
Test-NetConnection -ComputerName localhost -Port 8085 -InformationLevel Quiet
```

### Vis aktive lyttere for prosjektet
```powershell
netstat -ano | findstr "LISTENING" | findstr "8000 8002 8080 8082 8084 8085"
```

### Start anbefalt oppsett
```powershell
# 1) Backend API (primær)
cd "c:\Users\janin\OneDrive\Skrivebord\Kyst monitor DEMO\EKTE_API"
python -m uvicorn src.api.main:app --host 127.0.0.1 --port 8000

# 2) Admin Dashboard
cd "c:\Users\janin\OneDrive\Skrivebord\Kyst monitor DEMO\14.04. NY BUILD\admin-dashboard"
python -m http.server 8080

# 3) Båtside / Vessel Dashboard
cd "c:\Users\janin\OneDrive\Skrivebord\Kyst monitor DEMO\14.04. NY BUILD\vessel-dashboard"
python -m http.server 8082
```

### Start valgfrie tjenester
```powershell
# Facility Dashboard
cd "c:\Users\janin\OneDrive\Skrivebord\Kyst monitor DEMO\14.04. NY BUILD\facility-dashboard"
python -m http.server 8084

# Pilot Lite
cd "c:\Users\janin\OneDrive\Skrivebord\Kyst monitor DEMO\14.04. NY BUILD\pilot-lite"
.\start-pilot-lite.ps1
```

### Stopp alle Python-prosesser (obs: stopper alt Python lokalt)
```powershell
Get-Process -Name python -ErrorAction SilentlyContinue | Stop-Process -Force
```

---

## ✅ Konklusjon

- Admin kjøres på **8080**.
- Båtside kjøres på **8082**.
- Port **8085** er eget mini-produkt (Pilot Lite).
- Port **8002** er sekundær API-instans for parallell kjøring.
