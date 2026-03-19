"""
Vessel Proximity Detection - 3km Smittesone

Detects when vessels come within 3km of infected facilities.
Generates proximity alerts for dashboard.
"""

from typing import List, Dict, Tuple
from math import radians, cos, sin, asin, sqrt
import logging
from datetime import datetime

logger = logging.getLogger(__name__)


class VesselProximityDetector:
    """Detect vessels within proximity zones of facilities."""

    PROXIMITY_RADIUS_KM = 3.0  # 3km smittesone

    def __init__(self):
        """Initialize proximity detector."""
        self.logger = logger

    def calculate_distance(
        self, lat1: float, lon1: float, lat2: float, lon2: float
    ) -> float:
        """
        Calculate distance between two coordinates in kilometers using Haversine formula.

        Args:
            lat1, lon1: First point coordinates
            lat2, lon2: Second point coordinates

        Returns:
            Distance in kilometers
        """
        try:
            # Convert decimal degrees to radians
            lon1, lat1, lon2, lat2 = map(radians, [lon1, lat1, lon2, lat2])

            # Haversine formula
            dlon = lon2 - lon1
            dlat = lat2 - lat1
            a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
            c = 2 * asin(sqrt(a))
            r = 6371  # Radius of earth in kilometers

            return c * r
        except Exception as e:
            self.logger.error(f"Error calculating distance: {e}")
            return float("inf")

    def detect_proximity_threats(
        self,
        vessels: List[Dict],
        facilities: List[Dict],
    ) -> List[Dict]:
        """
        Detect all vessels within 3km of infected facilities.

        Args:
            vessels: List of vessel dicts with lat/lon and name
            facilities: List of facility dicts with lat/lon, name, and lice_count

        Returns:
            List of proximity threat alerts
        """
        threats = []

        # Only check facilities that have lice
        infected_facilities = [f for f in facilities if f.get("current_lice_count", 0) > 0]

        if not infected_facilities:
            self.logger.debug("No infected facilities - no proximity threats")
            return threats

        # Check each vessel against each infected facility
        for vessel in vessels:
            try:
                vessel_lat = vessel.get("latitude")
                vessel_lon = vessel.get("longitude")
                vessel_id = vessel.get("vessel_id")
                vessel_name = vessel.get("vessel_name")

                if vessel_lat is None or vessel_lon is None:
                    continue

                for facility in infected_facilities:
                    facility_lat = facility.get("latitude")
                    facility_lon = facility.get("longitude")
                    facility_id = facility.get("facility_id")
                    facility_name = facility.get("facility_name")
                    lice_count = facility.get("current_lice_count", 0)

                    if facility_lat is None or facility_lon is None:
                        continue

                    # Calculate distance
                    distance = self.calculate_distance(
                        vessel_lat, vessel_lon, facility_lat, facility_lon
                    )

                    # Check if within 3km
                    if distance <= self.PROXIMITY_RADIUS_KM:
                        threat = {
                            "vessel_id": vessel_id,
                            "vessel_name": vessel_name,
                            "vessel_position": {"latitude": vessel_lat, "longitude": vessel_lon},
                            "facility_id": facility_id,
                            "facility_name": facility_name,
                            "facility_position": {
                                "latitude": facility_lat,
                                "longitude": facility_lon,
                            },
                            "distance_km": round(distance, 2),
                            "facility_lice_count": lice_count,
                            "threat_level": self._assess_threat_level(distance, lice_count),
                            "timestamp": datetime.utcnow().isoformat(),
                            "alert_message": f"Vessel {vessel_name} is {distance:.1f}km from {facility_name} (lice: {lice_count})",
                        }
                        threats.append(threat)
                        self.logger.warning(threat["alert_message"])

            except Exception as e:
                self.logger.error(
                    f"Error checking vessel {vessel.get('vessel_id')}: {e}"
                )
                continue

        return threats

    def _assess_threat_level(self, distance_km: float, lice_count: int) -> str:
        """
        Assess threat level based on distance and lice count.

        Args:
            distance_km: Distance to infected facility
            lice_count: Number of lice at facility

        Returns:
            Threat level: CRITICAL, HIGH, MEDIUM, LOW
        """
        if distance_km < 0.5 and lice_count > 50:
            return "CRITICAL"  # Very close to high-infection facility
        elif distance_km < 1.0 and lice_count > 20:
            return "HIGH"  # Close to infected facility
        elif distance_km < 2.0:
            return "MEDIUM"  # Within 2km
        else:
            return "LOW"  # 2-3km range

    def get_vessels_in_proximity(
        self, facility_id: str, facility_lat: float, facility_lon: float, vessels: List[Dict]
    ) -> List[Dict]:
        """
        Get all vessels currently within 3km of a specific facility.

        Args:
            facility_id: Facility identifier
            facility_lat, facility_lon: Facility coordinates
            vessels: List of all vessels

        Returns:
            List of vessels in proximity with distances
        """
        nearby_vessels = []

        for vessel in vessels:
            try:
                vessel_lat = vessel.get("latitude")
                vessel_lon = vessel.get("longitude")

                if vessel_lat is None or vessel_lon is None:
                    continue

                distance = self.calculate_distance(
                    vessel_lat, vessel_lon, facility_lat, facility_lon
                )

                if distance <= self.PROXIMITY_RADIUS_KM:
                    nearby_vessels.append(
                        {
                            "vessel_id": vessel.get("vessel_id"),
                            "vessel_name": vessel.get("vessel_name"),
                            "distance_km": round(distance, 2),
                            "position": {"latitude": vessel_lat, "longitude": vessel_lon},
                            "timestamp": vessel.get("timestamp"),
                        }
                    )
            except Exception as e:
                self.logger.error(f"Error checking vessel proximity: {e}")
                continue

        return sorted(nearby_vessels, key=lambda x: x["distance_km"])
