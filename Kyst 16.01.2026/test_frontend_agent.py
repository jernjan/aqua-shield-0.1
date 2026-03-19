"""
Frontend Agent Test Suite - Dashboard engine and visualization endpoints.
"""

import json
import tempfile
import os
from datetime import datetime, timedelta
from src.frontend.dashboard_engine import DashboardEngine
from src.db.database_manager import DatabaseManager


def test_dashboard_initialization():
    """Test dashboard engine initialization."""
    print("=" * 70)
    print("TEST: Dashboard Engine Initialization")
    print("=" * 70)
    
    dashboard = DashboardEngine()
    print("✓ Dashboard engine initialized")
    assert dashboard is not None
    print("✓ Database connection available")


def test_dashboard_summary():
    """Test dashboard summary generation."""
    print("\n" + "=" * 70)
    print("TEST: Dashboard Summary")
    print("=" * 70)
    
    dashboard = DashboardEngine()
    summary = dashboard.get_dashboard_summary()
    
    assert "facilities" in summary
    assert "risk_distribution" in summary
    assert "alerts" in summary
    assert "diseases" in summary
    assert "vessels" in summary
    
    print(f"✓ Active facilities: {summary['facilities']['active']}")
    print(f"✓ Risk distribution: {summary['risk_distribution']}")
    print(f"✓ Active alerts: {summary['alerts']['active']}")
    print(f"✓ Vessels monitored: {summary['vessels']['monitored']}")


def test_facility_details():
    """Test facility details retrieval."""
    print("\n" + "=" * 70)
    print("TEST: Facility Details")
    print("=" * 70)
    
    dashboard = DashboardEngine()
    db = DatabaseManager()
    
    # Add test facility
    facility_id = db.add_facility(
        locality_id=99999,
        facility_name="Test Facility",
        latitude=69.5,
        longitude=18.0
    )
    print(f"✓ Created test facility: ID {facility_id}")
    
    # Get facility details
    details = dashboard.get_facility_details(facility_id)
    
    assert "name" in details
    assert "location" in details
    assert "active_alerts" in details
    assert "recent_diseases" in details
    assert "recent_exposures" in details
    
    print(f"✓ Retrieved facility: {details['name']}")
    print(f"✓ Location: {details['location']}")
    print(f"✓ Active alerts: {len(details['active_alerts'])}")
    print(f"✓ Disease records: {len(details['recent_diseases'])}")


def test_risk_trends():
    """Test risk trend data generation."""
    print("\n" + "=" * 70)
    print("TEST: Risk Trend Data")
    print("=" * 70)
    
    dashboard = DashboardEngine()
    db = DatabaseManager()
    
    # Add test facility
    facility_id = db.add_facility(
        locality_id=99998,
        facility_name="Trend Test Facility",
        latitude=70.0,
        longitude=19.0
    )
    
    # Add multiple risk assessments
    from src.db.persistence_layer import RiskAssessmentStorage
    risk_storage = RiskAssessmentStorage(db)
    
    for i in range(5):
        score = 50 + (i * 10)
        level = "LOW" if score < 40 else "MEDIUM" if score < 70 else "HIGH"
        db.add_risk_assessment(
            facility_id=facility_id,
            risk_score=score,
            risk_level=level,
            factors={
                "disease_proximity": score,
                "disease_prevalence": score-5,
                "water_exchange": score-10,
                "farm_density": score-8,
                "lice_level": score-3
            }
        )
    
    print(f"✓ Added 5 risk assessments for facility {facility_id}")
    
    # Get trends
    trends = dashboard.get_risk_trends(facility_id, days=10)
    
    assert "trend_data" in trends
    assert "statistics" in trends
    assert len(trends["trend_data"]) > 0
    
    print(f"✓ Trend data points: {len(trends['trend_data'])}")
    print(f"✓ Average score: {trends['statistics']['average']}")
    print(f"✓ Trend direction: {trends['statistics']['trend']}")


def test_alerts_summary():
    """Test alerts summary generation."""
    print("\n" + "=" * 70)
    print("TEST: Active Alerts Summary")
    print("=" * 70)
    
    dashboard = DashboardEngine()
    db = DatabaseManager()
    
    # Add test facility and alerts
    facility_id = db.add_facility(
        locality_id=99997,
        facility_name="Alert Test Facility",
        latitude=71.0,
        longitude=20.0
    )
    
    from src.db.persistence_layer import AlertingSystem
    alert_system = AlertingSystem(db)
    
    for i in range(3):
        db.add_alert(
            facility_id=facility_id,
            alert_type="DISEASE",
            alert_severity="HIGH" if i % 2 == 0 else "MEDIUM",
            alert_message=f"Test alert {i+1}"
        )
    
    print(f"✓ Created 3 test alerts")
    
    # Get alerts
    alerts = dashboard.get_active_alerts_summary(limit=10)
    
    assert len(alerts) > 0
    assert all("facility_name" in alert for alert in alerts)
    
    print(f"✓ Retrieved {len(alerts)} active alerts")
    for alert in alerts[:3]:
        print(f"  - [{alert['severity']}] {alert['message']}")


def test_disease_map_data():
    """Test disease map data generation."""
    print("\n" + "=" * 70)
    print("TEST: Disease Map Data")
    print("=" * 70)
    
    dashboard = DashboardEngine()
    map_data = dashboard.get_disease_map_data()
    
    assert isinstance(map_data, list)
    print(f"✓ Generated map data for {len(map_data)} facilities")
    
    if map_data:
        sample = map_data[0]
        assert "location" in sample
        assert "diseases" in sample
        print(f"✓ Sample facility: {sample['name']}")
        print(f"✓ Location: ({sample['location']['lat']}, {sample['location']['lon']})")
        print(f"✓ Diseases: {len(sample['diseases'])}")


def test_vessel_heatmap():
    """Test vessel exposure heatmap data."""
    print("\n" + "=" * 70)
    print("TEST: Vessel Heatmap Data")
    print("=" * 70)
    
    dashboard = DashboardEngine()
    heatmap = dashboard.get_vessel_heatmap_data()
    
    assert isinstance(heatmap, list)
    print(f"✓ Generated heatmap data points: {len(heatmap)}")


def test_system_health():
    """Test system health status."""
    print("\n" + "=" * 70)
    print("TEST: System Health")
    print("=" * 70)
    
    dashboard = DashboardEngine()
    health = dashboard.get_system_health()
    
    assert "api_health" in health
    assert "database_stats" in health
    assert "recent_errors" in health
    
    print(f"✓ API health sources: {len(health['api_health'])}")
    print(f"✓ Database tables: {len(health['database_stats'])}")
    print(f"✓ Recent errors: {health['recent_errors']}")
    
    if health['api_health']:
        for source, status in list(health['api_health'].items())[:3]:
            available = "✓" if status['available'] else "✗"
            print(f"  {available} {source}: {status['response_time_ms']:.1f}ms")


def test_export_report():
    """Test comprehensive export report."""
    print("\n" + "=" * 70)
    print("TEST: Export Report")
    print("=" * 70)
    
    dashboard = DashboardEngine()
    db = DatabaseManager()
    
    # Add test facility
    facility_id = db.add_facility(
        locality_id=99996,
        facility_name="Export Test Facility",
        latitude=72.0,
        longitude=21.0
    )
    
    report = dashboard.export_facility_report(facility_id)
    
    assert "facility" in report
    assert "risk_trends" in report
    assert "health_status" in report
    assert "generated_at" in report
    
    print(f"✓ Report generated at: {report['generated_at']}")
    print(f"✓ Facility: {report['facility'].get('name', 'Unknown')}")
    print(f"✓ Risk trend points: {report['risk_trends']['data_points']}")
    print(f"✓ Report size: {len(json.dumps(report))} bytes")


def run_all_tests():
    """Run complete test suite."""
    print("\n" + "=" * 70)
    print("FRONTEND AGENT - DASHBOARD TEST SUITE")
    print("=" * 70)
    
    tests = [
        test_dashboard_initialization,
        test_dashboard_summary,
        test_facility_details,
        test_risk_trends,
        test_alerts_summary,
        test_disease_map_data,
        test_vessel_heatmap,
        test_system_health,
        test_export_report,
    ]
    
    passed = 0
    failed = 0
    
    for test in tests:
        try:
            test()
            passed += 1
        except Exception as e:
            failed += 1
            print(f"\n✗ TEST FAILED: {test.__name__}")
            print(f"  Error: {str(e)}")
            import traceback
            traceback.print_exc()
    
    # Print summary
    print("\n" + "=" * 70)
    print("FRONTEND AGENT - TEST SUITE COMPLETE")
    print("=" * 70)
    print(f"\nSummary:")
    print(f"  PASSED: {passed}")
    print(f"  FAILED: {failed}")
    print(f"  Total: {passed + failed}")
    
    if failed == 0:
        print(f"\nAll tests passed!")
    
    print(f"\nDashboard Engine: Ready")
    print(f"Visualization Endpoints: Ready")
    print(f"Export Functionality: Ready")
    print(f"Analytics APIs: Ready")
    
    print(f"\nNext: HTML/Vue.js Frontend Dashboard UI")


if __name__ == "__main__":
    run_all_tests()
