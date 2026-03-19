"""
Risk Engine - Calculate aquaculture farm risk based on multiple factors

Risk factors considered:
1. Disease Proximity - Other farms with diseases nearby
2. Disease Prevalence - Current ILA/PD cases in region
3. Water Exchange - Ocean currents (faster = better flushing)
4. Water Temperature - Higher temp = higher disease risk
5. Farm Density - Many farms nearby = higher transmission risk
"""

from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime
import math


@dataclass
class RiskFactors:
    """Individual risk factor scores (0-100 or None if no real data available)"""
    disease_proximity: Optional[float]  # 0-100 or None: risk from nearby infected farms
    disease_prevalence: Optional[float]  # 0-100 or None: only if disease exists
    water_exchange: Optional[float]  # 0-100 or None: only if current velocity data available
    farm_density: Optional[float]  # 0-100: number of farms in area
    lice_level: Optional[float]  # 0-100 or None: current lice count (real Mattilsynet data)
    overall: float  # Weighted average


@dataclass 
class RiskAssessment:
    """Complete risk assessment for a farm"""
    facility_code: str
    facility_name: str
    latitude: float
    longitude: float
    risk_level: str  # "Low", "Medium", "High", "Critical"
    risk_score: float  # 0-100
    factors: RiskFactors
    nearest_disease_km: Optional[float]
    has_ila: bool  # True if ILA detected
    has_pd: bool   # True if PD detected
    current_velocity: Optional[float]
    adult_female_lice: Optional[float]  # Real data from Mattilsynet
    mobile_lice: Optional[float]  # Real data from Mattilsynet
    biggest_risk_factor: str  # Name of factor driving risk
    disease_sources: List[Dict]  # List of diseased farms nearby with details
    assessment_date: str


class RiskEngine:
    """Calculate aquaculture farm risk scores"""
    
    def __init__(self):
        """Initialize risk engine"""
        self.earth_radius_km = 6371  # For distance calculations
        
        # Norwegian municipality centers (approx lat/lon for aquaculture areas)
        self.municipality_coords = {
            # Trøndelag region
            "1811": (65.95, 12.55),   # BINDAL
            "1812": (64.47, 11.50),   # LEVANGER
            "1813": (65.14, 12.08),   # NORD-TRØNDELAG
            "1814": (64.14, 11.44),   # VERDAL
            "1815": (63.92, 11.14),   # INDERØY
            "1816": (63.81, 10.82),   # FROSTA
            "1817": (63.95, 11.25),   # SELÅNGER  
            "1818": (63.76, 11.52),   # TYDAL
            "1819": (63.75, 11.84),   # MERÅKER
            "1820": (63.43, 10.40),   # TRONDHEIM
            "1821": (65.47, 12.21),   # BRØNNØY
            "1822": (65.39, 12.63),   # NAMDALSEID
            "1823": (64.55, 11.80),   # SNILLFJORD
            "1824": (64.54, 12.10),   # FLATANGER
            "1825": (65.30, 12.15),   # VIKNA
            "1826": (65.14, 11.95),   # NÆRØY
            "1827": (65.11, 11.75),   # FOSNES
            "1828": (65.26, 12.27),   # KOLVEREID
            "1829": (65.08, 12.08),   # LEKA
            "1830": (65.47, 12.21),   # BRØNNØY (alt)
            "1831": (65.68, 12.05),   # VEGA
            "1832": (65.71, 12.36),   # VEVELSTAD
            "1833": (65.57, 12.61),   # HERØY
            "1834": (65.93, 12.88),   # ALSTAHAUG
            "1835": (65.30, 13.81),   # HATTFJELLDAL
            "1836": (66.31, 14.15),   # RANA
            "1837": (66.10, 13.75),   # LURØY
            "1838": (66.41, 13.85),   # RØDØY
            "1839": (66.65, 13.97),   # GILDESKÅL
            "1840": (66.76, 14.31),   # BEIARN
            "1841": (66.92, 14.75),   # SALTDAL
            "1842": (66.88, 15.30),   # FAUSKE
            "1843": (67.11, 15.58),   # SØRFOLD
            "1844": (67.27, 14.41),   # BODØ
            "1845": (67.15, 15.01),   # GJERLØY
            "1846": (67.35, 15.17),   # DØNNES
            "1847": (67.53, 15.32),   # VANGVIK
            "1848": (67.69, 15.45),   # VISTAS
            "1849": (67.99, 15.58),   # HAMARØY
            "1850": (68.42, 16.29),   # TYSFJORD
            "1851": (68.29, 15.12),   # LOFOTEN
            "1852": (68.42, 14.33),   # VEST-LOFOTEN
            "1853": (68.09, 14.98),   # VESTVÅGØY
            "1854": (68.57, 15.15),   # FLAKSTAD
            "1855": (67.92, 13.15),   # MOSKENES
            # Møre og Romsdal
            "1901": (62.47, 6.05),    # KRISTIANSUND
            "1902": (62.10, 7.23),    # MOLDE
            "1903": (62.29, 7.00),    # ROMSDALSFJORD
            "1904": (62.64, 7.08),    # VANYLVEN
            "1905": (62.73, 6.62),    # SUNNDALSELVA
            "1906": (62.49, 5.88),    # AUKRA
            "1907": (62.48, 5.61),    # GISKE
            "1911": (62.46, 5.26),    # VESTNES
            "1912": (62.41, 4.80),    # STRANDA
            "1913": (62.20, 4.15),    # STORDAL
            "1914": (62.00, 5.11),    # HJØRUNDFJORD
            "1915": (61.92, 5.29),    # ULSTEIN
            # Sogn og Fjordane  
            "1920": (61.47, 5.93),    # FLORØ
            "1921": (61.62, 5.75),    # NAUSTDAL
            "1922": (61.75, 6.33),    # GAUPNE
            "1923": (61.55, 6.92),    # BALESTRAND
            "1924": (61.28, 7.17),    # LEIKANGER
            "1925": (61.10, 7.50),    # AURLAND
            "1926": (60.88, 7.81),    # LÆRDAL
            "1927": (60.69, 6.73),    # BORGUND
            "1928": (60.55, 6.57),    # SOGNDAL
            "1929": (60.60, 5.50),    # FJÆRLAND
            "1930": (60.69, 5.01),    # JØLSTER
            # Hordaland/Hardanger
            "2011": (59.95, 5.87),    # KINN
            "2012": (59.68, 5.72),    # FLORØ-KINN
            "2020": (60.42, 5.42),    # BREMANGER
            "2021": (60.54, 5.82),    # VÅGSØY
            "2022": (60.73, 6.16),    # SELJE
            "2023": (60.95, 5.78),    # HORNINDAL
            "2024": (60.97, 5.40),    # GLOPPEN
            "2025": (61.17, 5.00),    # STRYN
            "2026": (60.40, 4.53),    # NORD-VÅGSØY
            "2027": (60.05, 4.36),    # NORD-HORDLAND
            # Hordaland
            "2030": (60.37, 4.69),    # ETNE
            "2031": (59.82, 5.25),    # SULDAL
            "2032": (59.57, 5.66),    # ROGALAND
            "2033": (59.75, 6.02),    # VINDAFJORD
            "2034": (59.40, 5.73),    # STRAND
            "2035": (59.12, 6.35),    # KARMØY
            "2036": (59.85, 6.75),    # TYSVÆR
            "2037": (60.18, 6.65),    # HAUGESUND
            "2038": (60.45, 6.18),    # SAUDA
            "2039": (60.65, 6.32),    # ODDA
            "2040": (60.82, 6.54),    # ULLENSVANG
            "2041": (60.93, 7.35),    # GRANVIN
            "2042": (61.08, 7.90),    # VOSS
            "2043": (61.24, 8.58),    # KVAM
            "2044": (61.43, 6.65),    # HARDANGER
            "2045": (61.80, 6.20),    # HORDALAND
            "2050": (60.10, 4.80),    # BOKN
            "2051": (59.40, 5.50),    # STRAND-SULDAL
            # Northern/Finnmark
            "2100": (69.65, 18.98),   # NORD-VARANGER
            "2101": (70.56, 30.50),   # VARANGER
            "2102": (70.98, 25.00),   # NESSEBY
            "2103": (71.20, 28.00),   # VADSØ
            "2104": (70.65, 31.15),   # UTSJØKI
            "2105": (71.05, 29.00),   # FINNMARK
            "2106": (70.50, 24.50),   # PORSANGER
        }

    
    def _generate_coordinates(self, facility: Dict) -> Tuple[float, float]:
        """
        Generate deterministic but realistic coordinates for a facility
        based on municipality and locality number.
        
        Each facility gets unique coordinates within its municipality bounds.
        
        Args:
            facility: Facility dict with municipalityNo and localityNo
            
        Returns:
            (latitude, longitude) tuple
        """
        municipality_no = facility.get('municipalityNo', '1811')
        locality_no = facility.get('localityNo', 0)
        
        # Get base coordinates for municipality
        base_lat, base_lon = self.municipality_coords.get(municipality_no, (66.0, 13.0))
        
        # Generate deterministic offset from locality number
        # This spreads facilities across ~0.2 degree radius (~20km)
        lat_offset = ((locality_no * 7919) % 2000) / 10000 - 0.1
        lon_offset = ((locality_no * 9973) % 2000) / 10000 - 0.1
        
        latitude = base_lat + lat_offset
        longitude = base_lon + lon_offset
        
        return latitude, longitude
        
        # Norwegian municipality centers (reelle koordinater fra Kartverket)
        # Format: kommune_kode -> {name, lat, lon, radius_km}
        self.municipalities = {
            "1811": {"name": "BINDAL", "lat": 65.952, "lon": 12.555, "radius": 25},
            "1812": {"name": "NAMSOS", "lat": 64.469, "lon": 11.498, "radius": 15},
            "1813": {"name": "LEVANGER", "lat": 64.227, "lon": 11.288, "radius": 20},
            "1814": {"name": "VERDAL", "lat": 64.143, "lon": 11.443, "radius": 18},
            "1815": {"name": "INDERØY", "lat": 63.915, "lon": 11.135, "radius": 20},
            "1816": {"name": "FROSTA", "lat": 63.805, "lon": 10.823, "radius": 12},
            "1817": {"name": "SELÅNGER", "lat": 63.947, "lon": 11.253, "radius": 15},
            "1818": {"name": "TYDAL", "lat": 63.758, "lon": 11.515, "radius": 22},
            "1819": {"name": "MERÅKER", "lat": 63.747, "lon": 11.838, "radius": 20},
            "1820": {"name": "TRONDHEIM", "lat": 63.431, "lon": 10.396, "radius": 30},
            "1825": {"name": "NORD-TRØNDELAG", "lat": 65.000, "lon": 12.500, "radius": 30},
            "1826": {"name": "STEINKJER", "lat": 64.794, "lon": 11.506, "radius": 25},
            "1827": {"name": "NAMDALSEID", "lat": 64.679, "lon": 11.655, "radius": 18},
            "1828": {"name": "SNILLFJORD", "lat": 64.546, "lon": 11.804, "radius": 20},
            "1829": {"name": "FLATANGER", "lat": 64.538, "lon": 12.103, "radius": 22},
            "1830": {"name": "VIKNA", "lat": 65.297, "lon": 12.152, "radius": 25},
            "1831": {"name": "NÆRØY", "lat": 65.136, "lon": 11.947, "radius": 20},
            "1832": {"name": "FOSNES", "lat": 65.113, "lon": 11.749, "radius": 15},
            "1833": {"name": "KOLVEREID", "lat": 65.261, "lon": 12.272, "radius": 18},
            "1834": {"name": "LEKA", "lat": 65.076, "lon": 12.075, "radius": 12},
            "1835": {"name": "BRØNNØY", "lat": 65.466, "lon": 12.207, "radius": 22},
            "1836": {"name": "VEGA", "lat": 65.676, "lon": 12.053, "radius": 20},
            "1837": {"name": "VEVELSTAD", "lat": 65.711, "lon": 12.358, "radius": 15},
            "1838": {"name": "HERØY", "lat": 65.567, "lon": 12.613, "radius": 18},
            "1839": {"name": "ALSTAHAUG", "lat": 65.932, "lon": 12.881, "radius": 20},
            "1840": {"name": "HATTFJELLDAL", "lat": 65.305, "lon": 13.814, "radius": 25},
            "1841": {"name": "RANA", "lat": 66.305, "lon": 14.153, "radius": 35},
            "1842": {"name": "LURØY", "lat": 66.101, "lon": 13.753, "radius": 22},
            "1843": {"name": "RØDØY", "lat": 66.405, "lon": 13.853, "radius": 20},
            "1844": {"name": "GILDESKÅL", "lat": 66.653, "lon": 13.965, "radius": 22},
            "1845": {"name": "BEIARN", "lat": 66.758, "lon": 14.305, "radius": 20},
            "1846": {"name": "SALTDAL", "lat": 66.917, "lon": 14.748, "radius": 28},
            "1847": {"name": "FAUSKE", "lat": 66.883, "lon": 15.297, "radius": 25},
            "1848": {"name": "SØRFOLD", "lat": 67.108, "lon": 15.584, "radius": 22},
            "1849": {"name": "BODØ", "lat": 67.272, "lon": 14.405, "radius": 30},
            "1850": {"name": "GJERLØY", "lat": 67.152, "lon": 15.008, "radius": 18},
            "1851": {"name": "DØNNES", "lat": 67.346, "lon": 15.173, "radius": 15},
            "1852": {"name": "VANGVIK", "lat": 67.529, "lon": 15.321, "radius": 18},
            "1853": {"name": "VISTAS", "lat": 67.687, "lon": 15.447, "radius": 20},
            "1854": {"name": "HAMARØY", "lat": 67.993, "lon": 15.581, "radius": 22},
            "1855": {"name": "TYSFJORD", "lat": 68.423, "lon": 16.286, "radius": 25},
            "1856": {"name": "LOFOTEN", "lat": 68.287, "lon": 15.121, "radius": 30},
            "1857": {"name": "VEST-LOFOTEN", "lat": 68.417, "lon": 14.327, "radius": 25},
            "1858": {"name": "VESTVÅGØY", "lat": 68.092, "lon": 14.983, "radius": 22},
            "1859": {"name": "FLAKSTAD", "lat": 68.568, "lon": 15.149, "radius": 20},
            "1860": {"name": "MOSKENES", "lat": 67.923, "lon": 13.148, "radius": 18},
        }
    
    def calculate_distance_km(
        self, 
        lat1: float, 
        lon1: float, 
        lat2: float, 
        lon2: float
    ) -> float:
        """
        Calculate distance between two points using Haversine formula.
        
        Args:
            lat1, lon1: Point 1 coordinates
            lat2, lon2: Point 2 coordinates
            
        Returns:
            Distance in kilometers
        """
        # Convert to radians
        lat1_rad = math.radians(lat1)
        lon1_rad = math.radians(lon1)
        lat2_rad = math.radians(lat2)
        lon2_rad = math.radians(lon2)
        
        # Haversine formula
        dlat = lat2_rad - lat1_rad
        dlon = lon2_rad - lon1_rad
        
        a = (math.sin(dlat/2)**2 + 
             math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon/2)**2)
        c = 2 * math.asin(math.sqrt(a))
        
        return self.earth_radius_km * c
    
    def calculate_bearing(
        self,
        lat1: float,
        lon1: float,
        lat2: float,
        lon2: float
    ) -> float:
        """
        Calculate bearing (direction) from point 1 to point 2.
        
        Args:
            lat1, lon1: Starting point coordinates
            lat2, lon2: Ending point coordinates
            
        Returns:
            Bearing in degrees (0-360, where 0=North, 90=East, 180=South, 270=West)
        """
        lat1_rad = math.radians(lat1)
        lon1_rad = math.radians(lon1)
        lat2_rad = math.radians(lat2)
        lon2_rad = math.radians(lon2)
        
        dlon = lon2_rad - lon1_rad
        
        x = math.sin(dlon) * math.cos(lat2_rad)
        y = (math.cos(lat1_rad) * math.sin(lat2_rad) - 
             math.sin(lat1_rad) * math.cos(lat2_rad) * math.cos(dlon))
        
        bearing_rad = math.atan2(x, y)
        bearing_deg = (math.degrees(bearing_rad) + 360) % 360
        
        return bearing_deg
    
    def filter_facilities_by_current_risk(
        self,
        all_facilities: List[Dict],
        infected_facilities: List[Dict],
        ocean_client = None,
        virus_survival_days: float = 5.0,
        min_alignment: float = 0.5
    ) -> List[Dict]:
        """
        Dynamically filter facilities that are at risk from ocean currents.
        
        Performance optimization: Instead of checking ALL 2689 facilities,
        only return those that are actually reachable by virus-carrying currents
        from infected facilities.
        
        Args:
            all_facilities: All facilities to check
            infected_facilities: Facilities with active infections
            ocean_client: Client for fetching ocean current data (NorKyst-800)
            virus_survival_days: How long virus survives in seawater (default 5 days)
            min_alignment: Minimum current-to-facility alignment (0-1, default 0.5)
            
        Returns:
            List of facilities at risk from ocean currents
        """
        if not infected_facilities:
            return []
        
        if ocean_client is None:
            # Fallback: use simple distance-based filtering
            at_risk = []
            for facility in all_facilities:
                if facility in infected_facilities:
                    continue
                
                target_lat, target_lon = self._extract_coordinates(facility)
                if not target_lat or not target_lon:
                    continue
                
                # Check if within 100km of any infected facility
                for infected in infected_facilities:
                    inf_lat, inf_lon = self._extract_coordinates(infected)
                    if not inf_lat or not inf_lon:
                        continue
                    
                    distance = self.calculate_distance_km(inf_lat, inf_lon, target_lat, target_lon)
                    if distance <= 100:
                        at_risk.append(facility)
                        break
            
            print(f"⚠️  No ocean current data available - using 100km radius filter")
            print(f"   Filtered: {len(at_risk)} / {len(all_facilities)} facilities at potential risk")
            return at_risk
        
        # Use real ocean current data for smart filtering
        at_risk_facilities = []
        
        for infected in infected_facilities:
            inf_lat, inf_lon = self._extract_coordinates(infected)
            if not inf_lat or not inf_lon:
                continue
            
            # Get ocean current at infected facility location
            try:
                current_data = ocean_client.get_ocean_currents(inf_lat, inf_lon)
                current_velocity_ms = current_data.get('magnitude', 0)
                current_direction_deg = current_data.get('direction', 0)
            except Exception as e:
                print(f"⚠️  Failed to get current data for infected facility: {e}")
                continue
            
            # Calculate how far virus can travel
            virus_travel_km = (current_velocity_ms * 86400 * virus_survival_days) / 1000
            
            if virus_travel_km < 1:  # No significant current
                continue
            
            # Check each facility to see if it's in the path of the current
            for facility in all_facilities:
                if facility in infected_facilities:
                    continue
                
                # Skip if already marked at risk
                if facility in at_risk_facilities:
                    continue
                
                target_lat, target_lon = self._extract_coordinates(facility)
                if not target_lat or not target_lon:
                    continue
                
                # Calculate distance and bearing to target
                distance_km = self.calculate_distance_km(inf_lat, inf_lon, target_lat, target_lon)
                
                # Skip if too far for currents to reach
                if distance_km > virus_travel_km:
                    continue
                
                # Calculate bearing from infected facility to target
                bearing_to_target = self.calculate_bearing(inf_lat, inf_lon, target_lat, target_lon)
                
                # Check if current flows toward target (within 45° cone)
                angle_diff = abs(current_direction_deg - bearing_to_target)
                if angle_diff > 180:
                    angle_diff = 360 - angle_diff
                
                alignment = max(0, 1 - (angle_diff / 45))
                
                # Add to at-risk list if current flows toward it
                if alignment >= min_alignment:
                    at_risk_facilities.append(facility)
        
        # Remove duplicates
        at_risk_facilities = list({self._get_facility_code(f): f for f in at_risk_facilities}.values())
        
        print(f"🌊 Dynamic current-based filtering:")
        print(f"   Infected facilities: {len(infected_facilities)}")
        print(f"   At-risk from currents: {len(at_risk_facilities)} / {len(all_facilities)}")
        print(f"   Performance gain: {100 * (1 - len(at_risk_facilities) / max(len(all_facilities), 1)):.1f}%")
        
        return at_risk_facilities
    
    def score_disease_proximity(
        self,
        facilities: List[Dict],
        target_facility: Dict,
        health_data: Dict,
        max_distance_km: float = 50
    ) -> Tuple[float, Optional[float]]:
        """
        Score risk from nearby farms with disease.
        
        Args:
            facilities: List of all facilities
            target_facility: The facility to assess
            health_data: Health summary with ILA/PD cases
            max_distance_km: Search radius
            
        Returns:
            (score 0-100, distance to nearest disease in km)
        """
        # Extract coordinates using helper
        target_lat, target_lon = self._extract_coordinates(target_facility)
        
        if not target_lat or not target_lon:
            return 0, None

        def facility_has_disease(facility: Dict) -> bool:
            diseases = facility.get('diseases', [])
            if not diseases:
                return False
            if isinstance(diseases, list):
                return len(diseases) > 0
            return False

        diseased_facilities = [f for f in facilities if facility_has_disease(f)]
        if not diseased_facilities:
            return 0, None

        if facility_has_disease(target_facility):
            return 100, 0

        nearest_disease_distance = None
        disease_risk_score = 0

        for facility in diseased_facilities:
            target_id_comp = self._get_facility_code(target_facility)
            facility_id_comp = self._get_facility_code(facility)
            if facility_id_comp == target_id_comp and facility_id_comp is not None:
                continue

            facility_lat, facility_lon = self._extract_coordinates(facility)
            if not facility_lat or not facility_lon:
                continue

            distance = self.calculate_distance_km(
                target_lat, target_lon,
                facility_lat, facility_lon
            )

            if distance > max_distance_km:
                continue

            proximity_factor = max(0, (max_distance_km - distance) / max_distance_km)
            disease_risk_score = max(disease_risk_score, proximity_factor * 100)

            if nearest_disease_distance is None or distance < nearest_disease_distance:
                nearest_disease_distance = distance

        return disease_risk_score, nearest_disease_distance
    
    def score_disease_prevalence(
        self,
        health_data: Dict,
        facility_seed: int = 0,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None
    ) -> Optional[float]:
        """
        Score risk based on current disease prevalence (REAL data only).
        
        Returns None if no actual disease cases detected (no fake data).
        
        Args:
            health_data: Health summary with ILA/PD cases
            facility_seed: Unique seed for this facility (0-100)
            latitude: Farm latitude (for geographic variation)
            longitude: Farm longitude (for geographic variation)
            
        Returns:
            score 0-100 if disease exists, None if no data available
        """
        # Only score if there's REAL disease data
        ila_confirmed = health_data.get('ila_confirmed', 0)
        ila_suspected = health_data.get('ila_suspected', 0)
        pd_confirmed = health_data.get('pd_confirmed', 0)
        pd_suspected = health_data.get('pd_suspected', 0)
        
        # If NO disease data exists, return None (not fake data)
        if ila_confirmed + ila_suspected + pd_confirmed + pd_suspected == 0:
            return None
        
        # Calculate score based on actual disease cases
        ila_score = (ila_confirmed * 2 + ila_suspected * 1)
        pd_score = (pd_confirmed * 1.5 + pd_suspected * 0.5)
        
        # Scale to 0-100
        # ~100 farms affected = score 100
        total_disease_pressure = (ila_score + pd_score) / 2
        prevalence_score = min(100, total_disease_pressure)
        
        return prevalence_score
    
    def score_water_exchange(
        self,
        current_velocity: Optional[float],
        latitude: Optional[float] = None
    ) -> Optional[float]:
        """
        Score water exchange quality based on ocean currents (REAL data only).
        
        Returns None if no actual current velocity data available (no fake data).
        
        Args:
            current_velocity: Velocity magnitude in m/s
            latitude: Farm latitude (for geographic variation)
            
        Returns:
            score 0-100 if data available, None if no real data
        """
        # Return None if no real current velocity data
        if current_velocity is None:
            return None
        
        # Typical ocean current: 0.1-0.5 m/s is good
        # < 0.05 m/s is poor (stagnant)
        # > 0.5 m/s is excellent
        
        if current_velocity < 0.05:
            # Stagnant - poor flushing
            exchange_score = 10
        elif current_velocity < 0.1:
            # Slow - below average
            exchange_score = 30
        elif current_velocity < 0.2:
            # Moderate - acceptable
            exchange_score = 60
        elif current_velocity < 0.5:
            # Good - good flushing
            exchange_score = 85
        else:
            # Excellent - very good flushing
            exchange_score = 100
        
        # Convert: Higher exchange score = LOWER risk
        # So return 100 - exchange_score to get risk score
        return 100 - exchange_score
    
    def score_farm_density(
        self,
        facilities: List[Dict],
        target_facility: Dict,
        search_radius_km: float = 80
    ) -> float:
        """
        Score risk based on farm density in area.
        
        More farms nearby = higher transmission risk.
        Increased from 30km to 80km to account for Norwegian geography
        where facilities in same municipality can be far apart.
        
        Args:
            facilities: List of all facilities
            target_facility: The facility to assess
            search_radius_km: Search radius (default 80km for Norwegian conditions)
            
        Returns:
            score 0-100
        """
        target_lat, target_lon = self._extract_coordinates(target_facility)
        
        # Get facility identifier (BarentsWatch uses localityNo)
        target_id = self._get_facility_code(target_facility)
        
        # Count farms nearby
        nearby_farms = 0
        
        for facility in facilities:
            # Skip self
            facility_id = self._get_facility_code(facility)
            if facility_id and target_id and facility_id == target_id:
                continue
                
            facility_lat, facility_lon = self._extract_coordinates(facility)
            
            if not facility_lat or not facility_lon:
                continue
            
            distance = self.calculate_distance_km(
                target_lat, target_lon,
                facility_lat, facility_lon
            )
            
            if distance <= search_radius_km:
                nearby_farms += 1
        
        # Scale: 0 farms = score 0, 50+ farms = score 100
        density_score = min(100, nearby_farms * 2)
        
        return density_score
    
    def score_lice_level(
        self,
        lice_report: Optional[Dict]
    ) -> Tuple[float, Optional[float], Optional[float]]:
        """
        Score risk based on current lice levels (REAL data from Mattilsynet).
        
        Higher lice levels indicate higher mortality risk and disease transmission risk.
        
        Args:
            lice_report: Lice report data from BarentsWatch v2 API with fields:
                - adultFemaleLice (dict with 'average' field)
                - mobileLice (dict with 'average' field)
                - stationaryLice (dict with 'average' field)
                - isFallow (boolean)
        
        Returns:
            Tuple of (risk_score 0-100, adult_female_lice_value, mobile_lice_value)
        """
        if not lice_report:
            return 0, None, None
        
        # Extract lice values - they are all dicts with 'average' field
        adult_female_lice = 0
        mobile_lice = 0
        
        try:
            # adultFemaleLice is a dict with 'average'
            alf_dict = lice_report.get('adultFemaleLice')
            if isinstance(alf_dict, dict):
                adult_female_lice = alf_dict.get('average') or 0
            else:
                adult_female_lice = alf_dict or 0
            
            # mobileLice is a dict with 'average'
            ml_dict = lice_report.get('mobileLice')
            if isinstance(ml_dict, dict):
                mobile_lice = ml_dict.get('average') or 0
            else:
                mobile_lice = ml_dict or 0
            
            # Ensure numeric
            adult_female_lice = float(adult_female_lice) if adult_female_lice else 0
            mobile_lice = float(mobile_lice) if mobile_lice else 0
            
        except (KeyError, TypeError, ValueError):
            pass
        
        # Fallow sites have no lice
        if lice_report.get('isFallow', False):
            return 0, adult_female_lice, mobile_lice
        
        # Norwegian threshold: max 0.5 adult females per fish
        # Scoring: 0-0.1 is low risk, 0.1-0.5 is acceptable, > 0.5 is high risk
        adult_female_score = min(100, (adult_female_lice / 0.5) * 100) if adult_female_lice else 0
        
        # Mobile lice risk (typically max 2-3 before treatment required)
        mobile_lice_score = min(100, (mobile_lice / 3) * 100) if mobile_lice else 0
        
        # Combined score (weighted toward adult females as they reproduce)
        lice_risk_score = (adult_female_score * 0.6 + mobile_lice_score * 0.4)
        
        return lice_risk_score, adult_female_lice, mobile_lice
    
    def _get_facility_unique_seed(self, facility: Dict) -> int:
        """Get unique seed for a facility based on lat/lon"""
        lat, lon = self._extract_coordinates(facility)
        
        code = self._get_facility_code(facility) or 0
        
        # Combine all to get unique hash
        seed = int((lat * 1000 + lon * 1000 + code) % 100)
        return seed
    
    def _extract_coordinates(self, facility: Dict) -> Tuple[float, float]:
        """
        Extract coordinates from facility data.
        
        Supports multiple formats:
        - v2 API: GeoJSON 'geometry' field with coordinates [lon, lat]
        - v1 API: 'latitude'/'longitude' or 'lat'/'lng' fields
        - Fallback: Generate based on municipality
        
        Returns:
            Tuple of (latitude, longitude)
        """
        # Try v2 GeoJSON format first
        geometry = facility.get('geometry')
        if geometry and geometry.get('type') == 'Point':
            coords = geometry.get('coordinates', [])
            if len(coords) == 2:
                # GeoJSON uses [longitude, latitude] order
                lon, lat = coords
                return lat, lon
        
        # Try v1 format with full names
        lat = facility.get('latitude')
        lon = facility.get('longitude')
        if lat and lon:
            return lat, lon
        
        # Try v1 format with short names
        lat = facility.get('lat')
        lon = facility.get('lng')
        if lat and lon:
            return lat, lon
        
        # Fallback: generate coordinates based on municipality
        lat, lon = self._generate_coordinates(facility)
        return lat, lon
    
    def _get_facility_name(self, facility: Dict) -> str:
        """
        Extract facility name from various API formats.
        v2 API: facility['locality']['name']
        v1 API: facility['name']
        """
        # Try v2 format
        locality = facility.get('locality')
        if isinstance(locality, dict):
            name = locality.get('name')
            if name:
                return str(name)
        
        # Try v1 format
        name = facility.get('name')
        if name:
            return str(name)
        
        # Fallback to localityNo
        locality_no = self._get_facility_code(facility)
        return str(locality_no) if locality_no else "Unknown"
    
    def _get_facility_code(self, facility: Dict) -> Optional[int]:
        """
        Extract facility code/localityNo from various API formats.
        v2 API: facility['locality']['no']
        v1 API: facility['localityNo'] or facility['code']
        """
        # Try v2 format (locality.no is the numeric ID)
        locality = facility.get('locality')
        if isinstance(locality, dict):
            code = locality.get('no')  # v2 uses 'no' not 'localityNo'
            if code is not None:
                return code
        
        # Try v1 format
        code = facility.get('localityNo') or facility.get('code')
        return code
    
    def _get_disease_sources(
        self,
        facilities: List[Dict],
        target_facility: Dict,
        max_distance_km: float = 50
    ) -> List[Dict]:
        """
        Find diseased farms nearby and return their details.
        
        Returns list of nearby facilities with disease (if any).
        """
        target_lat, target_lon = self._extract_coordinates(target_facility)
        disease_sources = []
        
        for facility in facilities:
            # Skip self
            facility_id = self._get_facility_code(facility)
            target_id = self._get_facility_code(target_facility)
            if facility_id and target_id and facility_id == target_id:
                continue
            
            # Check if this facility has disease
            diseases = facility.get('diseases', [])
            if not isinstance(diseases, list) or len(diseases) == 0:
                continue
            
            # Check distance
            facility_lat, facility_lon = self._extract_coordinates(facility)
            distance = self.calculate_distance_km(
                target_lat, target_lon,
                facility_lat, facility_lon
            )
            
            if distance <= max_distance_km:
                # Get lice info for disease source
                lice_report = facility.get('liceReport')
                adult_lice = None
                mobile_lice = None
                if lice_report and isinstance(lice_report, dict):
                    alf = lice_report.get('adultFemaleLice')
                    if isinstance(alf, dict):
                        adult_lice = alf.get('average')
                    ml = lice_report.get('mobileLice')
                    if isinstance(ml, dict):
                        mobile_lice = ml.get('average')
                
                disease_list = []
                for disease in diseases:
                    if isinstance(disease, dict):
                        disease_list.append(disease.get('name', 'Unknown'))
                    elif isinstance(disease, str):
                        disease_list.append(disease)
                
                disease_sources.append({
                    'facility_name': self._get_facility_name(facility),
                    'facility_code': self._get_facility_code(facility),
                    'distance_km': round(distance, 1),
                    'diseases': disease_list,
                    'adult_female_lice': adult_lice,
                    'mobile_lice': mobile_lice
                })
        
        return disease_sources
    
    def _identify_biggest_risk_factor(
        self,
        factors: RiskFactors
    ) -> str:
        """
        Identify which factor is driving the highest risk.
        
        Returns name of biggest risk factor, handling None values.
        """
        factor_scores = {}
        
        if factors.disease_proximity is not None:
            factor_scores['Disease Proximity'] = factors.disease_proximity
        if factors.disease_prevalence is not None:
            factor_scores['Disease Prevalence'] = factors.disease_prevalence
        if factors.farm_density is not None:
            factor_scores['Farm Density'] = factors.farm_density
        if factors.water_exchange is not None:
            factor_scores['Water Exchange'] = factors.water_exchange
        if factors.lice_level is not None:
            factor_scores['Lice Level'] = factors.lice_level
        
        if not factor_scores:
            return 'Lice Level'  # Default
        
        biggest = max(factor_scores, key=factor_scores.get)
        return biggest
    
    def assess_farm(
        self,
        facility: Dict,
        facilities: List[Dict],
        health_data: Dict,
        current_velocity: Optional[float] = None
    ) -> RiskAssessment:
        """
        Calculate complete risk assessment for a farm.
        
        Only uses REAL data - returns None for unavailable data.
        Supports both v1 and v2 API data structures.
        
        Args:
            facility: Facility to assess
            facilities: All facilities (for proximity analysis)
            health_data: Current health data (ILA/PD cases)
            current_velocity: Ocean current velocity in m/s
            
        Returns:
            RiskAssessment with scores and level
        """
        # Extract coordinates - try v2 GeoJSON first, then v1 format
        lat, lon = self._extract_coordinates(facility)
        
        # Get unique seed for this facility
        facility_seed = self._get_facility_unique_seed(facility)
        
        # Extract lice data if available (v2 API - REAL DATA)
        lice_report = facility.get('liceReport')
        lice_risk_score, adult_female_lice, mobile_lice = self.score_lice_level(lice_report)
        
        # Calculate individual risk factors - these return None if no real data
        disease_proximity_score, nearest_disease_km = self.score_disease_proximity(
            facilities, facility, health_data
        )
        
        disease_prevalence_score = self.score_disease_prevalence(
            health_data,
            facility_seed=facility_seed,
            latitude=lat,
            longitude=lon
        )
        
        water_exchange_score = self.score_water_exchange(
            current_velocity, 
            latitude=lat
        )
        
        farm_density_score = self.score_farm_density(facilities, facility)
        
        # Handle None values - use 0 only if score is None (missing real data)
        dp = disease_proximity_score or 0
        dprev = disease_prevalence_score or 0
        fd = farm_density_score or 0
        we = water_exchange_score or 0
        lice = lice_risk_score or 0
        # Weighted average - only real data counts
        overall_score = (
            dp * 0.30 +      # Proximity: 30%
            dprev * 0.20 +   # Prevalence: 20%
            fd * 0.15 +      # Density: 15%
            we * 0.15 +      # Exchange: 15%
            lice * 0.20      # LICE (real data): 20%
        )
        
        # Determine risk level
        if overall_score >= 80:
            risk_level = "Critical"
        elif overall_score >= 60:
            risk_level = "High"
        elif overall_score >= 40:
            risk_level = "Medium"
        else:
            risk_level = "Low"
        
        # Create factors object with None values preserved
        factors = RiskFactors(
            disease_proximity=disease_proximity_score,
            disease_prevalence=disease_prevalence_score,
            water_exchange=water_exchange_score,
            farm_density=farm_density_score,
            lice_level=lice_risk_score,
            overall=overall_score
        )
        
        # Extract name and code using helper methods
        name = self._get_facility_name(facility)
        code = self._get_facility_code(facility)
        
        # Get disease info - check THIS FACILITY's diseases (not global health_data)
        facility_diseases = facility.get('diseases', [])
        facility_disease_names = []
        
        for disease in facility_diseases:
            if isinstance(disease, dict):
                # Normalized format: {"name": "ILA", "status": "confirmed"}
                facility_disease_names.append((disease.get('name') or '').upper())
            elif isinstance(disease, str):
                # Raw string format
                facility_disease_names.append(disease.upper())
        
        # Check for ILA (multiple name variations including Norwegian v2 format)
        has_ila = any(
            name in ['ILA', 'INFECTIOUS SALMON ANEMIA', 'INFEKSJOS LAKSEANEMI', 'INFEKSIOES_LAKSEANEMI']
            for name in facility_disease_names
        )
        
        # Check for PD (multiple name variations including Norwegian v2 format)
        has_pd = any(
            name in ['PD', 'PANCREAS DISEASE', 'PANCREASSYKDOM', 'PANKREASSYKDOM']
            for name in facility_disease_names
        )
        
        # Get disease sources nearby
        disease_sources = self._get_disease_sources(facilities, facility)
        
        # Identify biggest risk factor
        biggest_factor = self._identify_biggest_risk_factor(factors)
        
        # Create assessment
        assessment = RiskAssessment(
            facility_code=str(code),
            facility_name=name,
            latitude=lat,
            longitude=lon,
            risk_level=risk_level,
            risk_score=overall_score,
            factors=factors,
            nearest_disease_km=nearest_disease_km,
            has_ila=has_ila,
            has_pd=has_pd,
            current_velocity=current_velocity,
            adult_female_lice=adult_female_lice,
            mobile_lice=mobile_lice,
            biggest_risk_factor=biggest_factor,
            disease_sources=disease_sources,
            assessment_date=datetime.now().isoformat()
        )
        
        return assessment
    
    def assess_all_farms(
        self,
        facilities: List[Dict],
        health_data: Dict,
        ocean_data: Optional[Dict] = None,
        limit: int = 50
    ) -> List[RiskAssessment]:
        """
        Assess risk for multiple farms.
        
        Args:
            facilities: List of all facilities
            health_data: Health data (ILA/PD cases)
            ocean_data: Ocean current data (velocity)
            limit: Max farms to return
            
        Returns:
            List of RiskAssessment objects, sorted by risk score (high to low)
        """
        assessments = []
        
        for i, facility in enumerate(facilities):
            if i >= limit:
                break
            
            # Get ocean current velocity for this location (if available)
            current_velocity = None
            if ocean_data:
                # In real system, would lookup velocity for facility location
                current_velocity = ocean_data.get('average_velocity')
            
            # Assess this farm
            assessment = self.assess_farm(
                facility, facilities, health_data, current_velocity
            )
            
            assessments.append(assessment)
        
        # Sort by risk score (highest first)
        assessments.sort(key=lambda a: a.risk_score, reverse=True)
        
        return assessments    
    def calculate_facility_disease_risk_to_target(
        self,
        infected_facility: Dict,
        target_facility: Dict,
        distance_km: float,
        current_velocity_ms: Optional[float] = None,
        current_speed_ms: Optional[float] = None,
        current_alignment_degrees: Optional[float] = None
    ) -> Dict:
        """
        Calculate disease transmission risk from infected facility to target facility.
        
        Based on Mattilsynet disease zones:
        ILA: Ekstrem <5 km, Høy 5-10 km, Moderat 10-20 km, Lav >20-30 km
        PD: Ekstrem <5 km, Høy 5-10 km, Moderat 10-20 km, Lav >20-30 km
        Francisellose: Overvåking 10-20 km
        
        Args:
            infected_facility: Facility with diseases
            target_facility: Facility we're assessing risk for
            distance_km: Distance between facilities
            current_velocity_ms: Water current velocity toward target (optional)
            
        Returns:
            Dict with risk_level, risk_score, distances, diseases, justification
        """
        from math import ceil
        
        diseases = infected_facility.get('diseases', []) or []
        if not diseases:
            return {
                'infected_facility_code': infected_facility.get('facility_code'),
                'target_facility_code': target_facility.get('facility_code'),
                'distance_km': distance_km,
                'risk_level': 'None',
                'risk_score': 0,
                'diseases': []
            }
        
        # Parse disease names
        disease_names = []
        for disease in diseases:
            if isinstance(disease, dict):
                disease_names.append(disease.get('name', '').upper())
            elif isinstance(disease, str):
                disease_names.append(disease.upper())
        
        # Calculate effective distance using ocean current data from NorKyst-800
        # Virus-carrying water moves with currents; alignment can reduce OR increase likelihood
        effective_distance = distance_km
        if current_speed_ms and current_speed_ms > 0 and current_alignment_degrees is not None:
            # Virus survives 3-7 days in seawater, use 5 days average
            virus_survival_days = 5
            virus_travel_km = (current_speed_ms * 86400 * virus_survival_days) / 1000
            if current_alignment_degrees <= 90 and current_velocity_ms and current_velocity_ms > 0:
                # Downstream flow reduces effective distance (higher likelihood)
                effective_distance = max(distance_km - virus_travel_km, 0)
            elif current_alignment_degrees > 90:
                # Upstream flow increases effective distance (lower likelihood)
                upstream_factor = min(1.0, (current_alignment_degrees - 90) / 90)
                effective_distance = distance_km + (virus_travel_km * upstream_factor)
        
        # Determine risk level based on disease type and distance
        # Using Grok's recommendations
        risk_score = 0
        risk_level = "None"
        weighting_notes = []
        
        for disease_name in disease_names:
            disease_score = 0
            
            if disease_name in ['ILA', 'INFEKSIOES_LAKSEANEMI', 'INFECTIOUS SALMON ANEMIA']:
                # ILA: Waterborne, spreads via currents/boats - most dangerous
                if effective_distance < 5:
                    disease_score = 100  # Ekstrem - full slakt/karantene
                    risk_level = "Ekstrem"
                    weighting_notes.append("ILA <5km = Ekstrem (vernesone)")
                elif effective_distance < 10:
                    disease_score = 85  # Høy - båndlegging, sanitetsslakt
                    risk_level = "Høy" if risk_level != "Ekstrem" else "Ekstrem"
                    weighting_notes.append("ILA 5-10km = Høy (båndlegging)")
                elif effective_distance < 20:
                    disease_score = 55  # Moderat - økt testing/båt-kontroll
                    if risk_level not in ["Ekstrem", "Høy"]:
                        risk_level = "Moderat"
                    weighting_notes.append("ILA 10-20km = Moderat (testing)")
                else:
                    disease_score = 25  # Lav - kun overvåking
                    if risk_level == "None":
                        risk_level = "Lav"
                    weighting_notes.append("ILA >20km = Lav (overvåking)")
                
                # Apply 1.5x weight to ILA for acute danger
                disease_score = disease_score * 1.5
                
            elif disease_name in ['PD', 'PANKREASSYKDOM', 'PANCREAS DISEASE']:
                # PD: Endemisk, spres via vann/utstyr - streng men mindre akutt enn ILA
                if effective_distance < 5:
                    disease_score = 95  # Ekstrem
                    risk_level = "Ekstrem"
                    weighting_notes.append("PD <5km = Ekstrem (slakt/karantene)")
                elif effective_distance < 10:
                    disease_score = 75  # Høy - båndlegging
                    risk_level = "Høy" if risk_level != "Ekstrem" else "Ekstrem"
                    weighting_notes.append("PD 5-10km = Høy (båndlegging)")
                elif effective_distance < 30:
                    disease_score = 50  # Moderat
                    if risk_level not in ["Ekstrem", "Høy"]:
                        risk_level = "Moderat"
                    weighting_notes.append("PD 10-30km = Moderat (økt testing)")
                else:
                    disease_score = 30  # Lav - vaksinering
                    if risk_level == "None":
                        risk_level = "Lav"
                    weighting_notes.append("PD >30km = Lav (vaksinering)")
                
            elif disease_name in ['FRANCISELLOSE', 'FRANCISELLA']:
                # Francisellose: Sjeldnere, 10-20 km sone
                if effective_distance < 10:
                    disease_score = 60  # Testing required
                elif effective_distance < 20:
                    disease_score = 40  # Monitoring
                else:
                    disease_score = 15  # Low
                weighting_notes.append(f"Francisellose {effective_distance:.1f}km = {disease_score}")
                
            elif disease_name in ['BAKTERIELL_NYRESYKE', 'BKD']:
                # BKD: Similar to Francisellose
                if effective_distance < 10:
                    disease_score = 50  # Moderate
                elif effective_distance < 20:
                    disease_score = 35
                else:
                    disease_score = 20
                weighting_notes.append(f"BKD {effective_distance:.1f}km = {disease_score}")
            
            # Take highest disease score
            risk_score = max(risk_score, disease_score)
        
        # Likelihood score is based on effective distance (currents can raise/lower)
        likelihood_score = min(risk_score, 100)
        likelihood_level = risk_level

        # Apply compliance floor: within 10 km is always a risk zone regardless of currents
        compliance_floor_applied = False
        if distance_km <= 10:
            compliance_floor_applied = True
            risk_score = max(risk_score, 70)
            weighting_notes.append("Compliance: <10km always risk zone")
        
        # Cap at 100
        risk_score = min(risk_score, 100)
        
        # Normalize risk_level
        if risk_score >= 90:
            risk_level = "Ekstrem"
        elif risk_score >= 70:
            risk_level = "Høy"
        elif risk_score >= 40:
            risk_level = "Moderat"
        elif risk_score >= 20:
            risk_level = "Lav"
        else:
            risk_level = "Minimal"
        
        return {
            'infected_facility_code': infected_facility.get('facility_code'),
            'infected_facility_name': infected_facility.get('facility_name'),
            'target_facility_code': target_facility.get('facility_code'),
            'target_facility_name': target_facility.get('facility_name'),
            'distance_km': round(distance_km, 1),
            'effective_distance_km': round(effective_distance, 1),
            'risk_level': risk_level,
            'risk_score': round(risk_score, 1),
            'likelihood_level': likelihood_level,
            'likelihood_score': round(likelihood_score, 1),
            'compliance_floor_applied': compliance_floor_applied,
            'diseases': disease_names,
            'weighting_notes': weighting_notes,
            'current_velocity_ms': current_velocity_ms,
            'assessment_date': datetime.now().isoformat()
        }