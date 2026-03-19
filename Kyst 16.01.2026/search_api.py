"""Minimal FastAPI server for vessel search only."""
from fastapi import FastAPI, Query
from waitress import serve
import json
import os

app = FastAPI(title="Vessel Search", version="1.0.0")
CACHE_FILE = "vessel_cache.json"

@app.get("/api/vessels/search")
def search_vessels(
    query: str = Query("", min_length=0),
    risk_level: str = Query("", pattern="^(HIGH|MODERATE|)$"),
    limit: int = Query(50, ge=1, le=500)
):
    """Search vessels from cache."""
    try:
        # Load cache
        if not os.path.exists(CACHE_FILE):
            return {"error": "Cache not ready", "vessels": [], "total_found": 0}
        
        with open(CACHE_FILE, 'r') as f:
            cache_data = json.load(f)
        
        results = list(cache_data.values())
        
        # Filter by query
        if query and query.strip():
            query_lower = query.lower()
            filtered = []
            for v in results:
                vessel_name = str(v.get("vessel_name", "")).lower()
                mmsi = str(v.get("mmsi", ""))
                if query_lower in vessel_name or query_lower in mmsi:
                    filtered.append(v)
            results = filtered
        
        # Filter by risk level
        if risk_level:
            results = [v for v in results if v.get("risk_level") == risk_level]
        
        # Sort by distance and limit
        results = sorted(results, key=lambda x: x.get("distance_km") or float("inf"))[:limit]
        
        return {
            "total_found": len(results),
            "query": query,
            "filters": {"risk_level": risk_level or "all"},
            "vessels": results
        }
    
    except Exception as e:
        return {"error": str(e), "vessels": [], "total_found": 0}

if __name__ == '__main__':
    print("Starting Waitress server on http://127.0.0.1:8001")
    serve(app, host='127.0.0.1', port=8001)
