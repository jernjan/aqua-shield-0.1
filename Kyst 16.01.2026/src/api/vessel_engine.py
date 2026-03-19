"""Vessel risk assessment engine for aquaculture exposure."""

from dataclasses import dataclass
from typing import Optional, List, Dict, Any
import math
from src.api.ship_cache import get_ship_name, cache_ship_name


@dataclass
class VesselRiskAssessment:
    """Vessel risk assessment near diseased facilities."""
    mmsi: str
    vessel_name: str
    vessel_type: str
    latitude: float
    longitude: float
    risk_level: str  # HIGH, MODERATE, NONE
    closest_diseased_facility: Optional[Dict[str, Any]]
    exposure_summary: str


class VesselRiskEngine:
    """Engine for calculating vessel exposure to diseased aquaculture facilities."""

    # Risk thresholds
    RISK_THRESHOLDS = {
        "HIGH": 1.0,      # < 1 km
        "MODERATE": 5.0,  # 1-5 km
    }

    def __init__(self, facilities_data: List[Dict[str, Any]]):
        """Initialize with facility data."""
        self.facilities = facilities_data

    def assess_vessel_risk(
        self, vessel: Dict[str, Any]
    ) -> Optional[VesselRiskAssessment]:
        """Assess a single vessel's exposure to diseased facilities.
        
        Args:
            vessel: Vessel data from AIS with mmsi, latitude, longitude, etc.
        
        Returns:
            VesselRiskAssessment or None if no valid vessel data
        """
        try:
            # Handle both uppercase (old format) and lowercase (new AIS format)
            mmsi = str(vessel.get("MMSI") or vessel.get("mmsi") or "UNKNOWN")
            name = vessel.get("Name") or vessel.get("name")
            
            # Try to get cached ship name if not provided
            if not name or name == "Unknown Vessel":
                cached_name = get_ship_name(mmsi)
                if cached_name:
                    name = cached_name
                else:
                    name = "Unknown Vessel"
            else:
                # Cache the name if we have a good one
                cache_ship_name(mmsi, name)
            
            vessel_type = vessel.get("Type") or vessel.get("type") or "Unknown"
            latitude = vessel.get("Latitude") or vessel.get("latitude")
            longitude = vessel.get("Longitude") or vessel.get("longitude")

            if latitude is None or longitude is None:
                return None

            # Find nearest diseased facility
            nearest = self._find_nearest_diseased_facility(latitude, longitude)

            if not nearest:
                return VesselRiskAssessment(
                    mmsi=mmsi,
                    vessel_name=name,
                    vessel_type=vessel_type,
                    latitude=latitude,
                    longitude=longitude,
                    risk_level="NONE",
                    closest_diseased_facility=None,
                    exposure_summary="No diseased facilities nearby"
                )

            distance = nearest["distance"]

            # Determine risk level
            if distance <= self.RISK_THRESHOLDS["HIGH"]:
                risk_level = "HIGH"
                summary = f"VARSELLAMPE: {name} er {distance:.2f} km fra {nearest['facility_name']} ({nearest['diseases']})"
            elif distance <= self.RISK_THRESHOLDS["MODERATE"]:
                risk_level = "MODERATE"
                summary = f"Advarsel: {name} er {distance:.2f} km fra {nearest['facility_name']} ({nearest['diseases']})"
            else:
                risk_level = "NONE"
                summary = f"Ingen fare: {distance:.1f} km fra {nearest['facility_name']}"

            return VesselRiskAssessment(
                mmsi=mmsi,
                vessel_name=name,
                vessel_type=vessel_type,
                latitude=latitude,
                longitude=longitude,
                risk_level=risk_level,
                closest_diseased_facility=nearest,
                exposure_summary=summary
            )

        except Exception as e:
            print(f"Error assessing vessel: {e}")
            return None

    def _find_nearest_diseased_facility(
        self, vessel_lat: float, vessel_lon: float
    ) -> Optional[Dict[str, Any]]:
        """Find nearest facility with disease within max 5 km."""
        max_distance = self.RISK_THRESHOLDS["MODERATE"]
        nearest = None
        nearest_distance = max_distance

        for facility in self.facilities:
            try:
                # Check if facility has disease
                diseases = facility.get("diseases", [])
                if not diseases:
                    continue

                # Extract coordinates
                coords = facility["geometry"]["coordinates"]
                facility_lat = coords[1]
                facility_lon = coords[0]

                # Calculate distance
                distance = self._calculate_distance(
                    vessel_lat, vessel_lon, facility_lat, facility_lon
                )

                # Keep track of nearest
                if distance < nearest_distance:
                    nearest_distance = distance
                    
                    # Build disease names
                    disease_names = []
                    for disease in diseases:
                        if isinstance(disease, dict):
                            name = disease.get("name", "").upper()
                        else:
                            name = str(disease).upper()
                        
                        # Map disease names
                        if "INFEKSIOES_LAKSEANEMI" in name or "ILA" in name:
                            disease_names.append("ILA")
                        elif "PANKREASSYKDOM" in name or "PD" in name:
                            disease_names.append("PD")
                        elif disease not in disease_names:
                            disease_names.append(name)
                    
                    nearest = {
                        "facility_name": facility["locality"]["name"],
                        "facility_code": facility["locality"]["no"],
                        "distance": distance,
                        "diseases": ", ".join(disease_names) if disease_names else "Ukjent",
                        "latitude": facility_lat,
                        "longitude": facility_lon,
                    }
            except (KeyError, TypeError, AttributeError):
                continue

        return nearest if nearest and nearest_distance < max_distance else None

    def _calculate_distance(
        self, lat1: float, lon1: float, lat2: float, lon2: float
    ) -> float:
        """Calculate distance between two points in km (Haversine formula)."""
        R = 6371  # Earth's radius in km

        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        delta_lat = math.radians(lat2 - lat1)
        delta_lon = math.radians(lon2 - lon1)

        a = (
            math.sin(delta_lat / 2) ** 2 +
            math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon / 2) ** 2
        )
        c = 2 * math.asin(math.sqrt(a))

        return R * c
