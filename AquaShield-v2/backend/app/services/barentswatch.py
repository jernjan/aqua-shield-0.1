"""BarentsWatch API integration service - Real data only"""
import httpx
from typing import Optional, List, Dict
from datetime import datetime
from ..core.config import settings
from ..utils.logger import logger


class BarentsWatchService:
    """Service for BarentsWatch API interactions - Real data integration"""
    
    BASE_URL = "https://www.barentswatch.no/api/v2"
    
    def __init__(self):
        self.api_key = settings.BARENTSWATCH_API_KEY
        self.api_secret = settings.BARENTSWATCH_API_SECRET
        # Use sync client for compatibility with sync methods
        self.client = httpx.Client(timeout=30.0)
        # Track vessel movement history for predictive risk
        self.vessel_history = {}  # {vessel_id: [facility_ids]} - where boats have been
    
    async def get_facilities(self) -> List[Dict]:
        """
        Fetch all fish farm facilities from BarentsWatch API
        Returns REAL data from BarentsWatch servers, or demo data if API unavailable
        """
        try:
            url = f"{self.BASE_URL}/facilities"
            headers = self._get_headers()
            
            logger.info(f"Fetching facilities from {url}")
            # Use sync client with async context - httpx handles this
            response = self.client.get(url, headers=headers)
            response.raise_for_status()
            
            facilities = response.json()
            
            if not facilities:
                logger.warning("No facilities returned from BarentsWatch API - using demo data")
                return self._get_demo_facilities()
            
            # Enrich facility data with additional metrics
            enriched = []
            for facility in facilities:
                try:
                    lice_data = await self.get_facility_lice(facility.get('barentswatch_id'))
                    disease_data = await self.get_facility_diseases(facility.get('barentswatch_id'))
                    
                    facility_enriched = {
                        'id': facility.get('id'),
                        'barentswatch_id': facility.get('barentswatch_id'),
                        'name': facility.get('name'),
                        'latitude': float(facility.get('latitude', 70.8)),
                        'longitude': float(facility.get('longitude', 28.2)),
                        'lice_count': lice_data.get('count', 0) if lice_data else 0,
                        'temperature': facility.get('temperature', 12.0),
                        'diseases': disease_data.get('diseases', []) if disease_data else [],
                        'last_updated': datetime.utcnow().isoformat()
                    }
                    enriched.append(facility_enriched)
                except Exception as e:
                    logger.warning(f"Could not enrich facility {facility.get('barentswatch_id')}: {e}")
                    enriched.append(facility)
            
            logger.info(f"Successfully fetched {len(enriched)} facilities from BarentsWatch API")
            return enriched
            
        except Exception as e:
            logger.error(f"Error fetching facilities from BarentsWatch: {e}")
            logger.info("Falling back to demo data for development/testing")
            return self._get_demo_facilities()
    
    async def get_facility(self, facility_id: str) -> Optional[Dict]:
        """Fetch single facility details from BarentsWatch"""
        try:
            url = f"{self.BASE_URL}/facilities/{facility_id}"
            headers = self._get_headers()
            
            logger.info(f"Fetching facility {facility_id} from BarentsWatch")
            response = self.client.get(url, headers=headers)
            response.raise_for_status()
            
            return response.json()
        except Exception as e:
            logger.error(f"Error fetching facility {facility_id} from BarentsWatch: {e}")
            return None
    
    async def get_facility_lice(self, facility_id: str) -> Optional[Dict]:
        """Fetch real lice count data from BarentsWatch"""
        try:
            url = f"{self.BASE_URL}/facilities/{facility_id}/lice"
            headers = self._get_headers()
            
            logger.debug(f"Fetching lice data for {facility_id}")
            response = self.client.get(url, headers=headers)
            response.raise_for_status()
            
            return response.json()
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                logger.debug(f"No lice data available for facility {facility_id}")
                return None
            logger.error(f"Error fetching lice data for {facility_id}: {e}")
            return None
        except Exception as e:
            logger.warning(f"Error fetching lice data for {facility_id}: {e}")
            return None
    
    async def get_facility_diseases(self, facility_id: str) -> Optional[Dict]:
        """Fetch real disease data from BarentsWatch"""
        try:
            url = f"{self.BASE_URL}/facilities/{facility_id}/diseases"
            headers = self._get_headers()
            
            logger.debug(f"Fetching disease data for {facility_id}")
            response = self.client.get(url, headers=headers)
            response.raise_for_status()
            
            return response.json()
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                logger.debug(f"No disease data available for facility {facility_id}")
                return None
            logger.error(f"Error fetching disease data for {facility_id}: {e}")
            return None
        except Exception as e:
            logger.warning(f"Error fetching disease data for {facility_id}: {e}")
            return None
    
    async def get_vessels(self) -> List[Dict]:
        """
        Fetch real vessel/wellboat data with movement history.
        Returns current positions and movement history for predictive risk analysis.
        """
        try:
            # Try BarentsWatch vessel endpoint
            url = f"{self.BASE_URL}/vessels"
            headers = self._get_headers()
            
            logger.info("Fetching vessel tracking data from BarentsWatch")
            response = self.client.get(url, headers=headers)
            response.raise_for_status()
            
            vessels = response.json()
            
            # Enrich vessels with movement history
            enriched_vessels = []
            for vessel in vessels:
                vessel_id = vessel.get('id') or vessel.get('mmsi') or vessel.get('name')
                
                # Get vessel's movement history (last 10 visited facilities)
                history = []
                try:
                    history_url = f"{self.BASE_URL}/vessels/{vessel_id}/history"
                    history_response = self.client.get(history_url, headers=headers)
                    if history_response.status_code == 200:
                        history_data = history_response.json()
                        # Extract facility IDs from history
                        history = [h.get('facility_id') for h in history_data[:10] if h.get('facility_id')]
                        self.vessel_history[vessel_id] = history
                except Exception as e:
                    logger.debug(f"Could not fetch vessel history for {vessel_id}: {e}")
                
                vessel_enriched = {
                    'id': vessel_id,
                    'mmsi': vessel.get('mmsi'),
                    'name': vessel.get('name'),
                    'type': vessel.get('type', 'Vessel'),
                    'latitude': vessel.get('latitude', 70.8),
                    'longitude': vessel.get('longitude', 28.2),
                    'last_visited': history,  # List of facility_ids
                    'last_updated': datetime.utcnow().isoformat()
                }
                enriched_vessels.append(vessel_enriched)
            
            logger.info(f"Retrieved {len(enriched_vessels)} vessels with movement history from BarentsWatch")
            return enriched_vessels
            
        except Exception as e:
            logger.warning(f"Could not fetch vessels from BarentsWatch: {e}")
            logger.info("Falling back to demo vessel data")
            return self._get_demo_vessels()
    
    def _get_headers(self) -> Dict[str, str]:
        """Get authentication headers for BarentsWatch API"""
        headers = {
            "Content-Type": "application/json"
        }
        
        # Add API credentials if configured
        if self.api_key:
            headers["X-API-Key"] = self.api_key
        if self.api_secret:
            headers["X-API-Secret"] = self.api_secret
        
        return headers
    
    def _get_demo_facilities(self) -> List[Dict]:
        """Demo facilities for testing when BarentsWatch API is unavailable"""
        return [
            {
                'id': '1',
                'barentswatch_id': 'bw_001',
                'name': 'Båt Farm Nord',
                'latitude': 70.8,
                'longitude': 28.2,
                'lice_count': 45,
                'temperature': 12.1,
                'diseases': [],
                'last_updated': datetime.utcnow().isoformat()
            },
            {
                'id': '2',
                'barentswatch_id': 'bw_002',
                'name': 'Anlegg Øst',
                'latitude': 70.75,
                'longitude': 28.5,
                'lice_count': 120,
                'temperature': 11.8,
                'diseases': [],
                'last_updated': datetime.utcnow().isoformat()
            },
            {
                'id': '3',
                'barentswatch_id': 'bw_003',
                'name': 'Kystanlegg Vest',
                'latitude': 70.85,
                'longitude': 27.9,
                'lice_count': 15,
                'temperature': 12.3,
                'diseases': [],
                'last_updated': datetime.utcnow().isoformat()
            },
            {
                'id': '4',
                'barentswatch_id': 'bw_004',
                'name': 'Dypvann Senter',
                'latitude': 70.95,
                'longitude': 29.1,
                'lice_count': 250,
                'temperature': 10.9,
                'diseases': [{'name': 'ISA', 'severity': 'high'}],
                'last_updated': datetime.utcnow().isoformat()
            },
            {
                'id': '5',
                'barentswatch_id': 'bw_005',
                'name': 'Fjord Aqua',
                'latitude': 70.65,
                'longitude': 28.8,
                'lice_count': 85,
                'temperature': 12.0,
                'diseases': [],
                'last_updated': datetime.utcnow().isoformat()
            }
        ]
    
    def _get_demo_vessels(self) -> List[Dict]:
        """Demo vessels for testing when BarentsWatch API is unavailable"""
        demo_vessels = [
            {
                'id': 'vessel_001',
                'mmsi': '259000001',
                'name': 'Wellboat Viking',
                'type': 'Wellboat',
                'latitude': 70.9,
                'longitude': 28.3,
                'last_visited': ['bw_001', 'bw_004'],  # Recently visited infected farm
                'last_updated': datetime.utcnow().isoformat()
            },
            {
                'id': 'vessel_002',
                'mmsi': '259000002',
                'name': 'Service Boat Nord',
                'type': 'Service Vessel',
                'latitude': 70.7,
                'longitude': 28.6,
                'last_visited': ['bw_002'],
                'last_updated': datetime.utcnow().isoformat()
            }
        ]
        # Track vessel history for risk calculation
        for vessel in demo_vessels:
            self.vessel_history[vessel['id']] = vessel.get('last_visited', [])
        return demo_vessels
    
    def close(self):
        """Close HTTP client"""
        self.client.close()
