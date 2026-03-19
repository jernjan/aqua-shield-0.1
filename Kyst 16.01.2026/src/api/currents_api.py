"""
API-agent for havstrømdata fra Copernicus NetCDF-fil.
"""

from fastapi import FastAPI, Query
from fastapi.responses import JSONResponse
import xarray as xr
import numpy as np
from typing import List

app = FastAPI()

# Sett filsti til NetCDF
NETCDF_PATH = r"c:/Users/janin/Downloads/cmems_mod_glo_phy_anfc_0.083deg_PT1H-m_1768880964826.nc"

@app.get("/api/currents")
def get_currents(
    north: float = Query(71.0, description="Nordlig breddegrad"),
    south: float = Query(57.0, description="Sørlig breddegrad"),
    west: float = Query(4.0, description="Vestlig lengdegrad"),
    east: float = Query(31.0, description="Østlig lengdegrad"),
    time_index: int = Query(0, description="Tidsindeks i filen (0 = første time)")
):
    ds = xr.open_dataset(NETCDF_PATH)
    # Filtrer på område
    ds_area = ds.sel(latitude=slice(north, south), longitude=slice(west, east))
    # Hent strømdata for valgt tid
    uo = ds_area['uo'].isel(time=time_index).values
    vo = ds_area['vo'].isel(time=time_index).values
    lat = ds_area['latitude'].values
    lon = ds_area['longitude'].values
    # Lag JSON
    result = []
    for i in range(len(lat)):
        for j in range(len(lon)):
            result.append({
                "lat": float(lat[i]),
                "lon": float(lon[j]),
                "uo": float(uo[i, j]),
                "vo": float(vo[i, j])
            })
    return JSONResponse(result)
