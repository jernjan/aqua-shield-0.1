"""Test script for ML endpoints - creates synthetic data and tests predictions."""

import sys
import subprocess
import time
import json
from datetime import datetime, timedelta
import sqlite3

sys.path.insert(0, '.')

def create_synthetic_data():
    """Create synthetic historical data for testing."""
    db_path = "kyst_monitor.db"
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Use a test facility code
    facility_code = "10001"
    facility_id = 1
    
    # Check if facility exists
    cursor.execute("SELECT facility_id FROM facilities WHERE locality_id = ?", (facility_code,))
    result = cursor.fetchone()
    
    if not result:
        # Insert facility
        cursor.execute("""
            INSERT INTO facilities (locality_id, facility_name, latitude, longitude, production_status, municipality)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (facility_code, "Test Facility", 70.5, 24.5, "Active", "Nordkapp"))
        conn.commit()
        facility_id = cursor.lastrowid
    else:
        facility_id = result[0]
    
    # Generate 30 days of synthetic risk assessment data
    print(f"Creating 30 days of synthetic risk data for facility {facility_code}...")
    
    base_risk = 40
    for i in range(30):
        date = datetime.now() - timedelta(days=30-i)
        trend = 0.5 * i
        noise = 5 * (i % 3 - 1)
        risk_score = max(0, min(100, base_risk + trend + noise + (i // 7) * 5))
        
        risk_level = "CRITICAL" if risk_score >= 80 else "HIGH" if risk_score >= 60 else "MEDIUM" if risk_score >= 40 else "LOW"
        
        cursor.execute("""
            INSERT INTO risk_assessments 
            (facility_id, assessment_date, risk_score, risk_level, disease_proximity_score, 
             disease_prevalence_score, water_exchange_score, farm_density_score, lice_level_score, biggest_risk_factor)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (facility_id, date.isoformat(), risk_score, risk_level, risk_score*0.3, risk_score*0.2, 
              risk_score*0.15, risk_score*0.2, risk_score*0.15, "Multiple factors"))
    
    # Generate lice data
    print(f"Creating lice population data...")
    base_lice = 30
    for i in range(20):
        date = datetime.now() - timedelta(days=20-i)
        lice_count = max(0, base_lice + 2*i + (i % 5 - 2) * 5)
        
        cursor.execute("""
            INSERT INTO disease_data 
            (facility_id, disease_type, detected_date, lice_count, adult_female_lice, mobile_lice, disease_status)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (facility_id, "LICE", date.isoformat(), lice_count, lice_count*0.6, lice_count*0.4, "Active"))
    
    conn.commit()
    conn.close()
    
    print("Synthetic data created successfully!")
    return facility_code


def test_endpoints(facility_code):
    """Test all ML endpoints."""
    print("\n" + "="*70)
    print("TESTING ML ENDPOINTS")
    print("="*70)
    
    # Start server
    print("\nStarting FastAPI server...")
    proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "src.api.main:app", "--host", "127.0.0.1", "--port", "8000"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )
    
    time.sleep(3)
    
    try:
        import requests
        
        # Test 1: Risk Predictions
        print("\n" + "-"*70)
        print("1. RISK PREDICTION ENDPOINT")
        print("-"*70)
        try:
            resp = requests.get(
                f"http://127.0.0.1:8000/api/predictions/risk",
                params={"facility_code": facility_code, "days_ahead": 14}
            )
            if resp.status_code == 200:
                data = resp.json()
                print(f"OK Status: {resp.status_code}")
                print(f"  Facility: {data.get('facility_name', 'Unknown')}")
                print(f"  Data status: {data.get('status', 'Success')}")
                preds = data.get('predictions', [])
                print(f"  Predictions: {len(preds)} records")
                if preds:
                    pred = preds[0]
                    print(f"  First prediction:")
                    print(f"    - Date: {pred.get('forecast_date')}")
                    print(f"    - Score: {pred.get('predicted_risk_score')}")
                    print(f"    - Level: {pred.get('risk_level')}")
                    print(f"    - 95% CI: [{pred.get('confidence_lower')}, {pred.get('confidence_upper')}]")
                    print(f"    - Model: {pred.get('model_type')}")
            else:
                print(f"ERROR {resp.status_code}: {resp.text[:200]}")
        except Exception as e:
            print(f"ERROR Request failed: {e}")
        
        # Test 2: Anomaly Detection
        print("\n" + "-"*70)
        print("2. ANOMALY DETECTION ENDPOINT")
        print("-"*70)
        try:
            resp = requests.get(
                f"http://127.0.0.1:8000/api/anomalies/detect",
                params={"facility_code": facility_code}
            )
            if resp.status_code == 200:
                data = resp.json()
                print(f"OK Status: {resp.status_code}")
                print(f"  Facility: {data.get('facility_name', 'Unknown')}")
                anomalies = data.get('anomalies', [])
                print(f"  Anomalies detected: {data.get('anomalies_detected', 0)}")
                if anomalies:
                    anom = anomalies[0]
                    print(f"  First anomaly:")
                    print(f"    - Type: {anom.get('anomaly_type')}")
                    print(f"    - Severity: {anom.get('severity_score')}/100")
                    print(f"    - Baseline: {anom.get('baseline_value')}")
                    print(f"    - Observed: {anom.get('observed_value')}")
                    print(f"    - Deviation: {anom.get('deviation_percent')}%")
            else:
                print(f"ERROR {resp.status_code}: {resp.text[:200]}")
        except Exception as e:
            print(f"ERROR Request failed: {e}")
        
        # Test 3: Outbreak Forecasting
        print("\n" + "-"*70)
        print("3. OUTBREAK FORECAST ENDPOINT")
        print("-"*70)
        try:
            resp = requests.get(
                f"http://127.0.0.1:8000/api/forecasts/outbreaks",
                params={"facility_code": facility_code}
            )
            if resp.status_code == 200:
                data = resp.json()
                print(f"OK Status: {resp.status_code}")
                print(f"  Facility: {data.get('facility_name', 'Unknown')}")
                print(f"  Outbreak probability: {data.get('outbreak_probability', 0)}%")
                print(f"  Risk level: {data.get('probability_level', 'N/A')}")
                print(f"  Days to critical: {data.get('days_to_critical', 'N/A')}")
                factors = data.get('contributing_factors', [])
                if factors:
                    print(f"  Contributing factors:")
                    for factor in factors:
                        print(f"    - {factor}")
                interventions = data.get('recommended_interventions', [])
                if interventions:
                    print(f"  Recommended interventions:")
                    for interv in interventions[:3]:
                        print(f"    - {interv}")
            else:
                print(f"ERROR {resp.status_code}: {resp.text[:200]}")
        except Exception as e:
            print(f"ERROR Request failed: {e}")
        
        # Test 4: Recommendations
        print("\n" + "-"*70)
        print("4. RECOMMENDATIONS ENDPOINT")
        print("-"*70)
        try:
            resp = requests.get(
                f"http://127.0.0.1:8000/api/recommendations/interventions",
                params={"facility_code": facility_code}
            )
            if resp.status_code == 200:
                data = resp.json()
                print(f"OK Status: {resp.status_code}")
                print(f"  Facility: {data.get('facility_name', 'Unknown')}")
                print(f"  Priority: {data.get('priority_level', 'N/A')}")
                print(f"  Risk Score: {data.get('current_risk_score', 'N/A')}")
                immediate = data.get('immediate_actions', [])
                short_term = data.get('short_term_actions', [])
                print(f"  Immediate actions: {len(immediate)}")
                print(f"  Short-term actions: {len(short_term)}")
                if immediate:
                    print(f"  Sample immediate actions:")
                    for action in immediate[:2]:
                        print(f"    - {action}")
            else:
                print(f"ERROR {resp.status_code}: {resp.text[:200]}")
        except Exception as e:
            print(f"ERROR Request failed: {e}")
        
        print("\n" + "="*70)
        print("ALL TESTS COMPLETED")
        print("="*70)
        print("\nAccess the ML Dashboard at:")
        print("  http://localhost:8000/static/ml_dashboard.html")
        print("\nOr access individual endpoints:")
        print(f"  Predictions: http://127.0.0.1:8000/api/predictions/risk?facility_code={facility_code}")
        print(f"  Anomalies: http://127.0.0.1:8000/api/anomalies/detect?facility_code={facility_code}")
        print(f"  Outbreaks: http://127.0.0.1:8000/api/forecasts/outbreaks?facility_code={facility_code}")
        print(f"  Recommendations: http://127.0.0.1:8000/api/recommendations/interventions?facility_code={facility_code}")
        
    except ImportError:
        print("ERROR: requests library not available")
    finally:
        proc.terminate()
        print("\nServer stopped.")


if __name__ == "__main__":
    print("Kyst Monitor - ML Endpoint Test Script")
    print("="*70)
    
    # Create synthetic data
    facility_code = create_synthetic_data()
    
    # Test endpoints
    test_endpoints(facility_code)
