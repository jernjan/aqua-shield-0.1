"""
Risk Assessment Engine - 4-Factor Model

Factors:
1. Ocean Current Risk (0-40): Downstream from infected facility
2. Vessel Movement Risk (0-30): Boats that visited infected sites in last 14 days
3. Genetic Disease Risk (0-20): Wild fish contamination vectors
4. Temperature Risk (0-10): Optimal lice spawning conditions (8-14°C)

Total Score: 0-100
Alert Levels:
- RED: 70+ (high risk)
- YELLOW: 40-69 (medium risk)
- GREEN: <40 (low risk)
"""

from datetime import datetime, timedelta
from typing import Dict, List, Tuple
import logging
from math import radians, cos, sin, asin, sqrt

logger = logging.getLogger(__name__)


class RiskCalculator:
    """Calculate facility risk scores based on 4-factor model."""

    # Risk thresholds for alert levels
    RED_THRESHOLD = 70
    YELLOW_THRESHOLD = 40

    # Constants for risk calculations
    CURRENT_VESSEL_MEMORY_DAYS = 14
    OPTIMAL_TEMP_MIN = 8.0
    OPTIMAL_TEMP_MAX = 14.0

    def __init__(self):
        """Initialize risk calculator."""
        self.logger = logger

    def calculate_facility_risk(
        self,
        facility_id: str,
        facility_name: str,
        current_lice_count: int,
        current_temperature: float,
        vessel_visits_recent: List[Dict],
        downstream_facilities: List[Dict],
        wild_fish_risk_factor: float = 0.5,
    ) -> Dict:
        """
        Calculate total risk score for a facility.

        Args:
            facility_id: Unique facility identifier
            facility_name: Name of the facility
            current_lice_count: Current lice count on facility
            current_temperature: Current water temperature in °C
            vessel_visits_recent: List of recent vessel visits
            downstream_facilities: List of facilities downstream
            wild_fish_risk_factor: Factor for genetic disease risk (0-1)

        Returns:
            Dictionary with risk scores and alert level
        """
        try:
            # Calculate individual risk factors
            current_risk = self._calculate_current_risk(
                current_lice_count, downstream_facilities
            )
            vessel_risk = self._calculate_vessel_risk(vessel_visits_recent)
            genetic_risk = self._calculate_genetic_risk(wild_fish_risk_factor)
            temperature_risk = self._calculate_temperature_risk(current_temperature)

            # Total score
            total_score = current_risk + vessel_risk + genetic_risk + temperature_risk

            # Determine alert level
            alert_level = self._determine_alert_level(total_score)

            result = {
                "facility_id": facility_id,
                "facility_name": facility_name,
                "total_score": round(total_score, 1),
                "alert_level": alert_level,
                "factors": {
                    "ocean_current": {
                        "score": round(current_risk, 1),
                        "max": 40,
                        "reasoning": f"Downstream infection risk based on {len(downstream_facilities)} facilities",
                    },
                    "vessel_movement": {
                        "score": round(vessel_risk, 1),
                        "max": 30,
                        "reasoning": f"{len(vessel_visits_recent)} vessel visits in last {self.CURRENT_VESSEL_MEMORY_DAYS} days",
                    },
                    "genetic_disease": {
                        "score": round(genetic_risk, 1),
                        "max": 20,
                        "reasoning": f"Wild fish contamination risk factor: {wild_fish_risk_factor}",
                    },
                    "temperature": {
                        "score": round(temperature_risk, 1),
                        "max": 10,
                        "reasoning": f"Current temp {current_temperature}°C (optimal: {self.OPTIMAL_TEMP_MIN}-{self.OPTIMAL_TEMP_MAX}°C)",
                    },
                },
                "timestamp": datetime.utcnow().isoformat(),
            }

            self.logger.info(
                f"Risk calculated for {facility_name}: {alert_level} ({total_score}/100)"
            )
            return result

        except Exception as e:
            self.logger.error(f"Error calculating risk for facility {facility_id}: {e}")
            raise

    def _calculate_current_risk(
        self, lice_count: int, downstream_facilities: List[Dict]
    ) -> float:
        """
        Calculate ocean current risk (0-40).

        If facility has lice, it poses risk to downstream facilities.
        Risk increases with lice count and number of downstream facilities.
        """
        if lice_count == 0:
            # No lice = no current-based risk
            return 0.0

        # Lice count to risk score mapping
        # 1-5 lice: 5 points
        # 6-20 lice: 15 points
        # 21-100 lice: 25 points
        # 100+ lice: 35 points
        if lice_count <= 5:
            base_risk = 5
        elif lice_count <= 20:
            base_risk = 15
        elif lice_count <= 100:
            base_risk = 25
        else:
            base_risk = 35

        # Increase risk if there are downstream facilities
        # (strøm kan føre lus nedstrøms)
        downstream_multiplier = 1.0 + (len(downstream_facilities) * 0.05)

        risk_score = min(40, base_risk * downstream_multiplier)
        return risk_score

    def _calculate_vessel_risk(self, vessel_visits: List[Dict]) -> float:
        """
        Calculate vessel movement risk (0-30).

        Risk based on:
        - Number of recent vessel visits
        - Whether visiting vessels have been to infected facilities
        - Recency of visits to infected facilities
        """
        if not vessel_visits:
            return 0.0

        risk_score = 0.0
        now = datetime.utcnow()

        for visit in vessel_visits:
            visit_date = visit.get("visit_date")
            if isinstance(visit_date, str):
                visit_date = datetime.fromisoformat(visit_date)

            days_ago = (now - visit_date).days

            # Only count visits within 14 days
            if days_ago > self.CURRENT_VESSEL_MEMORY_DAYS:
                continue

            # More recent visits = higher risk
            # Recent visit (0-2 days): 10 points
            # Medium (3-7 days): 5 points
            # Older (8-14 days): 2 points
            if days_ago <= 2:
                risk_score += 10
            elif days_ago <= 7:
                risk_score += 5
            else:
                risk_score += 2

            # If vessel visited infected facility, increase risk
            if visit.get("source_has_lice", False):
                risk_score += 8

        return min(30, risk_score)

    def _calculate_genetic_risk(self, wild_fish_factor: float) -> float:
        """
        Calculate genetic disease risk (0-20).

        Based on wild fish contamination potential.
        Factor ranges 0-1, mapped to 0-20 score.
        """
        return min(20, wild_fish_factor * 20)

    def _calculate_temperature_risk(self, temperature: float) -> float:
        """
        Calculate temperature risk (0-10).

        Lice spawn optimally at 8-14°C.
        Outside this range = lower risk.
        """
        if temperature < self.OPTIMAL_TEMP_MIN:
            # Too cold - risk decreases
            # Below 4°C: 0 points
            # 4-8°C: 2-5 points
            if temperature <= 4:
                return 0.0
            else:
                return (temperature - 4) / 4 * 5

        elif temperature > self.OPTIMAL_TEMP_MAX:
            # Too warm - risk decreases
            # 14-18°C: 5-2 points
            # Above 18°C: 0 points
            if temperature >= 18:
                return 0.0
            else:
                return (18 - temperature) / 4 * 5

        else:
            # Optimal range (8-14°C) = maximum risk
            return 10.0

    def _determine_alert_level(self, score: float) -> str:
        """Determine alert level based on risk score."""
        if score >= self.RED_THRESHOLD:
            return "RED"
        elif score >= self.YELLOW_THRESHOLD:
            return "YELLOW"
        else:
            return "GREEN"

    def calculate_batch_risk(
        self,
        facilities_data: List[Dict],
    ) -> List[Dict]:
        """
        Calculate risk for multiple facilities.

        Args:
            facilities_data: List of facility data dictionaries

        Returns:
            List of risk assessment results
        """
        results = []
        for facility in facilities_data:
            try:
                risk = self.calculate_facility_risk(
                    facility_id=facility.get("facility_id"),
                    facility_name=facility.get("facility_name"),
                    current_lice_count=facility.get("current_lice_count", 0),
                    current_temperature=facility.get("current_temperature", 10.0),
                    vessel_visits_recent=facility.get("vessel_visits", []),
                    downstream_facilities=facility.get("downstream_facilities", []),
                    wild_fish_risk_factor=facility.get("genetic_risk_factor", 0.5),
                )
                results.append(risk)
            except Exception as e:
                self.logger.error(
                    f"Error processing facility {facility.get('facility_id')}: {e}"
                )
                continue

        return results
