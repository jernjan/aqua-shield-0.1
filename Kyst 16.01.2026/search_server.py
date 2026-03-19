"""Simple Flask server for vessel search."""
from flask import Flask, jsonify, request
import json
import os

app = Flask(__name__)
CACHE_FILE = "vessel_cache.json"

@app.route('/')
def root():
    return jsonify({"message": "Vessel Search API"})

@app.route('/api/vessels/search')
def search_vessels():
    """Search vessels from cache."""
    try:
        query = request.args.get('query', '').strip()
        risk_level = request.args.get('risk_level', '')
        limit = int(request.args.get('limit', 50))
        
        # Load cache
        if not os.path.exists(CACHE_FILE):
            return jsonify({"error": "Cache not ready", "vessels": [], "total_found": 0})
        
        with open(CACHE_FILE, 'r') as f:
            cache_data = json.load(f)
        
        results = list(cache_data.values())
        
        # Filter by query
        if query:
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
        
        return jsonify({
            "total_found": len(results),
            "query": query,
            "filters": {"risk_level": risk_level or "all"},
            "vessels": results
        })
    
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"error": str(e), "vessels": [], "total_found": 0}), 500

if __name__ == '__main__':
    print("Starting Flask server...")
    app.run(host='127.0.0.1', port=8001, debug=False)
