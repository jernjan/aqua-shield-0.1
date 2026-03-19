"""Risk calculation service using ocean currents and vessel traffic"""
import math
from typing import Dict, List, Tuple
from datetime import datetime
from ..utils.logger import logger


class RiskCalculationService:
    """
    Advanced risk calculation considering:
    - Ocean currents (particle drift modeling)
    - Vessel traffic (proximity to disease sources)
    - Lice count thresholds
    - Disease presence
    - Temperature
    """

    def __init__(self):
        self.max_drift_distance = 50  # km - max distance for current-based infection
        self.vessel_proximity_threshold = 10  # km - safe distance from infected vessels
        self.update_interval = 24  # hours

    def calculate_facility_risk(
        self,
        facility: Dict,
        nearby_facilities: List[Dict],
        vessels: List[Dict],
        ocean_currents: Dict
    ) -> Dict:
        """
        PREDICTIVE risk model - alerts facilities at RISK of infection, not facilities with existing disease.
        Focuses on external threats:
        - Ocean current infection risk from nearby infected sources (40 points)
        - Vessel history & movement risk (30 points)
        - Disease transmission potential (20 points)
        - Favorable conditions for infection spread (10 points)
        
        Note: Facilities with existing lice/disease get LOWER scores (they already know their status)
        """

        risk_score = 0
        risk_factors = []

        # SKIP FACILITIES THAT ALREADY KNOW THEIR STATUS
        current_lice = facility.get('lice_count', 0)
        current_diseases = facility.get('diseases', [])
        
        # If facility has high lice or diseases, they're already aware
        # Don't alert them - focus on healthy facilities at risk
        if current_lice > 200 or len([d for d in current_diseases if d]) > 0:
            logger.info(f"Facility {facility.get('name')} already has known issues - not alerting")
            return {
                'score': 0,
                'level': 'monitored',
                'factors': ['Facility has known infection - already under observation'],
                'timestamp': datetime.utcnow().isoformat()
            }

        # Factor 1: Ocean current-based infection risk from INFECTED sources (0-40 points)
        # This is the PRIMARY predictive threat
        current_risk = self._calculate_current_infection_risk(
            facility,
            nearby_facilities,
            ocean_currents
        )
        risk_score += current_risk['score']
        if current_risk['score'] > 0:
            risk_factors.append(f"⚠️ Upstream infection source: {current_risk['source']} at {current_risk['distance']:.1f}km ({current_risk['score']}pts)")

        # Factor 2: Vessel movement history risk (0-30 points)
        # Detect wellboats coming from infected locations
        vessel_risk = self._calculate_vessel_history_risk(facility, vessels, nearby_facilities)
        risk_score += vessel_risk['score']
        if vessel_risk['score'] > 0:
            risk_factors.append(f"⚠️ Wellboat from infected area: {vessel_risk['source']} ({vessel_risk['score']}pts)")

        # Factor 3: Disease transmission potential (0-20 points)
        # Genetic disease risk if nearby facilities have it
        disease_risk = self._calculate_transmission_risk(facility, nearby_facilities)
        risk_score += disease_risk['score']
        if disease_risk['score'] > 0:
            risk_factors.append(f"⚠️ Disease transmission risk: {disease_risk['disease']} from {disease_risk['source']} ({disease_risk['score']}pts)")

        # Factor 4: Favorable conditions for infection spread (0-10 points)
        temp_risk = self._calculate_infection_conditions(facility.get('temperature', 12))
        risk_score += temp_risk['score']
        if temp_risk['score'] > 0:
            risk_factors.append(f"⚠️ Favorable infection conditions: {facility.get('temperature', 0)}°C ({temp_risk['score']}pts)")

        # Cap score at 100
        risk_score = min(100, max(0, risk_score))

        # Determine alert level (focus on EXTERNAL threats, not current status)
        alert_level = self._get_alert_level(risk_score)

        return {
            'score': risk_score,
            'level': alert_level,
            'factors': risk_factors,
            'prediction_type': 'external_infection_risk',
            'timestamp': datetime.utcnow().isoformat()
        }

    def _calculate_lice_risk(self, lice_count: int) -> Dict:
        """DEPRECATED - Old model. Facilities already know their lice count."""
        if lice_count < 5:
            return {'score': 0, 'label': 'Low'}
        elif lice_count < 10:
            return {'score': 5, 'label': 'Elevated'}
        elif lice_count < 50:
            return {'score': 15, 'label': 'Moderate'}
        elif lice_count < 200:
            return {'score': 25, 'label': 'High'}
        else:
            return {'score': 40, 'label': 'Critical'}

    def _calculate_disease_risk(self, diseases: List[str]) -> Dict:
        """DEPRECATED - Old model. Facilities already know their disease status."""
        score = 0
        details = []

        disease_weights = {
            'ILA': 35,
            'ISA': 30,
            'PRV': 25,
            'SalmonID': 20,
            'Saprolegnia': 10
        }

        for disease in diseases:
            for disease_name, weight in disease_weights.items():
                if disease_name.lower() in disease.lower():
                    score = max(score, weight)
                    details.append(disease_name)
                    break

        return {'score': min(35, score), 'details': details}

    def _calculate_current_infection_risk(
        self,
        facility: Dict,
        nearby_facilities: List[Dict],
        ocean_currents: Dict
    ) -> Dict:
        """
        PREDICTIVE: Calculate risk that ocean currents carry infection FROM infected sources TO this facility.
        This is the PRIMARY threat model - it predicts if disease can reach this facility from upstream.
        """
        
        facility_lat = facility.get('latitude')
        facility_lon = facility.get('longitude')

        if not facility_lat or not facility_lon:
            return {'score': 0, 'source': 'None', 'distance': 0}

        max_risk = 0
        source_facility = None
        source_distance = 0

        for other in nearby_facilities:
            if other.get('id') == facility.get('id'):
                continue

            other_lat = other.get('latitude')
            other_lon = other.get('longitude')

            if not other_lat or not other_lon:
                continue

            # Check if OTHER facility has infection (not this facility)
            other_lice = other.get('lice_count', 0)
            other_diseases = other.get('diseases', [])
            
            # Only consider as threat if other facility has significant infection
            has_infection = other_lice > 50 or len([d for d in other_diseases if d]) > 0
            if not has_infection:
                continue

            # Calculate distance
            distance = self._haversine(facility_lat, facility_lon, other_lat, other_lon)

            if distance > self.max_drift_distance:
                continue

            # CRITICAL: Check if facility is DOWNSTREAM (in infection path)
            current_direction = ocean_currents.get('direction', 45)  # degrees (0-360)
            bearing_to_facility = self._bearing(other_lat, other_lon, facility_lat, facility_lon)

            # Check if bearing aligns with current (within 90 degree cone downstream)
            angle_diff = abs(bearing_to_facility - current_direction)
            if angle_diff > 180:
                angle_diff = 360 - angle_diff

            if angle_diff > 90:
                continue  # Facility is NOT downstream - safe from current

            # Calculate risk: closer = higher risk, stronger current = higher risk
            current_speed = ocean_currents.get('speed', 0.3)  # m/s
            proximity_risk = 40 * (1 - distance / self.max_drift_distance)
            current_multiplier = 1 + (current_speed / 0.5)  # normalized
            risk_score = proximity_risk * current_multiplier

            if risk_score > max_risk:
                max_risk = risk_score
                source_facility = other.get('name', 'Unknown')
                source_distance = distance

        return {
            'score': min(40, int(max_risk)),
            'source': source_facility or 'None',
            'distance': source_distance
        }

    def _calculate_vessel_history_risk(
        self, 
        facility: Dict, 
        vessels: List[Dict],
        nearby_facilities: List[Dict]
    ) -> Dict:
        """
        PREDICTIVE: Detect wellboats that have been to infected locations and are now near this facility.
        This predicts transmission risk from vessel movement history.
        """
        
        facility_lat = facility.get('latitude')
        facility_lon = facility.get('longitude')

        if not facility_lat or not facility_lon:
            return {'score': 0, 'source': 'None'}

        max_risk = 0
        risk_source = None

        for vessel in vessels:
            vessel_lat = vessel.get('latitude')
            vessel_lon = vessel.get('longitude')
            vessel_type = vessel.get('type', 'Unknown')
            last_visited = vessel.get('last_visited', [])  # List of location IDs

            if not vessel_lat or not vessel_lon:
                continue

            # Only wellboats are vectors for disease
            if not ('wellboat' in vessel_type.lower() or 'båt' in vessel_type.lower()):
                continue

            # Calculate distance to this facility
            distance_to_facility = self._haversine(facility_lat, facility_lon, vessel_lat, vessel_lon)

            # Check if wellboat has visited infected facilities recently
            infection_history_risk = 0
            infected_source = None

            for visited_id in last_visited:
                for other_facility in nearby_facilities:
                    if other_facility.get('barentswatch_id') == visited_id or other_facility.get('id') == visited_id:
                        # Check if this visited facility had infection
                        if other_facility.get('lice_count', 0) > 50 or len([d for d in other_facility.get('diseases', []) if d]) > 0:
                            infection_history_risk = 25  # High risk - boat was at infected location
                            infected_source = other_facility.get('name', 'Unknown')
                            break

            if infection_history_risk == 0:
                continue  # Boat wasn't at infected locations

            # Calculate proximity risk
            if distance_to_facility < self.vessel_proximity_threshold:
                proximity_multiplier = 1 - (distance_to_facility / self.vessel_proximity_threshold) * 0.5
                risk_score = infection_history_risk * proximity_multiplier
                
                if risk_score > max_risk:
                    max_risk = risk_score
                    risk_source = f"{vessel_type} from {infected_source}"

        return {
            'score': min(30, int(max_risk)),
            'source': risk_source or 'None'
        }

    def _calculate_transmission_risk(
        self,
        facility: Dict,
        nearby_facilities: List[Dict]
    ) -> Dict:
        """
        PREDICTIVE: Calculate genetic disease transmission risk.
        If nearby facilities have specific diseases, this facility is at risk.
        """
        
        facility_lat = facility.get('latitude')
        facility_lon = facility.get('longitude')

        if not facility_lat or not facility_lon:
            return {'score': 0, 'disease': 'None', 'source': 'None'}

        disease_risk_weight = {
            'ILA': 20,  # Highly transmissible
            'ISA': 18,  # Highly transmissible
            'PRV': 12,  # Moderate transmission
            'SalmonID': 8,
            'Saprolegnia': 5
        }

        max_risk = 0
        source_disease = None
        source_facility = None

        for other in nearby_facilities:
            if other.get('id') == facility.get('id'):
                continue

            other_lat = other.get('latitude')
            other_lon = other.get('longitude')
            other_diseases = other.get('diseases', [])

            if not other_lat or not other_lon or not other_diseases:
                continue

            distance = self._haversine(facility_lat, facility_lon, other_lat, other_lon)
            
            if distance > 30:  # Genetic disease transmission over 30km is unlikely
                continue

            for disease in other_diseases:
                for disease_name, weight in disease_risk_weight.items():
                    if disease_name.lower() in disease.lower():
                        distance_factor = 1 - (distance / 30)
                        risk_score = weight * distance_factor
                        
                        if risk_score > max_risk:
                            max_risk = risk_score
                            source_disease = disease_name
                            source_facility = other.get('name', 'Unknown')
                        break

        return {
            'score': min(20, int(max_risk)),
            'disease': source_disease or 'None',
            'source': source_facility or 'None'
        }

    def _calculate_infection_conditions(self, temperature: float) -> Dict:
        """
        PREDICTIVE: Calculate if conditions favor infection establishment.
        Optimal temperature for lice = 10-15°C. Higher temp = higher reproduction if infection arrives.
        """
        
        if temperature < 6 or temperature > 20:
            return {'score': 0}  # Too cold or warm for lice to survive/thrive
        elif temperature < 8 or temperature > 18:
            return {'score': 2}  # Suboptimal for infection
        elif temperature < 10 or temperature > 16:
            return {'score': 5}  # Less optimal but still favorable
        else:
            return {'score': 10}  # OPTIMAL for infection establishment (10-15°C)

    def _get_alert_level(self, score: int) -> str:
        """Determine alert level from risk score"""
        if score >= 70:
            return 'red'
        elif score >= 40:
            return 'yellow'
        else:
            return 'green'

    @staticmethod
    def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Calculate distance between two points in km"""
        R = 6371  # Earth radius in km
        phi1 = math.radians(lat1)
        phi2 = math.radians(lat2)
        delta_phi = math.radians(lat2 - lat1)
        delta_lambda = math.radians(lon2 - lon1)

        a = (math.sin(delta_phi / 2) ** 2 +
             math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2)
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

        return R * c

    @staticmethod
    def _bearing(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Calculate bearing from point 1 to point 2 in degrees"""
        lon1, lat1, lon2, lat2 = map(math.radians, [lon1, lat1, lon2, lat2])
        dlon = lon2 - lon1
        y = math.sin(dlon) * math.cos(lat2)
        x = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dlon)
        bearing = math.degrees(math.atan2(y, x))
        return (bearing + 360) % 360
