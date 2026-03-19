import math

# Rekursiv funksjon for å konvertere alle NaN/inf til None
def clean_nans(obj):
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
        return obj
    elif isinstance(obj, dict):
        return {k: clean_nans(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [clean_nans(x) for x in obj]
    else:
        return obj
"""
API-agent for havstrømdata fra CSV (Copernicus).
"""

from fastapi import FastAPI, Query
from fastapi.responses import JSONResponse
import pandas as pd
import os

app = FastAPI()

CSV_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../cmems_mod_glo_phy_anfc_0.083deg_PT1H-m_1768880964826.csv'))

@app.get("/api/currents_csv")
def get_currents_csv(
    north: float = Query(71.0, description="Nordlig breddegrad"),
    south: float = Query(57.0, description="Sørlig breddegrad"),
    west: float = Query(4.0, description="Vestlig lengdegrad"),
    east: float = Query(31.0, description="Østlig lengdegrad")
):
    df = pd.read_csv(CSV_PATH)
    # Forutsetter kolonner: latitude, longitude, uo, vo, (eventuelt tid)
    filtered = df[(df['latitude'] <= north) & (df['latitude'] >= south) & (df['longitude'] >= west) & (df['longitude'] <= east)]
    # Konverter alle NaN og inf til None for JSON-kompatibilitet
    filtered = filtered.replace([float('inf'), float('-inf')], pd.NA)
    filtered = filtered.where(pd.notnull(filtered), None)
    result = filtered.to_dict(orient='records')
    # Rens alle NaN/inf fra datastrukturen
    result = clean_nans(result)
    return JSONResponse(result)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8004)
