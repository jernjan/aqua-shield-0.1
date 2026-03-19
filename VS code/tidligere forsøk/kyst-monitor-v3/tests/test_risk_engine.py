"""Test risk calculation engine."""

import pytest
from datetime import datetime, timedelta
from src.risk_engine.calculator import RiskCalculator
from src.risk_engine.proximity import VesselProximityDetector


class TestRiskCalculator:
    """Test RiskCalculator functionality."""

    def setup_method(self):
        """Setup test fixtures."""
        self.calculator = RiskCalculator()

    def test_calculate_facility_risk_green(self):
        """Test facility with no risk = GREEN."""
        result = self.calculator.calculate_facility_risk(
            facility_id="FAC001",
            facility_name="Aarsand",
            current_lice_count=0,
            current_temperature=10.0,
            vessel_visits_recent=[],
            downstream_facilities=[],
            wild_fish_risk_factor=0.0,
        )

        assert result["alert_level"] == "GREEN"
        assert result["total_score"] < 40

    def test_calculate_facility_risk_red(self):
        """Test facility with high risk = RED."""
        now = datetime.utcnow()
        result = self.calculator.calculate_facility_risk(
            facility_id="FAC002",
            facility_name="Test High Risk",
            current_lice_count=150,  # Very high lice
            current_temperature=10.0,  # Optimal for lice
            vessel_visits_recent=[
                {"visit_date": now - timedelta(days=1), "source_has_lice": True}
            ],
            downstream_facilities=[{"id": "FAC003"}],  # Has downstream
            wild_fish_risk_factor=0.8,  # High genetic risk
        )

        assert result["alert_level"] == "RED"
        assert result["total_score"] >= 70

    def test_current_risk_scoring(self):
        """Test ocean current risk calculation."""
        # No lice = no risk
        risk_0 = self.calculator._calculate_current_risk(0, [])
        assert risk_0 == 0

        # Low lice count
        risk_5 = self.calculator._calculate_current_risk(5, [])
        assert 0 < risk_5 <= 10

        # High lice count
        risk_150 = self.calculator._calculate_current_risk(150, [])
        assert risk_150 > 30

    def test_vessel_risk_scoring(self):
        """Test vessel movement risk calculation."""
        now = datetime.utcnow()

        # No visits = no risk
        risk_0 = self.calculator._calculate_vessel_risk([])
        assert risk_0 == 0

        # Recent visit to infected site
        risk_recent = self.calculator._calculate_vessel_risk(
            [
                {"visit_date": now - timedelta(days=1), "source_has_lice": True}
            ]
        )
        assert risk_recent > 10

        # Old visit (>14 days) = ignored
        risk_old = self.calculator._calculate_vessel_risk(
            [
                {"visit_date": now - timedelta(days=20), "source_has_lice": True}
            ]
        )
        assert risk_old == 0

    def test_temperature_risk_scoring(self):
        """Test temperature risk calculation."""
        # Optimal range (8-14°C) = maximum risk
        risk_opt = self.calculator._calculate_temperature_risk(10.0)
        assert risk_opt == 10.0

        # Too cold (<4°C) = no risk
        risk_cold = self.calculator._calculate_temperature_risk(2.0)
        assert risk_cold == 0.0

        # Too warm (>18°C) = no risk
        risk_warm = self.calculator._calculate_temperature_risk(20.0)
        assert risk_warm == 0.0

    def test_genetic_risk_scoring(self):
        """Test genetic disease risk calculation."""
        risk_0 = self.calculator._calculate_genetic_risk(0.0)
        assert risk_0 == 0.0

        risk_mid = self.calculator._calculate_genetic_risk(0.5)
        assert risk_mid == 10.0

        risk_high = self.calculator._calculate_genetic_risk(1.0)
        assert risk_high == 20.0


class TestVesselProximityDetector:
    """Test VesselProximityDetector functionality."""

    def setup_method(self):
        """Setup test fixtures."""
        self.detector = VesselProximityDetector()

    def test_distance_calculation(self):
        """Test Haversine distance calculation."""
        # Test known distance: Bergen to Oslo (approximately 305 km)
        distance = self.detector.calculate_distance(60.3912, 5.3221, 59.9139, 10.7522)
        assert 300 < distance < 310

        # Same point = 0 distance
        distance_same = self.detector.calculate_distance(60.0, 5.0, 60.0, 5.0)
        assert distance_same < 0.1

    def test_proximity_detection_no_threats(self):
        """Test proximity detection with no threats."""
        vessels = [
            {
                "vessel_id": "V001",
                "vessel_name": "Boat A",
                "latitude": 60.0,
                "longitude": 5.0,
            }
        ]
        facilities = [
            {
                "facility_id": "FAC001",
                "facility_name": "Test Facility",
                "latitude": 65.0,  # 5 degrees away = ~500km
                "longitude": 5.0,
                "current_lice_count": 50,  # Has lice but far away
            }
        ]

        threats = self.detector.detect_proximity_threats(vessels, facilities)
        assert len(threats) == 0

    def test_proximity_detection_with_threats(self):
        """Test proximity detection detects threats."""
        vessels = [
            {
                "vessel_id": "V001",
                "vessel_name": "Boat A",
                "latitude": 60.0,
                "longitude": 5.0,
            }
        ]
        facilities = [
            {
                "facility_id": "FAC001",
                "facility_name": "Test Facility",
                "latitude": 60.01,  # ~1km away
                "longitude": 5.01,
                "current_lice_count": 50,
            }
        ]

        threats = self.detector.detect_proximity_threats(vessels, facilities)
        assert len(threats) == 1
        assert threats[0]["vessel_name"] == "Boat A"
        assert threats[0]["distance_km"] < 3.0

    def test_threat_level_assessment(self):
        """Test threat level assessment."""
        # Very close to high-infection facility = CRITICAL
        level_critical = self.detector._assess_threat_level(0.3, 100)
        assert level_critical == "CRITICAL"

        # Close to moderate infection = HIGH
        level_high = self.detector._assess_threat_level(0.8, 30)
        assert level_high == "HIGH"

        # Within 2km = MEDIUM
        level_medium = self.detector._assess_threat_level(1.5, 10)
        assert level_medium == "MEDIUM"

        # 2-3km range = LOW
        level_low = self.detector._assess_threat_level(2.5, 5)
        assert level_low == "LOW"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
