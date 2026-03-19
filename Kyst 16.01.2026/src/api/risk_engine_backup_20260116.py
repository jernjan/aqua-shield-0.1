"""Risk assessment engine for aquaculture facilities.

BACKUP VERSION - Created 2026-01-16 before vessel integration
"""

from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any
import math


@dataclass
class RiskFactors:
    """Individual risk factors for a facility."""
    disease_proximity: Optional[float]  # None if no real data
    disease_prevalence: Optional[float]  # None if no disease detected
    water_exchange: Optional[float]  # None if no current data
    farm_density: Optional[float]
    lice_level: Optional[float]
    overall: float


@dataclass
class RiskAssessment:
    """Complete risk assessment for a facility."""
    facility_code: str
    facility_name: str
    location: Dict[str, float]  # {latitude, longitude}
    risk_score: float
    risk_level: str
    factors: RiskFactors
    lice_data: Dict[str, Optional[float]]  # {adult_female_lice, mobile_lice}
    has_ila: bool
    has_pd: bool
    biggest_risk_factor: str  # Which factor drives the risk
    disease_sources: List[Dict[str, Any]]  # Nearby diseased facilities
    assessment_date: str


class RiskEngine:
    """Engine for calculating aquaculture facility risk scores."""

    # Disease-specific distance models (from Grok/Havforskningsinstituttet data)
    DISEASE_DISTANCE_MODEL = {
        "ILA": {"high_risk_km": (5, 15), "max_km": 50},  # 5-15 km high risk, max 20-50 km
        "PD": {"high_risk_km": (10, 30), "max_km": 50},  # 10-30 km high risk, max 50+ km
        "LICE": {"high_risk_km": (7, 30), "max_km": 50},  # 7-30 km high risk, max 100-200+ km (limit to 50)
    }

    def __init__(self, facilities_data: List[Dict[str, Any]]):
        """Initialize with facility data from BarentsWatch v2 API."""
        self.facilities = facilities_data
        self.facilities_by_code = {f["locality"]["no"]: f for f in facilities_data}

    def assess_all(self) -> List[RiskAssessment]:
        """Assess all facilities in the dataset."""
        assessments = []
        for facility in self.facilities:
            assessment = self.assess_farm(facility)
            if assessment:
                assessments.append(assessment)
        return assessments

    def assess_farm(self, facility: Dict[str, Any]) -> Optional[RiskAssessment]:
        """Assess a single facility's risk level."""
        try:
            facility_code = facility["locality"]["no"]
            facility_name = facility["locality"]["name"]
            
            # Extract real GPS coordinates from GeoJSON
            coords = facility["geometry"]["coordinates"]
            latitude = coords[1]
            longitude = coords[0]
            
            # Extract lice data - handle nested dict structure
            lice_data = self._extract_lice_data(facility)
            
            # Extract disease data
            has_ila, has_pd = self._extract_disease_data(facility)
            
            # Calculate risk factors
            disease_proximity = self.score_disease_proximity(latitude, longitude)
            disease_prevalence = self.score_disease_prevalence(facility)
            farm_density = self.score_farm_density(latitude, longitude)
            water_exchange = self.score_water_exchange(latitude, longitude)
            lice_level = self.score_lice_level(lice_data)
            
            # Calculate overall score
            overall_score = self._calculate_overall_score(
                disease_proximity, disease_prevalence, farm_density, water_exchange, lice_level
            )
            
            # Determine risk level
            risk_level = self._determine_risk_level(overall_score)
            
            # Get disease sources
            disease_sources = self._get_disease_sources(latitude, longitude, facility_code)
            
            # Identify biggest risk factor (prioritize disease sources)
            biggest_risk_factor = self._identify_biggest_risk_factor(
                disease_sources, disease_proximity, disease_prevalence, farm_density, water_exchange, lice_level
            )
            
            factors = RiskFactors(
                disease_proximity=disease_proximity,
                disease_prevalence=disease_prevalence,
                water_exchange=water_exchange,
                farm_density=farm_density,
                lice_level=lice_level,
                overall=overall_score
            )
            
            return RiskAssessment(
                facility_code=facility_code,
                facility_name=facility_name,
                location={"latitude": latitude, "longitude": longitude},
                risk_score=overall_score,
                risk_level=risk_level,
                factors=factors,
                lice_data=lice_data,
                has_ila=has_ila,
                has_pd=has_pd,
                biggest_risk_factor=biggest_risk_factor,
                disease_sources=disease_sources,
                assessment_date="2026-01-16T10:30:00"
            )
        except Exception as e:
            print(f"Error assessing farm: {e}")
            return None

    def _extract_lice_data(self, facility: Dict[str, Any]) -> Dict[str, Optional[float]]:
        """Extract real lice counts from nested liceReport structure."""
        lice_data = {
            "adult_female_lice": None,
            "mobile_lice": None
        }
        
        try:
            lice_report = facility.get("liceReport", {})
            if lice_report:
                # Handle nested dict structure: {average: 0.38}
                adult_female = lice_report.get("adultFemaleLice", {})
                if isinstance(adult_female, dict):
                    lice_data["adult_female_lice"] = adult_female.get("average")
                else:
                    lice_data["adult_female_lice"] = adult_female
                
                mobile = lice_report.get("mobileLice", {})
                if isinstance(mobile, dict):
                    lice_data["mobile_lice"] = mobile.get("average")
                else:
                    lice_data["mobile_lice"] = mobile
        except Exception:
            pass
        
        return lice_data

    def _extract_disease_data(self, facility: Dict[str, Any]) -> tuple[bool, bool]:
        """Extract disease presence from facility data."""
        has_ila = False
        has_pd = False
        
        try:
            diseases = facility.get("diseases", [])
            for disease in diseases:
                # Handle both dict format {name: "..."} and string format
                if isinstance(disease, dict):
                    name = disease.get("name", "").upper()
                else:
                    name = str(disease).upper()
                
                # Map disease names
                if "INFEKSIOES_LAKSEANEMI" in name or "ILA" in name:
                    has_ila = True
                elif "PANKREASSYKDOM" in name or "PD" in name:
                    has_pd = True
        except Exception:
            pass
        
        return has_ila, has_pd

    def score_disease_proximity(self, latitude: float, longitude: float) -> Optional[float]:
        """Score based on proximity to diseased farms using disease-specific models (30% weight)."""
        diseased_farms = self._find_diseased_facilities(latitude, longitude, radius=50)  # Max 50km
        
        if not diseased_farms:
            return 0.0  # No diseased farms nearby = low risk from proximity
        
        # Calculate weighted score based on distance and disease type
        total_weight = 0.0
        weighted_score = 0.0
        
        for farm in diseased_farms:
            distance = farm["distance"]
            disease_type = farm.get("disease_type", "LICE")  # ILA, PD, or LICE
            
            # Get disease-specific model
            model = self.DISEASE_DISTANCE_MODEL.get(disease_type, self.DISEASE_DISTANCE_MODEL["LICE"])
            high_risk_min, high_risk_max = model["high_risk_km"]
            
            # Score based on distance relative to disease model
            if distance <= high_risk_min:
                # Within optimal transmission range - highest risk
                risk_score = 100.0
            elif distance <= high_risk_max:
                # In high risk range - proportional score
                risk_score = 100.0 * (1 - (distance - high_risk_min) / (high_risk_max - high_risk_min))
            else:
                # Beyond high risk range but within max 50km - diminishing risk
                risk_score = max(0, 30.0 * (1 - (distance - high_risk_max) / (50 - high_risk_max)))
            
            # Weight by inverse distance (closer = more weight)
            weight = math.exp(-distance / 25.0)
            weighted_score += risk_score * weight
            total_weight += weight
        
        if total_weight > 0:
            return min(weighted_score / total_weight, 100.0)
        
        return 0.0

    def score_disease_prevalence(self, facility: Dict[str, Any]) -> Optional[float]:
        """Score based on disease detection at this facility (20% weight)."""
        # Only return score if disease detected
        diseases = facility.get("diseases", [])
        if not diseases:
            return None  # NO FAKE DATA - return None if no disease
        
        # If disease detected, return moderate score
        return 50.0

    def score_farm_density(self, latitude: float, longitude: float) -> Optional[float]:
        """Score based on density of farms nearby (15% weight)."""
        nearby_farms = self._find_nearby_facilities(latitude, longitude, radius=80)
        
        # Normalize to 0-100 scale
        # 0 farms = 0, 20+ farms = 100
        farm_count = len(nearby_farms)
        score = min(farm_count / 20.0 * 100.0, 100.0)
        
        return score

    def score_water_exchange(self, latitude: float, longitude: float) -> Optional[float]:
        """Score based on water exchange/current velocity (15% weight)."""
        # Return None if no real current velocity data available
        return None  # NO FAKE DATA

    def score_lice_level(self, lice_data: Dict[str, Optional[float]]) -> Optional[float]:
        """Score based on lice levels (20% weight)."""
        adult_female = lice_data.get("adult_female_lice")
        mobile = lice_data.get("mobile_lice")
        
        if adult_female is None and mobile is None:
            return None  # No real lice data
        
        score = 0.0
        
        # Adult female lice scoring (60% of lice score)
        if adult_female is not None:
            # Threshold: 0.5 lice
            adult_score = min(adult_female / 0.5 * 60.0, 60.0) if adult_female > 0 else 0.0
            score += adult_score
        
        # Mobile lice scoring (40% of lice score)
        if mobile is not None:
            # Threshold: 3.0 lice
            mobile_score = min(mobile / 3.0 * 40.0, 40.0) if mobile > 0 else 0.0
            score += mobile_score
        
        return min(score, 100.0)

    def _find_diseased_facilities(
        self, latitude: float, longitude: float, radius: float = 50
    ) -> List[Dict[str, Any]]:
        """Find facilities with disease within radius (km), limited to max 50km."""
        # Enforce max 50km limit
        radius = min(radius, 50)
        diseased = []
        
        for facility in self.facilities:
            has_ila, has_pd = self._extract_disease_data(facility)
            if not (has_ila or has_pd):
                continue  # Skip facilities without disease
            
            coords = facility["geometry"]["coordinates"]
            dist = self._calculate_distance(latitude, longitude, coords[1], coords[0])
            
            if 0 < dist <= radius:  # Exclude self (distance 0)
                # Determine disease type for this facility
                disease_type = "ILA" if has_ila else ("PD" if has_pd else "LICE")
                diseased.append({
                    "facility": facility,
                    "distance": dist,
                    "disease_type": disease_type
                })
        
        return sorted(diseased, key=lambda x: x["distance"])

    def _find_nearby_facilities(
        self, latitude: float, longitude: float, radius: float = 80
    ) -> List[Dict[str, Any]]:
        """Find any facilities within radius (km)."""
        nearby = []
        for facility in self.facilities:
            coords = facility["geometry"]["coordinates"]
            dist = self._calculate_distance(latitude, longitude, coords[1], coords[0])
            
            if 0 < dist <= radius:  # Exclude self
                nearby.append({
                    "facility": facility,
                    "distance": dist
                })
        
        return nearby

    def _get_disease_sources(
        self, latitude: float, longitude: float, exclude_code: str
    ) -> List[Dict[str, Any]]:
        """Get diseased facilities within 50km max with their lice data and risk category."""
        sources = []
        
        for facility in self.facilities:
            facility_code = facility["locality"]["no"]
            if facility_code == exclude_code:
                continue  # Skip self
            
            has_ila, has_pd = self._extract_disease_data(facility)
            if not (has_ila or has_pd):
                continue  # Only include diseased facilities
            
            coords = facility["geometry"]["coordinates"]
            distance = self._calculate_distance(latitude, longitude, coords[1], coords[0])
            
            if distance > 50:  # Max 50km - beyond this too much uncertainty
                continue
            
            lice_data = self._extract_lice_data(facility)
            
            diseases = []
            disease_type = None
            if has_ila:
                diseases.append("ILA")
                disease_type = "ILA"
            if has_pd:
                diseases.append("PD")
                if not disease_type:  # PD only if no ILA
                    disease_type = "PD"
            
            # Determine risk category based on disease type and distance
            model = self.DISEASE_DISTANCE_MODEL.get(disease_type, self.DISEASE_DISTANCE_MODEL["LICE"])
            high_risk_min, high_risk_max = model["high_risk_km"]
            
            if distance <= high_risk_min:
                risk_category = f"Very High ({distance:.1f} km)"
            elif distance <= high_risk_max:
                risk_category = f"High ({distance:.1f} km)"
            else:
                risk_category = f"Moderate ({distance:.1f} km)"
            
            sources.append({
                "facility_name": facility["locality"]["name"],
                "facility_code": facility_code,
                "distance_km": round(distance, 1),
                "diseases": diseases,
                "disease_type": disease_type,
                "risk_category": risk_category,
                "adult_female_lice": lice_data.get("adult_female_lice"),
                "mobile_lice": lice_data.get("mobile_lice")
            })
        
        return sorted(sources, key=lambda x: x["distance_km"])

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

    def _calculate_overall_score(
        self,
        disease_proximity: Optional[float],
        disease_prevalence: Optional[float],
        farm_density: Optional[float],
        water_exchange: Optional[float],
        lice_level: Optional[float]
    ) -> float:
        """Calculate overall risk score using weighted average."""
        # Weights
        weights = {
            "disease_proximity": 0.30,
            "disease_prevalence": 0.20,
            "farm_density": 0.15,
            "water_exchange": 0.15,
            "lice_level": 0.20
        }
        
        total_score = 0.0
        total_weight = 0.0
        
        # Add only factors with real data (not None)
        if disease_proximity is not None:
            total_score += disease_proximity * weights["disease_proximity"]
            total_weight += weights["disease_proximity"]
        
        if disease_prevalence is not None:
            total_score += disease_prevalence * weights["disease_prevalence"]
            total_weight += weights["disease_prevalence"]
        
        if farm_density is not None:
            total_score += farm_density * weights["farm_density"]
            total_weight += weights["farm_density"]
        
        if water_exchange is not None:
            total_score += water_exchange * weights["water_exchange"]
            total_weight += weights["water_exchange"]
        
        if lice_level is not None:
            total_score += lice_level * weights["lice_level"]
            total_weight += weights["lice_level"]
        
        # Normalize by available weights
        if total_weight > 0:
            return total_score / total_weight
        
        return 0.0

    def _determine_risk_level(self, score: float) -> str:
        """Determine risk level from score."""
        if score >= 75:
            return "Critical"
        elif score >= 50:
            return "High"
        elif score >= 25:
            return "Medium"
        else:
            return "Low"

    def _identify_biggest_risk_factor(
        self,
        disease_sources: List[Dict[str, Any]],
        disease_proximity: Optional[float],
        disease_prevalence: Optional[float],
        farm_density: Optional[float],
        water_exchange: Optional[float],
        lice_level: Optional[float]
    ) -> str:
        """Identify biggest risk factor - prioritize disease sources if they exist."""
        # If disease sources exist, the closest one is the biggest risk
        if disease_sources:
            closest = disease_sources[0]  # Already sorted by distance
            diseases = ", ".join(closest["diseases"]) if closest["diseases"] else "Ukjent"
            adult_lice = closest["adult_female_lice"] if closest["adult_female_lice"] is not None else 0
            mobile_lice = closest["mobile_lice"] if closest["mobile_lice"] is not None else 0
            risk_category = closest.get("risk_category", f"({closest['distance_km']} km)")
            facility_name = closest["facility_name"]
            
            return f"{facility_name} {diseases} {risk_category}, Lus {adult_lice:.2f}/{mobile_lice:.2f}"
        
        # Otherwise, find the factor with highest score
        factors = {}
        if disease_proximity is not None:
            factors["Disease Proximity"] = disease_proximity
        if disease_prevalence is not None:
            factors["Disease Prevalence"] = disease_prevalence
        if farm_density is not None:
            factors["Farm Density"] = farm_density
        if water_exchange is not None:
            factors["Water Exchange"] = water_exchange
        if lice_level is not None:
            factors["Lice Level"] = lice_level
        
        if not factors:
            return "N/A"
        
        return max(factors, key=factors.get)
