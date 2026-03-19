# 🌊 Kyst Monitor v3 - Fresh Start

Real-time monitoring system for Norwegian aquaculture farms with integrated API data from BarentsWatch, AIS, and weather services.

## 🎯 Formål

Monitor **2000 aquaculture farms** and **4000 vessels** with:
- ✅ Real data (no mock data)
- ✅ Risk prediction (not status reporting)
- ✅ Early warning system for lice/disease spread

## 🔑 Credentials (Stored in .env)

### BarentsWatch API
- **ClientID:** janinge88@hotmail.com:Kyst-Monitor
- **Scope:** api
- **Uses:** FiskInfo (anlegg), NAIS (status), ArcticInfo (oceanografi)

### AIS API  
- **ClientID:** janinge88@hotmail.com:Kyst-Monitor-AIS
- **Scope:** ais
- **Uses:** Vessel positions and movement tracking

### YR.no Weather API
- **Public API** (no key needed)
- **Uses:** Temperature, wind, precipitation forecasts

---

## 📁 Struktur

```
kyst-monitor-v3/
├── .env                      # API credentials (DO NOT COMMIT!)
├── requirements.txt          # Python dependencies
├── README.md                 # This file
├── tests/
│   ├── test_barentswatch.py  # Test BarentsWatch API
│   ├── test_ais.py           # Test AIS API
│   └── test_weather.py       # Test YR.no API
├── src/
│   ├── api_clients/
│   │   ├── barentswatch.py   # BarentsWatch integration
│   │   ├── ais.py            # AIS integration
│   │   └── weather.py        # Weather data integration
│   ├── database/
│   │   ├── models.py         # SQLAlchemy models
│   │   └── connection.py     # Database setup
│   └── cache/
│       └── cache.py          # Local caching
└── main.py                   # Entry point
```

---

## 🚀 Setup

### 1. Create Virtual Environment

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

### 2. Install Dependencies

```powershell
pip install -r requirements.txt
```

### 3. Test APIs

```powershell
# Test BarentsWatch API
python -m pytest tests/test_barentswatch.py -v

# Test AIS API
python -m pytest tests/test_ais.py -v

# Test Weather API
python -m pytest tests/test_weather.py -v
```

---

## 📊 Data Strategy

### What We Cache Locally
- **Anlegg data** (2000 farms) - updated daily
- **Vessel positions** (4000 vessels) - updated every 30 min
- **Weather forecasts** - updated every 3 hours
- **Risk calculations** - updated hourly

---

## ⚙️ Status

- ✅ New project structure created
- ⏳ API tests being built
- ⏳ Database design pending
- ⏳ Backend development pending
- ⏳ Frontend development pending

---

*Fresh start, solid foundation, real data only.*
