"""
EKTE_API - Simplified version with mock data
This version works WITHOUT Barentswatch credentials
"""
from fastapi import FastAPI, Query
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
from typing import List, Dict, Any

# Initialize FastAPI app
app = FastAPI(
    title="Kyst Monitor API - Simplified",
    description="Aquaculture monitoring with mock data",
    version="2.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_mock_facilities() -> List[Dict[str, Any]]:
    """Return mock facility data - 120+ realistic facilities around Norway coast"""
    import random
    
    facilities = []
    facility_id = 10000
    company_names = [
        "SalMar", "Lerøy", "Mowi", "Nordlaks", "Cermaq", "Grieg", 
        "Havbruk Nord", "Nordic Sea", "AquaGen", "Benchmark", "Aqua Farming",
        "Coastal Fish", "Norwegian Salmon", "Arctic Aqua", "Marine Harvest",
        "Ocean Harvesting", "Fjord Fish", "North Sea Harvest"
    ]
    
    localities = [
        ("Finnmark", 70.0, 75.0, 20.0, 35.0),
        ("Troms", 68.0, 71.0, 15.0, 25.0),
        ("Nordland", 65.0, 68.5, 12.0, 18.0),
        ("Trøndelag", 63.0, 65.5, 8.5, 12.0),
        ("Møre og Romsdal", 61.5, 63.5, 5.0, 9.0),
        ("Sogn og Fjordane", 59.5, 61.5, 4.5, 7.5),
        ("Hordaland", 58.5, 60.5, 4.0, 7.0),
        ("Rogaland", 57.5, 59.5, 3.5, 6.0),
    ]
    
    diseases_list = [
        [],  # Healthy - most common
        [],
        [],
        [],
        ["ILA"],  # Infectious Laryngeal Anemia
        ["PD"],   # Pancreas Disease
        ["ILA", "PD"],  # Both diseases
    ]
    
    idx = 0
    for region, lat_min, lat_max, lon_min, lon_max in localities:
        # Generate 15 facilities per region
        for i in range(15):
            lat = random.uniform(lat_min, lat_max)
            lon = random.uniform(lon_min, lon_max)
            company = random.choice(company_names)
            site_num = i + 1
            
            facility = {
                "localityNo": facility_id,
                "code": f"{company[:2].upper()}-{site_num:03d}",
                "name": f"{company} Anlegg {site_num}",
                "locality": region,
                "municipality": region,
                "county": region,
                "latitude": round(lat, 4),
                "longitude": round(lon, 4),
                "status": "Active",
                "species": "Atlantisk laks",
                "capacity": random.randint(3000, 15000),
                "diseases": random.choice(diseases_list)
            }
            facilities.append(facility)
            facility_id += 1
            idx += 1
    
    return facilities


def get_mock_vessels() -> List[Dict[str, Any]]:
    """Return mock AIS vessel data - 50+ test vessels around Norway"""
    import random
    
    vessels = []
    vessel_id = 257000000
    
    ship_types = [
        "Cargo", "Fishing", "Tanker", "Container", "General Cargo",
        "Trawler", "Seiner", "Supply", "Service", "Patrol"
    ]
    
    ship_names = [
        "COASTAL EXPRESS", "NORDIC STAR", "OCEAN PRIDE", "SEAFARER", "NAVIGATOR",
        "ARCTIC EXPLORER", "BLUE HORIZON", "NORTHERN SPIRIT", "WAVE RIDER", "DEEP BLUE",
        "STORM CHASER", "OCEAN MASTER", "FISHER KING", "CARGO QUEEN", "SEA WOLF",
        "SILVER WAVE", "THUNDER SEAS", "HORIZON QUEST", "OCEAN VOYAGER", "FAST CURRENT",
        "NORTHERN LIGHTS", "ARCTIC BREEZE", "OCEAN DANCER", "WAVE MASTER", "SEA KNIGHT",
        "FREEDOM WAVE", "OCEAN EAGLE", "VIKING SPIRIT", "POLAR BEAR", "ICE BREAKER",
        "SALMON SEEKER", "FISHING DREAMS", "COASTAL PRIDE", "NORDIC QUEEN", "SEA CHAMPION"
    ]
    
    # Generate vessels around Norway coast
    regions = [
        (70.5, 24.0),  # Finnmark
        (69.0, 20.0),  # Troms
        (66.0, 13.0),  # Nordland
        (64.0, 11.0),  # Trøndelag
        (62.0, 7.0),   # Møre og Romsdal
        (60.0, 6.0),   # Sogn og Fjordane
        (59.0, 5.0),   # Hordaland
        (58.0, 4.0),   # Rogaland
    ]
    
    for lat_base, lon_base in regions:
        for i in range(6):  # 6 vessels per region
            lat = lat_base + random.uniform(-2, 2)
            lon = lon_base + random.uniform(-3, 3)
            
            vessel = {
                "mmsi": vessel_id,
                "name": random.choice(ship_names),
                "shipType": random.choice(ship_types),
                "latitude": round(lat, 4),
                "longitude": round(lon, 4),
                "speed": round(random.uniform(5, 20), 1),
                "course": random.randint(0, 359),
                "timestamp": datetime.now().isoformat()
            }
            vessels.append(vessel)
            vessel_id += 1
    
    return vessels


# ============================================================================
# HEALTH CHECK ENDPOINTS
# ============================================================================

@app.get("/", tags=["Health"])
async def root():
    """API information"""
    return {
        "name": "Kyst Monitor API",
        "status": "operational",
        "version": "2.0.0",
        "mode": "mock_data",
        "description": "Aquaculture monitoring with mock data (no credentials needed)",
        "datasources": {
            "facilities": "Mock data - 8 test facilities",
            "vessels": "Mock data - 3 test vessels",
            "health": "Derived from facilities"
        }
    }


@app.get("/health", tags=["Health"])
async def health_check():
    """Health check - always returns healthy with mock data"""
    return {
        "status": "healthy",
        "mode": "mock_data",
        "datasources": {
            "facilities": "OK",
            "vessels": "OK",
            "health": "OK"
        },
        "timestamp": datetime.now().isoformat()
    }


# ============================================================================
# FACILITIES ENDPOINTS
# ============================================================================

@app.get("/api/facilities", tags=["Facilities"])
async def get_facilities(
    limit: int = Query(50, ge=1, le=500),
    skip: int = Query(0, ge=0)
):
    """Get aquaculture facilities (mock data)"""
    facilities = get_mock_facilities()
    
    # Apply pagination
    paginated = facilities[skip:skip+limit]
    
    return {
        "count": len(paginated),
        "total": len(facilities),
        "skip": skip,
        "facilities": paginated,
        "mode": "mock_data"
    }


@app.get("/api/facilities/{facility_code}", tags=["Facilities"])
async def get_facility(facility_code: str):
    """Get single facility by code"""
    facilities = get_mock_facilities()
    
    facility = next(
        (f for f in facilities if f.get("code") == facility_code or str(f.get("localityNo")) == facility_code),
        None
    )
    
    if facility:
        return facility
    else:
        return JSONResponse(
            status_code=404,
            content={"error": f"Facility {facility_code} not found"}
        )


@app.get("/api/facilities/disease-spread", tags=["Facilities"])
async def get_disease_spread():
    """Calculate disease spread risk between facilities"""
    from math import radians, cos, sin, asin, sqrt
    
    def haversine(lat1, lon1, lat2, lon2):
        """Calculate distance in km"""
        lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
        c = 2 * asin(sqrt(a))
        return 6371 * c
    
    facilities = get_mock_facilities()
    
    # Split into diseased and healthy
    diseased = [f for f in facilities if f.get("diseases")]
    healthy = [f for f in facilities if not f.get("diseases")]
    
    # Calculate risks
    facility_risks = []
    
    for h in healthy:
        nearby_diseases = []
        
        for d in diseased:
            distance = haversine(
                h["latitude"], h["longitude"],
                d["latitude"], d["longitude"]
            )
            
            if distance < 50:  # Within 50 km
                risk_score = max(0, 100 - (distance * 2))
                
                if risk_score > 75:
                    risk_level = "Ekstrem"
                elif risk_score > 50:
                    risk_level = "Høy"
                elif risk_score > 25:
                    risk_level = "Moderat"
                else:
                    risk_level = "Lav"
                
                nearby_diseases.append({
                    "infected_facility_code": d["code"],
                    "infected_facility_name": d["name"],
                    "distance_km": round(distance, 1),
                    "diseases": d["diseases"],
                    "risk_level": risk_level,
                    "risk_score": round(risk_score, 1)
                })
        
        if nearby_diseases:
            # Sort by risk score
            nearby_diseases.sort(key=lambda x: x["risk_score"], reverse=True)
            highest = nearby_diseases[0]
            
            facility_risks.append({
                "facility_code": h["code"],
                "facility_name": h["name"],
                "position": {
                    "latitude": h["latitude"],
                    "longitude": h["longitude"]
                },
                "risk_level": highest["risk_level"],
                "risk_score": highest["risk_score"],
                "nearby_diseased_facilities_count": len(nearby_diseases),
                "highest_risk_neighbor": highest,
                "all_nearby_diseases": nearby_diseases,
                "assessment_date": datetime.now().isoformat()
            })
    
    # Sort by risk
    facility_risks.sort(key=lambda x: x["risk_score"], reverse=True)
    
    # Count by level
    risk_summary = {
        "ekstrem": len([f for f in facility_risks if f["risk_level"] == "Ekstrem"]),
        "høy": len([f for f in facility_risks if f["risk_level"] == "Høy"]),
        "moderat": len([f for f in facility_risks if f["risk_level"] == "Moderat"]),
        "lav": len([f for f in facility_risks if f["risk_level"] == "Lav"])
    }
    
    return {
        "total_facilities": len(facilities),
        "diseased_facilities_count": len(diseased),
        "healthy_facilities_total": len(healthy),
        "facilities_at_disease_risk": len(facility_risks),
        "risk_summary": risk_summary,
        "all_at_risk_facilities": facility_risks,
        "parameters": {
            "distance_radius_km": 50,
            "mode": "simplified_calculation",
            "last_updated": datetime.now().isoformat()
        }
    }


# ============================================================================
# HEALTH SUMMARY ENDPOINTS
# ============================================================================

@app.get("/api/health/summary", tags=["Health"])
async def get_health_summary():
    """Get health summary from facilities"""
    facilities = get_mock_facilities()
    
    ila_count = len([f for f in facilities if "ILA" in f.get("diseases", [])])
    pd_count = len([f for f in facilities if "PD" in f.get("diseases", [])])
    
    return {
        "numberOfFilteredLocalities": len(facilities),
        "ila_confirmed_cases": ila_count,
        "ila_suspected_cases": 0,
        "pd_confirmed_cases": pd_count,
        "pd_suspected_cases": 0,
        "total_diseased": ila_count + pd_count,
        "healthy": len(facilities) - (ila_count + pd_count),
        "mode": "mock_data"
    }


# ============================================================================
# AIS / VESSEL ENDPOINTS
# ============================================================================

@app.get("/api/ais/vessels", tags=["Vessels"])
async def get_ais_vessels(
    limit: int = Query(100, ge=1, le=1000),
    latitude: float = Query(None),
    longitude: float = Query(None),
    radius_km: float = Query(None)
):
    """Get vessel positions (mock data)"""
    vessels = get_mock_vessels()
    
    # If location filter provided, apply it (simplified)
    if latitude and longitude and radius_km:
        # In real implementation, would filter by distance
        pass
    
    return {
        "count": len(vessels),
        "vessels": vessels[:limit],
        "mode": "mock_data"
    }


# ============================================================================
# RISK ASSESSMENT (simplified)
# ============================================================================

@app.get("/api/risk/facility/{facility_code}", tags=["Risk"])
async def get_facility_risk(facility_code: str):
    """Get risk assessment for a facility"""
    facilities = get_mock_facilities()
    
    facility = next(
        (f for f in facilities if f.get("code") == facility_code),
        None
    )
    
    if not facility:
        return JSONResponse(
            status_code=404,
            content={"error": "Facility not found"}
        )
    
    # Simple risk calculation
    has_disease = len(facility.get("diseases", [])) > 0
    
    if has_disease:
        risk_level = "Critical"
        risk_score = 95
    else:
        risk_level = "Low"
        risk_score = 15
    
    return {
        "facility_code": facility["code"],
        "facility_name": facility["name"],
        "risk": {
            "score": risk_score,
            "level": risk_level
        },
        "factors": {
            "disease_proximity": {
                "score": 20 if not has_disease else 80,
                "description": "Risk from nearby diseased farms"
            },
            "disease_status": {
                "has_disease": has_disease,
                "diseases": facility.get("diseases", [])
            }
        },
        "assessment_date": datetime.now().isoformat(),
        "mode": "simplified"
    }


if __name__ == "__main__":
    import uvicorn
    print("🚀 Starting Kyst Monitor API (Simplified - Mock Data)")
    print("📍 http://127.0.0.1:8002")
    print("📖 Docs: http://127.0.0.1:8002/docs")
    uvicorn.run(app, host="127.0.0.1", port=8002, log_level="info")
