#!/usr/bin/env python3
"""
Copernicus Marine Service - API Integration Guide

Du har bruker - her er hva du trenger for API-integrasjon
"""

print("""
=" * 80
COPERNICUS MARINE SERVICE - API SETUP FOR KYST MONITOR
=" * 80

✅ DU HAR NÅ:
  - Bruker på: https://data.marine.copernicus.eu/
  - Tilgang til 300+ datasett
  - MyOcean Pro viewer

=" * 80
RELEVANT DATASETT FOR LAKSELUS-MONITORING
=" * 80

1. **GLOBAL_ANALYSISFORECAST_PHY_001_024** (BEST!)
   - Name: Global Ocean Physics Analysis and Forecast
   - Resolution: 0.083° (9 km) - PERFEKT for aquaculture!
   - Coverage: Global + Barentshavet
   - Variables: 
     * Sea water velocity (u, v) - HAVSTRØM ✅
     * Sea water temperature ✅
     * Sea water salinity ✅
   - Time: Hourly data, forecasts
   - Dates: 1/11/2020 - 26/1/2026
   
2. **GLOBAL_MULTIYEAR_PHY_001_030** (Historikk)
   - Historical data (reanalysis)
   - Same variables
   - Dates: 1993 - now

=" * 80
HVORDAN HENTE DATA
=" * 80

**METODE 1: REST API (Enklest)**
  
  Endpoint: https://data.marine.copernicus.eu/nrt
  
  Eksempel curl:
  curl -u "bruker:passord" \\
    "https://data.marine.copernicus.eu/nrt/global-analysis-forecast-phy-001-024/cmems_mod_glo_phy_anfc_0.083deg_PT6H-m_202401161200_S20260116T000000Z_E20260118T000000Z_hlqmte_0359.nc"

**METODE 2: WMS/WFS (For kartvisualisering)**
  
  https://wmts.marine.copernicus.eu/

**METODE 3: Download fra web**
  
  GUI: https://data.marine.copernicus.eu/viewer/expert
  - Søk etter produkt
  - Velg område (Barentshavet)
  - Velg tidsperiode
  - Klikk download
  - Får link med credentials

=" * 80
PYTHON API CLIENT - EKSEMPEL
=" * 80

import requests
from requests.auth import HTTPBasicAuth

username = "ditt_brukernavn"
password = "ditt_passord"

# Global Ocean Physics (hourly forecasts)
dataset = "global-analysis-forecast-phy-001-024"

# Barentshavet område (~10x10 grader)
lon_min, lon_max = 10, 35
lat_min, lat_max = 70, 82

# URL for NetCDF fil
url = f"https://data.marine.copernicus.eu/nrt/{dataset}/...latest_file.nc"

# Download
response = requests.get(
    url, 
    auth=HTTPBasicAuth(username, password),
    timeout=30
)

if response.status_code == 200:
    with open("ocean_currents.nc", "wb") as f:
        f.write(response.content)
    print("✅ Data downloaded!")

=" * 80
HVA DU TRENGER I .env
=" * 80

COPERNICUS_USERNAME=ditt_brukernavn
COPERNICUS_PASSWORD=ditt_passord
COPERNICUS_DATASET=global-analysis-forecast-phy-001-024

=" * 80
NEXT STEPS
=" * 80

1. ✅ Du har bruker - DONE
2. ⏳ Get ditt brukernavn/passord klar
3. ⏳ Lag .env variabler
4. ⏳ Jeg lager Python client for:
   - Hente havstrøm-data
   - Parse NetCDF format
   - Integrere i API

=" * 80
""")

print("\nFor mer info: https://marine.copernicus.eu/user-corner")
print("Help Center: https://help.marine.copernicus.eu/")
