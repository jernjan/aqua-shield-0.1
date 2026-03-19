# Copernicus Marine nedlasting - Quick Start

## Step 1: Legge til Copernicus credentials

Åpne eller opprett `.env` filen i roten av prosjektet:

```
COPERNICUS_USERNAME=your_username_here
COPERNICUS_PASSWORD=your_password_here
```

Eller sett environment variabler i PowerShell:
```powershell
$env:COPERNICUS_USERNAME = "your_username"
$env:COPERNICUS_PASSWORD = "your_password"
```

## Step 2: Kjør scriptet

### Standard kjøring (default: i går til i dag):
```powershell
python download_copernicus.py
```

### Med custom datoer:
```powershell
python download_copernicus.py --start-date 2026-01-01 --end-date 2026-01-15
```

### Med custom output-mappe:
```powershell
python download_copernicus.py --output-dir ./my_ocean_data
```

## Output

Scriptet vil:
- ✅ Laste ned havstrøm-data for Barentshavet
- ✅ Lagre som NetCDF fil (`.nc` format)
- ✅ Vise progress under nedlastingen
- ✅ Rapport med filstørrelse og lokasjon

## Parametere

### Geografisk område (Barentshavet):
- **Lengdegrad**: 10°E - 35°E
- **Breddegrad**: 70°N - 82°N
- **Dybde**: 0m - 100m

### Variabler:
- `uo` - Østlig havstrøm (m/s)
- `vo` - Nordlig havstrøm (m/s)

### Dataset:
- **ID**: `cmems_mod_glo_phy-cur_anfc_0.083deg_P1D-m`
- **Oppløsning**: 0.083° (≈9km)
- **Temporal**: Daglig
- **Prognose**: 10 dager

## Eksempel output

```
============================================================
COPERNICUS MARINE DATA DOWNLOAD
============================================================
Dataset: cmems_mod_glo_phy-cur_anfc_0.083deg_P1D-m
Variables: uo, vo
Date range: 2026-01-15 to 2026-01-17
Region: Barentshavet
  Longitude: 10.0°E - 35.0°E
  Latitude: 70.0°N - 82.0°N
  Depth: 0.0m - 100.0m
Output: copernicus_data/barentshavet_currents_20260116_143022.nc
============================================================
🔐 Loading credentials...
✅ Credentials loaded
📥 Starting download...
...
============================================================
✅ DOWNLOAD COMPLETED SUCCESSFULLY
============================================================
📁 File saved to: copernicus_data/barentshavet_currents_20260116_143022.nc
📊 File size: 45.23 MB
```

## Troubleshooting

### "credentials not found"
- Sjekk at `.env` filen ligger i roten
- Sjekk environment variablene med: `$env:COPERNICUS_USERNAME`

### "Dataset not found"
- Sjekk at dataset ID er korrekt
- Se https://data.marine.copernicus.eu/products for alle tilgjengelige datasets

### "AuthenticationError"
- Verifiser at brukernavn/passord er korrekt
- Sjekk at Copernicus-kontoen er aktivert
- Prøv å logge inn på https://data.marine.copernicus.eu

## Neste steg

Når du har NetCDF-filen, kan du:
1. Integrere i API-et
2. Lese data med xarray eller netCDF4
3. Prosessere og visualisere

Eksempel Python-lesing:
```python
import xarray as xr

ds = xr.open_dataset('copernicus_data/barentshavet_currents_*.nc')
print(ds)
print(f"Ocean current speed: {ds['uo'].mean():.2f} m/s")
```
