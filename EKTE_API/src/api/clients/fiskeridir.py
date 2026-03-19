"""Fiskeridirektoratet ArcGIS client for locality metadata and B-survey data."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import requests


class FiskeridirClient:
    """Client for open ArcGIS services from Fiskeridirektoratet."""

    def __init__(self) -> None:
        self.base_service_url = "https://gis.fiskeridir.no/server/rest/services/Yggdrasil"
        self.locality_query_url = f"{self.base_service_url}/Akvakulturregisteret/FeatureServer/0/query"
        self.b_survey_query_url = f"{self.base_service_url}/Milj%C3%B8tilstand/FeatureServer/0/query"

    def _query_features(
        self,
        query_url: str,
        out_fields: str,
        where: str = "1=1",
        order_by_fields: Optional[str] = None,
        max_records: int = 10000,
    ) -> List[Dict[str, Any]]:
        """Query ArcGIS layer with pagination."""
        all_features: List[Dict[str, Any]] = []
        offset = 0
        page_size = 2000

        while len(all_features) < max_records:
            params = {
                "f": "json",
                "where": where,
                "outFields": out_fields,
                "returnGeometry": "false",
                "resultOffset": offset,
                "resultRecordCount": min(page_size, max_records - len(all_features)),
            }
            if order_by_fields:
                params["orderByFields"] = order_by_fields

            response = requests.get(query_url, params=params, timeout=20)
            response.raise_for_status()
            payload = response.json() or {}

            if payload.get("error"):
                raise RuntimeError(f"ArcGIS query error: {payload['error']}")

            features = payload.get("features") or []
            if not features:
                break

            all_features.extend(features)
            if len(features) < params["resultRecordCount"]:
                break

            offset += len(features)

        return all_features

    @staticmethod
    def _to_iso_from_epoch_ms(value: Any) -> Optional[str]:
        if value in (None, ""):
            return None
        try:
            timestamp_ms = float(value)
            return datetime.fromtimestamp(timestamp_ms / 1000, tz=timezone.utc).isoformat()
        except Exception:
            return None

    def get_locality_metadata(self, max_records: int = 5000) -> Dict[str, Dict[str, Any]]:
        """Return normalized locality metadata indexed by locality number."""
        features = self._query_features(
            query_url=self.locality_query_url,
            out_fields=(
                "loknr,navn,symbol,til_arter,til_formaal,til_produksjonsform,"
                "kapasitet_lok,tempcapacity,kapasitet_unittype,status_lokalitet,til_innehavere,"
                "prodareacode,kommune,fylke,lat,lon,lokalitet_url_ekstern"
            ),
            max_records=max_records,
        )

        metadata_by_locality: Dict[str, Dict[str, Any]] = {}
        for feature in features:
            attrs = feature.get("attributes") or {}
            locality_no = attrs.get("loknr")
            if locality_no is None:
                continue

            key = str(locality_no)
            metadata_by_locality[key] = {
                "locality_no": key,
                "name": attrs.get("navn"),
                "production_category": attrs.get("symbol"),
                "species": attrs.get("til_arter"),
                "purpose": attrs.get("til_formaal"),
                "production_form": attrs.get("til_produksjonsform"),
                "capacity": attrs.get("kapasitet_lok"),
                "current_capacity": attrs.get("tempcapacity"),
                "capacity_unit": attrs.get("kapasitet_unittype"),
                "locality_status": attrs.get("status_lokalitet"),
                "holders": attrs.get("til_innehavere"),
                "production_area": attrs.get("prodareacode"),
                "municipality": attrs.get("kommune"),
                "county": attrs.get("fylke"),
                "latitude": attrs.get("lat"),
                "longitude": attrs.get("lon"),
                "external_url": attrs.get("lokalitet_url_ekstern"),
            }

        return metadata_by_locality

    def get_latest_b_survey_by_locality(self, max_records: int = 8000) -> Dict[str, Dict[str, Any]]:
        """Return latest available B-survey record per locality."""
        features = self._query_features(
            query_url=self.b_survey_query_url,
            out_fields=(
                "loknr,navn,sitecondition,measurementdate,reportid,download,lenke_rapport,"
                "group2phehindex,group3correctedsumindex,mediangroup2and3index"
            ),
            where="measurementdate IS NOT NULL",
            order_by_fields="measurementdate DESC",
            max_records=max_records,
        )

        survey_by_locality: Dict[str, Dict[str, Any]] = {}
        for feature in features:
            attrs = feature.get("attributes") or {}
            locality_no = attrs.get("loknr")
            if locality_no is None:
                continue

            key = str(locality_no)
            if key in survey_by_locality:
                continue

            survey_by_locality[key] = {
                "locality_no": key,
                "name": attrs.get("navn"),
                "site_condition": attrs.get("sitecondition"),
                "measurement_date": self._to_iso_from_epoch_ms(attrs.get("measurementdate")),
                "report_id": attrs.get("reportid"),
                "report_pdf": attrs.get("download"),
                "report_map": attrs.get("lenke_rapport"),
                "index_group_2": attrs.get("group2phehindex"),
                "index_group_3": attrs.get("group3correctedsumindex"),
                "index_group_2_3": attrs.get("mediangroup2and3index"),
            }

        return survey_by_locality
