"""BarentsWatch API Client - handles Facilities, NAIS, and AIS data"""
import os
import requests
from datetime import datetime, date, timedelta
from typing import Optional, Dict, List, Any
from ..ship_cache import get_ship_name


class BarentsWatchClient:
    """Client for BarentsWatch APIs - Facilities, NAIS Health, and AIS"""
    
    def __init__(self):
        self.facilities_client_id = "janinge88@hotmail.com:Kyst-Monitor"
        self.facilities_client_secret = "Test123456789"
        self.ais_client_id = "janinge88@hotmail.com:Kyst-Monitor-AIS"
        self.ais_client_secret = "Test123456789"
        
        self.token_endpoint = "https://id.barentswatch.no/connect/token"
        self.api_base = "https://www.barentswatch.no/bwapi"
        self.ais_base = "https://live.ais.barentswatch.no"
        
        self._facilities_token = None
        self._ais_token = None
    
    def _get_token(self, client_id: str, client_secret: str, scope: str) -> str:
        """Get OAuth2 token from BarentsWatch"""
        response = requests.post(
            self.token_endpoint,
            data={
                "client_id": client_id,
                "client_secret": client_secret,
                "scope": scope,
                "grant_type": "client_credentials"
            }
        )
        
        if response.status_code == 200:
            return response.json()["access_token"]
        else:
            raise Exception(f"Failed to get token: {response.text}")
    
    def _get_facilities_token(self) -> str:
        """Get or refresh token for Facilities API"""
        if not self._facilities_token:
            self._facilities_token = self._get_token(
                self.facilities_client_id,
                self.facilities_client_secret,
                "api"
            )
        return self._facilities_token
    
    def _get_ais_token(self) -> str:
        """Get or refresh token for AIS API"""
        if not self._ais_token:
            self._ais_token = self._get_token(
                self.ais_client_id,
                self.ais_client_secret,
                "ais"
            )
        return self._ais_token

    def _request_with_facilities_token(self, method: str, url: str, **kwargs) -> requests.Response:
        headers = kwargs.pop("headers", {})
        token = self._get_facilities_token()
        headers = {**headers, "Authorization": f"Bearer {token}"}
        response = requests.request(method, url, headers=headers, **kwargs)

        if response.status_code == 401:
            self._facilities_token = None
            token = self._get_facilities_token()
            headers["Authorization"] = f"Bearer {token}"
            response = requests.request(method, url, headers=headers, **kwargs)

        return response

    def _request_with_ais_token(self, method: str, url: str, **kwargs) -> requests.Response:
        headers = kwargs.pop("headers", {})
        token = self._get_ais_token()
        headers = {**headers, "Authorization": f"Bearer {token}"}
        response = requests.request(method, url, headers=headers, **kwargs)

        if response.status_code == 401:
            self._ais_token = None
            token = self._get_ais_token()
            headers["Authorization"] = f"Bearer {token}"
            response = requests.request(method, url, headers=headers, **kwargs)

        return response
    
    def get_facilities(self, limit: int = 100, skip: int = 0) -> List[Dict[str, Any]]:
        """
        Get aquaculture facilities from BarentsWatch
        
        IMPORTANT: The API returns max 100 records per request.
        To get all 2687 facilities, we need to make multiple paginated calls.
        
        Args:
            limit: Number of records to return (note: API max per call is 100)
            skip: Number of records to skip
            
        Returns:
            List of facility records (all unique, up to 'limit' total)
        """
        url = f"{self.api_base}/v1/geodata/fishhealth/localities"
        
        # API returns max 100 per call, so we need to paginate
        all_facilities = []
        current_skip = skip
        batch_size = 100
        
        while len(all_facilities) < limit:
            remaining = limit - len(all_facilities)
            # Take the smaller of: batch_size or what we still need
            current_limit = min(batch_size, remaining)
            
            params = {"limit": current_limit, "skip": current_skip}
            
            response = self._request_with_facilities_token("GET", url, params=params)
            
            if response.status_code == 200:
                batch = response.json()
                
                # If we got fewer than requested, we've hit the end
                if len(batch) == 0:
                    break
                
                all_facilities.extend(batch)
                current_skip += len(batch)
                
                # If we got less than a full batch, we're at the end
                if len(batch) < current_limit:
                    break
            else:
                raise Exception(f"Failed to get facilities: {response.text}")
        
        return all_facilities

    
    def get_localities_with_geo(self, limit: int = 3000) -> List[Dict[str, Any]]:
        """
        Get all aquaculture localities WITH geographic coordinates (lat/lng).
        
        This uses the /v1/geodata/locality endpoint which includes actual coordinates.
        
        Args:
            limit: Maximum number of records to return
            
        Returns:
            List of locality records with: localityNo, name, lat, lng, municipality, etc.
        """
        url = f"{self.api_base}/v1/geodata/locality"
        params = {"limit": limit}

        response = self._request_with_facilities_token("GET", url, params=params)
        
        if response.status_code == 200:
            return response.json()
        else:
            raise Exception(f"Failed to get localities with geo: {response.text}")
    
    def get_lice_data_v2(self, year: Optional[int] = None, week: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Get comprehensive fish health and lice data using the NEW v2 API endpoint.
        
        This is the updated endpoint (POST /v2/geodata/fishhealth/locality/{year}/{week})
        which includes:
        - Real GPS coordinates (as GeoJSON geometry)
        - Lice counts: adultFemaleLice, mobileLice, stationaryLice
        - Disease data
        - ALL localities (2000+) in a single call
        
        REAL DATA from Mattilsynet (updated daily at 06:00)
        
        Args:
            year: Year (defaults to current year)
            week: Week number 1-52 (defaults to current week)
            
        Returns:
            List of locality objects with lice data and coordinates
        """
        if year is None or week is None:
            today = datetime.now()
            year = today.year
            week = today.isocalendar()[1]

        # Some weeks can temporarily return empty data even though recent weeks have valid records.
        # Probe recent weeks (including current) to keep geo+disease enrichment stable.
        lookback_weeks = 12
        try:
            base_monday = date.fromisocalendar(year, week, 1)
        except Exception:
            today = datetime.now()
            base_monday = date.fromisocalendar(today.year, today.isocalendar()[1], 1)

        for offset in range(lookback_weeks + 1):
            probe_date = base_monday - timedelta(weeks=offset)
            iso = probe_date.isocalendar()
            probe_year = iso.year
            probe_week = iso.week

            url = f"{self.api_base}/v2/geodata/fishhealth/locality/{probe_year}/{probe_week}"

            try:
                response = self._request_with_facilities_token(
                    "POST",
                    url,
                    headers={"Content-Type": "application/json"},
                    json={},
                    timeout=15
                )

                if response.status_code == 200:
                    payload = response.json()
                    if isinstance(payload, list) and payload:
                        if offset > 0:
                            print(f"[INFO] Lice v2 fallback: using week {probe_week}/{probe_year} (current week had no data)")
                        return payload

                # If v2 fails or returns empty, try v1 for the same week
                try:
                    v1_payload = self._get_lice_data_v1(probe_year, probe_week)
                    if isinstance(v1_payload, list) and v1_payload:
                        if offset > 0:
                            print(f"[INFO] Lice v1 fallback: using week {probe_week}/{probe_year}")
                        return v1_payload
                except Exception:
                    pass

            except Exception:
                # Continue probing older weeks
                continue

        print("[WARN] No lice locality data found in current or recent weeks")
        return []

    def _has_meaningful_lice_payload(self, item: Dict[str, Any]) -> bool:
        """True when item contains usable lice values or explicit reporting signal."""
        if not isinstance(item, dict):
            return False

        report = item.get("liceReport") if isinstance(item.get("liceReport"), dict) else {}

        if report.get("hasReported") is True or item.get("hasReported") is True:
            return True

        metric_candidates = []
        for key in ("adultFemaleLice", "mobileLice", "stationaryLice", "totalLice"):
            metric_candidates.append(report.get(key))
            metric_candidates.append(item.get(key))

        for value in metric_candidates:
            if isinstance(value, dict):
                avg = value.get("average")
                if avg is not None:
                    return True
            elif value is not None:
                return True

        return False

    def _merge_lice_fields(self, target: Dict[str, Any], source: Dict[str, Any]) -> None:
        """Copy lice-relevant fields from older source into newer target when missing."""
        if not isinstance(target, dict) or not isinstance(source, dict):
            return

        fields = (
            "liceReport",
            "adultFemaleLice",
            "mobileLice",
            "stationaryLice",
            "totalLice",
            "hasReported",
            "hasRecentReport",
            "reportDate",
            "reportedAt",
            "sampleDate",
            "date",
            "hasFish",
            "isFallow",
        )

        for field in fields:
            value = source.get(field)
            if value is None:
                continue

            existing = target.get(field)
            if existing is None:
                target[field] = value
                continue

            if isinstance(existing, dict) and isinstance(value, dict):
                for subkey, subval in value.items():
                    if existing.get(subkey) is None and subval is not None:
                        existing[subkey] = subval

    def get_lice_data_v2_multiweek(self, weeks_back: int = 12) -> List[Dict[str, Any]]:
        """
        Build one merged locality list from several recent weeks.

        Keeps newest record per locality, but backfills lice fields from older weeks
        when the newest week lacks report data.
        """
        today = datetime.now()
        base_monday = date.fromisocalendar(today.year, today.isocalendar()[1], 1)

        merged: Dict[str, Dict[str, Any]] = {}

        for offset in range(max(0, int(weeks_back)) + 1):
            probe_date = base_monday - timedelta(weeks=offset)
            iso = probe_date.isocalendar()
            probe_year = iso.year
            probe_week = iso.week

            week_payload: List[Dict[str, Any]] = []
            url = f"{self.api_base}/v2/geodata/fishhealth/locality/{probe_year}/{probe_week}"

            try:
                response = self._request_with_facilities_token(
                    "POST",
                    url,
                    headers={"Content-Type": "application/json"},
                    json={},
                    timeout=15,
                )
                if response.status_code == 200:
                    payload = response.json()
                    if isinstance(payload, list):
                        week_payload = payload
            except Exception:
                week_payload = []

            if not week_payload:
                try:
                    fallback_payload = self._get_lice_data_v1(probe_year, probe_week)
                    if isinstance(fallback_payload, list):
                        week_payload = fallback_payload
                except Exception:
                    week_payload = []

            if not week_payload:
                continue

            for item in week_payload:
                locality = item.get("locality") if isinstance(item.get("locality"), dict) else {}
                locality_no = locality.get("no")
                if locality_no is None:
                    locality_no = item.get("localityNo")
                if locality_no is None:
                    continue

                key = str(locality_no)
                existing = merged.get(key)

                if existing is None:
                    merged[key] = dict(item)
                    continue

                if (not self._has_meaningful_lice_payload(existing)) and self._has_meaningful_lice_payload(item):
                    self._merge_lice_fields(existing, item)
                else:
                    self._merge_lice_fields(existing, item)

        return list(merged.values())
    
    def _get_lice_data_v1(self, year: int, week: int) -> List[Dict[str, Any]]:
        """
        Fallback to v1 endpoint if v2 is not available.
        Note: v1 does NOT include coordinates - those must be fetched separately.
        """
        url = f"{self.api_base}/v1/geodata/fishhealth/locality/{year}/{week}"

        response = self._request_with_facilities_token("GET", url, timeout=15)
        
        if response.status_code == 200:
            return response.json()
        else:
            raise Exception(f"Failed to get lice data (v1): {response.text}")
    
    def get_health_summary(self, year: Optional[int] = None, week: Optional[int] = None) -> Dict[str, Any]:
        """
        DEPRECATED: Use get_lice_data_v2() instead which includes all health data.
        
        Get fish health summary (NAIS data) for a specific week
        
        Args:
            year: Year (defaults to current year)
            week: Week number 1-52 (defaults to current week)
            
        Returns:
            Health summary data for the week
        """
        if year is None or week is None:
            today = datetime.now()
            year = today.year
            week = today.isocalendar()[1]
        
        token = self._get_facilities_token()
        headers = {"Authorization": f"Bearer {token}"}
        
        url = f"{self.api_base}/v1/geodata/fishhealth/{year}/{week}"
        
        response = requests.get(url, headers=headers)
        
        if response.status_code == 200:
            return response.json()
        else:
            raise Exception(f"Failed to get health summary: {response.text}")
    
    def get_ais_vessels(self, limit: int = 100) -> List[Dict[str, Any]]:
        """
        Get latest AIS vessel positions
        
        Args:
            limit: Max number of vessels to return
            
        Returns:
            List of AIS vessel records with position data enriched with vessel names from cache
        """
        try:
            url = f"{self.ais_base}/v1/latest/ais"

            # Bruk felles token-håndtering som automatisk refresher ved 401
            response = self._request_with_ais_token("GET", url, timeout=45, stream=False)

            print(f"[AIS] Response status: {response.status_code}, Content-Length: {len(response.content)} bytes")

            if response.status_code == 200:
                all_vessels = response.json()
                vessels_list = all_vessels[:limit] if isinstance(all_vessels, list) else all_vessels

                print(f"[AIS] Parsed {len(vessels_list)} vessels from response")

                # Enrich each vessel with name from cache
                for vessel in vessels_list:
                    mmsi = str(vessel.get("mmsi", ""))
                    if mmsi:
                        cached_name = get_ship_name(mmsi)
                        vessel["name"] = cached_name if cached_name else None
                    else:
                        vessel["name"] = None

                print(f"[AIS] Successfully returning {len(vessels_list)} enriched vessels")
                return vessels_list
            else:
                error_text = response.text[:500] if response.text else f"HTTP {response.status_code}"
                print(f"[AIS] ERROR: Status {response.status_code}, Response: {error_text}")
                raise Exception(f"Failed to get AIS data: {error_text}")

        except Exception as e:
            print(f"[AIS] EXCEPTION: {str(e)[:200]}")
            import traceback
            print(traceback.format_exc())
            raise

    def get_historic_ais(self, mmsi: Optional[int] = None) -> Optional[List[Dict[str, Any]]]:
        """
        Get historic AIS vessel position data from BarentsWatch (recent activity).

        If MMSI is provided, returns that vessel's track. Otherwise returns recent activity.
        """
        try:
            if mmsi:
                url = f"{self.api_base}/v2/geodata/ais/historic/{mmsi}"
            else:
                url = f"{self.api_base}/v2/geodata/ais/recent"

            response = self._request_with_facilities_token("GET", url, timeout=15)
            if response.status_code != 200:
                return None

            data = response.json()
            if isinstance(data, dict) and "positions" in data:
                return data.get("positions")
            if isinstance(data, list):
                return data
            return None
        except Exception:
            return None

    def search_vessels_by_name(self, query: str) -> List[Dict[str, Any]]:
        """
        Search live AIS feed for vessels whose name contains the query string.

        Useful for discovering a company's fleet (e.g. name='Frøy') and their real MMSIs.

        Returns:
            List of matching vessels with mmsi, name, latitude, longitude, sog, cog, timestamp.
        """
        query_norm = query.strip().lower()
        if not query_norm:
            return []

        try:
            all_vessels = self.get_ais_vessels(limit=5000)  # Fetch full live snapshot
        except Exception as e:
            print(f"[VESSEL_SEARCH] Failed to fetch AIS: {e}")
            return []

        results = []
        seen_mmsi: set = set()
        for vessel in all_vessels:
            name = str(vessel.get("name") or vessel.get("shipName") or "").lower()
            mmsi = str(vessel.get("mmsi") or "").strip()
            if not mmsi or mmsi in seen_mmsi:
                continue
            if query_norm in name:
                seen_mmsi.add(mmsi)
                results.append({
                    "mmsi": mmsi,
                    "name": vessel.get("name") or vessel.get("shipName"),
                    "latitude": vessel.get("latitude"),
                    "longitude": vessel.get("longitude"),
                    "sog": vessel.get("sog"),
                    "cog": vessel.get("cog"),
                    "timestamp": vessel.get("msgtime") or vessel.get("timestamp"),
                    "ship_type": vessel.get("shipType"),
                    "destination": vessel.get("destination"),
                })

        results.sort(key=lambda v: str(v.get("name") or ""))
        print(f"[VESSEL_SEARCH] Found {len(results)} vessels matching '{query}'")
        return results

    def get_locality_vessel_visits(
        self,
        locality_no: str,
        from_date: Optional[str] = None,
        to_date: Optional[str] = None
    ) -> Optional[List[Dict[str, Any]]]:
        """
        Get official vessel visits for a locality (if endpoint is available).

        Returns list of visits or None if unavailable.
        """
        params = {"localityNo": locality_no}
        if from_date:
            params["from"] = from_date
        if to_date:
            params["to"] = to_date

        endpoints = [
            f"{self.api_base}/v1/fishhealth/locality/vesselvisits",
            f"{self.api_base}/v1/fiskehelse/locality/vesselvisits",
        ]

        for url in endpoints:
            try:
                response = self._request_with_facilities_token("GET", url, params=params, timeout=15)
                if response.status_code == 200:
                    data = response.json()
                    if isinstance(data, dict) and "visits" in data:
                        return data.get("visits")
                    if isinstance(data, list):
                        return data
            except Exception:
                continue

        return None
    
    def get_vessel_locality_visits(
        self,
        mmsi: str,
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
    ) -> Optional[List[Dict[str, Any]]]:
        """
        Get all locality (facility) visits for a specific vessel by MMSI.

        Used in Phase 2 of BW-driven scan: after identifying which vessels
        visited an infected facility, we ask BW where those vessels went next.

        Returns list of visit records (each with localityNo, localityName,
        entryTime / exitTime / durationMinutes) or None if unavailable.
        """
        params: Dict[str, Any] = {"mmsi": mmsi}
        if from_date:
            params["from"] = from_date
        if to_date:
            params["to"] = to_date

        # Try both likely BW endpoint patterns
        endpoints = [
            f"{self.api_base}/v1/fishhealth/vessel/vesselvisits",
            f"{self.api_base}/v1/fishhealth/vessel/{mmsi}/vesselvisits",
            f"{self.api_base}/v1/fiskehelse/vessel/vesselvisits",
        ]

        for url in endpoints:
            try:
                response = self._request_with_facilities_token("GET", url, params=params, timeout=15)
                if response.status_code == 200:
                    data = response.json()
                    if isinstance(data, dict) and "visits" in data:
                        return data.get("visits")
                    if isinstance(data, list):
                        return data
            except Exception:
                continue

        return None

    def get_ila_zones(self, year: Optional[int] = None, week: Optional[int] = None) -> Dict[str, Any]:
        """
        Get ILA (ISA) protection and surveillance zones from BarentsWatch.
        These are official quarantine zones from Mattilsynet.
        
        Args:
            year: Year (defaults to current year)
            week: Week number 1-52 (defaults to current week)
            
        Returns:
            Dict with 'protection_zones' and 'surveillance_zones'
        """
        if year is None or week is None:
            today = datetime.now()
            year = today.year
            week = today.isocalendar()[1]
        
        try:
            protection_url = f"{self.api_base}/v1/geodata/fishhealth/ilaprotectionzone/{year}/{week}"
            surveillance_url = f"{self.api_base}/v1/geodata/fishhealth/ilasurveillancezone/{year}/{week}"
            
            protection_response = self._request_with_facilities_token("GET", protection_url, timeout=10)
            surveillance_response = self._request_with_facilities_token("GET", surveillance_url, timeout=10)
            
            protection_zones = protection_response.json() if protection_response.status_code == 200 else []
            surveillance_zones = surveillance_response.json() if surveillance_response.status_code == 200 else []
            
            return {
                "protection_zones": protection_zones,
                "surveillance_zones": surveillance_zones,
                "disease": "ILA",
                "year": year,
                "week": week
            }
        except Exception as e:
            print(f"Failed to get ILA zones: {e}")
            return {"protection_zones": [], "surveillance_zones": [], "disease": "ILA"}
    
    def get_pd_zones(self, year: Optional[int] = None, week: Optional[int] = None) -> Dict[str, Any]:
        """
        Get PD (Pancreatic Disease) protection and surveillance zones from BarentsWatch.
        These are official quarantine zones from Mattilsynet.
        
        Args:
            year: Year (defaults to current year)
            week: Week number 1-52 (defaults to current week)
            
        Returns:
            Dict with 'protection_zones' and 'surveillance_zones'
        """
        if year is None or week is None:
            today = datetime.now()
            year = today.year
            week = today.isocalendar()[1]
        
        try:
            protection_url = f"{self.api_base}/v1/geodata/fishhealth/pdprotectionzone/{year}/{week}"
            surveillance_url = f"{self.api_base}/v1/geodata/fishhealth/pdsurveillancezone/{year}/{week}"
            
            protection_response = self._request_with_facilities_token("GET", protection_url, timeout=10)
            surveillance_response = self._request_with_facilities_token("GET", surveillance_url, timeout=10)
            
            protection_zones = protection_response.json() if protection_response.status_code == 200 else []
            surveillance_zones = surveillance_response.json() if surveillance_response.status_code == 200 else []
            
            return {
                "protection_zones": protection_zones,
                "surveillance_zones": surveillance_zones,
                "disease": "PD",
                "year": year,
                "week": week
            }
        except Exception as e:
            print(f"Failed to get PD zones: {e}")
            return {"protection_zones": [], "surveillance_zones": [], "disease": "PD"}
