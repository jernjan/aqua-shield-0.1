"""FastAPI server for aquaculture risk assessment dashboard.

BACKUP VERSION - Created 2026-01-16 before vessel integration
"""

from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import json
from datetime import datetime
import os
from dotenv import load_dotenv

from src.api.clients.barentswatch import BarentsWatchClient
from src.api.risk_engine import RiskEngine, RiskAssessment

load_dotenv()

app = FastAPI(title="Aquaculture Risk Assessment", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def get_dashboard():
    """Serve the dashboard HTML."""
    return HTMLResponse(get_dashboard_html())


@app.get("/api/risk/assess")
async def assess_risk():
    """Get risk assessment for all facilities."""
    try:
        # Fetch data from BarentsWatch v2 API
        client = BarentsWatchClient()
        facilities = client.get_lice_data_v2()
        
        # Run risk engine
        engine = RiskEngine(facilities)
        assessments = engine.assess_all()
        
        # Convert to JSON-serializable format
        assessments_json = []
        for assessment in assessments:
            assessment_json = {
                "facility_code": assessment.facility_code,
                "facility_name": assessment.facility_name,
                "location": assessment.location,
                "risk_score": round(assessment.risk_score, 1),
                "risk_level": assessment.risk_level,
                "biggest_risk_factor": assessment.biggest_risk_factor,
                "factors": {
                    "disease_proximity": round(assessment.factors.disease_proximity, 1) if assessment.factors.disease_proximity is not None else None,
                    "disease_prevalence": round(assessment.factors.disease_prevalence, 1) if assessment.factors.disease_prevalence is not None else None,
                    "farm_density": round(assessment.factors.farm_density, 1) if assessment.factors.farm_density is not None else None,
                    "water_exchange": round(assessment.factors.water_exchange, 1) if assessment.factors.water_exchange is not None else None,
                    "lice_level": round(assessment.factors.lice_level, 1) if assessment.factors.lice_level is not None else None,
                    "overall": round(assessment.factors.overall, 1)
                },
                "lice_data": {
                    "adult_female_lice": round(assessment.lice_data["adult_female_lice"], 2) if assessment.lice_data["adult_female_lice"] is not None else None,
                    "mobile_lice": round(assessment.lice_data["mobile_lice"], 2) if assessment.lice_data["mobile_lice"] is not None else None
                },
                "disease_status": {
                    "has_ila": assessment.has_ila,
                    "has_pd": assessment.has_pd,
                    "disease_sources": [
                        {
                            "facility_name": source["facility_name"],
                            "facility_code": source["facility_code"],
                            "distance_km": source["distance_km"],
                            "diseases": source["diseases"],
                            "risk_category": source.get("risk_category", "Unknown"),
                            "adult_female_lice": round(source["adult_female_lice"], 2) if source["adult_female_lice"] is not None else None,
                            "mobile_lice": round(source["mobile_lice"], 2) if source["mobile_lice"] is not None else None
                        }
                        for source in assessment.disease_sources
                    ] if assessment.disease_sources else "No diseased farms nearby"
                },
                "assessment_date": assessment.assessment_date
            }
            assessments_json.append(assessment_json)
        
        return {
            "count": len(assessments_json),
            "assessments": assessments_json
        }
    
    except Exception as e:
        print(f"Error in assess_risk: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/risk/facility/{facility_code}")
async def get_facility_risk(facility_code: str):
    """Get risk assessment for a specific facility."""
    try:
        client = BarentsWatchClient()
        facilities = client.get_lice_data_v2()
        
        engine = RiskEngine(facilities)
        
        # Find facility
        for facility in facilities:
            if facility["locality"]["no"] == facility_code:
                assessment = engine.assess_farm(facility)
                if assessment:
                    return {
                        "facility_code": assessment.facility_code,
                        "facility_name": assessment.facility_name,
                        "location": assessment.location,
                        "risk_score": round(assessment.risk_score, 1),
                        "risk_level": assessment.risk_level,
                        "biggest_risk_factor": assessment.biggest_risk_factor,
                        "factors": {
                            "disease_proximity": round(assessment.factors.disease_proximity, 1) if assessment.factors.disease_proximity is not None else None,
                            "disease_prevalence": round(assessment.factors.disease_prevalence, 1) if assessment.factors.disease_prevalence is not None else None,
                            "farm_density": round(assessment.factors.farm_density, 1) if assessment.factors.farm_density is not None else None,
                            "water_exchange": round(assessment.factors.water_exchange, 1) if assessment.factors.water_exchange is not None else None,
                            "lice_level": round(assessment.factors.lice_level, 1) if assessment.factors.lice_level is not None else None,
                            "overall": round(assessment.factors.overall, 1)
                        },
                        "lice_data": {
                            "adult_female_lice": round(assessment.lice_data["adult_female_lice"], 2) if assessment.lice_data["adult_female_lice"] is not None else None,
                            "mobile_lice": round(assessment.lice_data["mobile_lice"], 2) if assessment.lice_data["mobile_lice"] is not None else None
                        },
                        "disease_status": {
                            "has_ila": assessment.has_ila,
                            "has_pd": assessment.has_pd,
                            "disease_sources": assessment.disease_sources if assessment.disease_sources else "No diseased farms nearby"
                        },
                        "assessment_date": assessment.assessment_date
                    }
        
        raise HTTPException(status_code=404, detail="Facility not found")
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting facility risk: {e}")
        raise HTTPException(status_code=500, detail=str(e))


def get_dashboard_html() -> str:
    """Generate the dashboard HTML."""
    # [Dashboard HTML content - omitted for brevity, see main.py]
    pass


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8001)
