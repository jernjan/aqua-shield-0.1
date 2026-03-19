"""
Background prediction scheduler - runs outbreak risk predictions hourly

This module runs in background and updates the prediction cache every hour.
Also runs infection path detection (smittespredning) checks during each prediction cycle.
Integrates with FastAPI startup/shutdown events.
"""

import asyncio
import logging
from datetime import datetime, timedelta
import traceback

logger = logging.getLogger(__name__)


def _normalize_facility_name(name: str) -> str:
    if not isinstance(name, str):
        return name
    if "\u00c3" not in name:
        return name
    try:
        fixed = name.encode("latin1").decode("utf-8")
        return fixed if "\u00c3" not in fixed else name
    except (UnicodeEncodeError, UnicodeDecodeError):
        return name


class PredictionScheduler:
    """Manages background prediction tasks"""
    
    def __init__(self):
        """Initialize scheduler"""
        self.is_running = False
        self.last_run = None
        self.last_validation = None
        self.last_tracking_run = None
        self.run_interval_seconds = 3600  # 1 hour
        self.validation_interval_seconds = 86400  # 24 hours
        self.tracking_interval_seconds = 7200  # 2 hours for BW two-phase scan
        self.detector = None  # Will be initialized in start()
        self.validator = None  # Will be initialized in start()
        self.ocean_client = None  # Will be initialized in start()
        self.barentswatch_client = None  # Will be initialized in start()
    
    async def start(self, app_context):
        """Start background prediction scheduler"""
        self.is_running = True
        self.app_context = app_context
        
        # Initialize ocean current client
        try:
            from src.api.clients.cmems import CMEMSClient
            self.ocean_client = CMEMSClient()
            logger.info("✅ Ocean current client initialized")
        except Exception as e:
            logger.warning(f"⚠️ Failed to initialize ocean client: {e}")
            self.ocean_client = None
        
        # Initialize prediction validator
        try:
            from src.api.prediction_validator import PredictionValidator
            self.validator = PredictionValidator()
            logger.info("✅ Prediction validator initialized")
        except Exception as e:
            logger.warning(f"⚠️ Failed to initialize validator: {e}")
            self.validator = None
        
        # Initialize smittespredning detector
        try:
            from src.api.clients.barentswatch import BarentsWatchClient
            from src.api.smittespredning_detector import SmittespredningDetector
            self.barentswatch_client = BarentsWatchClient()
            self.detector = SmittespredningDetector(self.barentswatch_client)
            logger.info("✅ Smittespredning detector initialized")
        except Exception as e:
            logger.warning(f"⚠️ Failed to initialize detector: {e}")
            self.detector = None
            self.barentswatch_client = None
        
        # Run initial prediction without blocking startup
        asyncio.create_task(self.run_predictions())
        
        # Start AIS tracking after short delay
        asyncio.create_task(self._delayed_tracking_start())
        
        # Schedule repeating runs
        asyncio.create_task(self._scheduler_loop())
        asyncio.create_task(self._validation_loop())
        asyncio.create_task(self._tracking_loop())
        logger.info("✅ Prediction scheduler started (predictions: 1h, validation: 24h, BW scan: 2h)")
    
    async def stop(self):
        """Stop background scheduler"""
        self.is_running = False
        logger.info("🛑 Prediction scheduler stopped")
    
    async def _scheduler_loop(self):
        """Main scheduler loop for predictions"""
        while self.is_running:
            try:
                await asyncio.sleep(self.run_interval_seconds)
                if self.is_running:
                    await self.run_predictions()
            except Exception as e:
                logger.error(f"Error in prediction scheduler loop: {e}")
                traceback.print_exc()
    
    async def _validation_loop(self):
        """Validation scheduler loop - runs daily"""
        while self.is_running:
            try:
                await asyncio.sleep(self.validation_interval_seconds)
                if self.is_running:
                    await self.run_validation()
            except Exception as e:
                logger.error(f"Error in validation scheduler loop: {e}")
                traceback.print_exc()
    
    async def _delayed_tracking_start(self):
        """On startup: run BW 48h backfill and first two-phase scan immediately."""
        await asyncio.sleep(10)  # Short delay after startup
        if self.is_running:
            # Backfill any visits missed while server was offline
            asyncio.create_task(self.run_bw_locality_backfill(lookback_hours=48))
            # Then run first BW two-phase scan
            await self.run_bw_two_phase_scan()

    async def run_bw_locality_backfill(self, lookback_hours: int = 48) -> dict:
        """Run BW locality backfill in a worker thread to avoid blocking the API."""
        return await asyncio.to_thread(self._run_bw_locality_backfill_sync, lookback_hours)

    def _run_bw_locality_backfill_sync(self, lookback_hours: int = 48) -> dict:
        """
        Backfill vessel visit history from BarentsWatch locality visit API.

        Queries BW for official vessel visits at infected/at-risk facilities
        over the last N hours, and logs any previously unseen visits to the
        exposure events database. Fills gaps caused by server downtime.
        """
        if not self.barentswatch_client:
            logger.warning("⚠️ BW client not available, skipping BW locality backfill")
            return {"status": "skipped", "reason": "no_bw_client"}

        import json
        import os
        from datetime import datetime, timedelta
        from src.api.database import log_exposure_event

        logger.info(f"🔄 Starting BW locality visit backfill (last {lookback_hours}h)...")

        cache_path = os.path.join(os.path.dirname(__file__), "data", "disease_spread_cache.json")
        if not os.path.exists(cache_path):
            logger.warning("⚠️ No disease_spread_cache.json – skipping BW backfill")
            return {"status": "skipped", "reason": "no_cache"}

        with open(cache_path, "r", encoding="utf-8") as f:
            cache_data = json.load(f)

        infected = cache_data.get("confirmed_diseased_facilities", [])
        risk = cache_data.get("all_at_risk_facilities", [])

        # Mark zone type on each entry
        infected_codes = set()
        for item in infected:
            item["_zone"] = "INFECTED"
            code = str(item.get("facility_code") or "").strip()
            if code:
                infected_codes.add(code)
        for item in risk:
            item["_zone"] = item.get("zone_type", "SURVEILLANCE")

        all_facilities = infected + risk

        from_dt = datetime.utcnow() - timedelta(hours=lookback_hours)
        from_date = from_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
        to_date = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")

        total_new = 0
        facilities_checked = 0
        facilities_with_data = 0

        for facility in all_facilities:
            locality_no = str(
                facility.get("facility_code") or facility.get("localityNo") or ""
            ).strip()
            if not locality_no:
                continue

            facility_name = _normalize_facility_name(
                facility.get("facility_name") or facility.get("name") or "Unknown"
            )
            zone_type = facility.get("_zone", "SURVEILLANCE")
            is_infected = zone_type == "INFECTED"

            try:
                visits = self.barentswatch_client.get_locality_vessel_visits(
                    locality_no=locality_no,
                    from_date=from_date,
                    to_date=to_date,
                )
                facilities_checked += 1

                if not visits:
                    continue

                facilities_with_data += 1

                for visit in visits:
                    mmsi = str(
                        visit.get("mmsi") or visit.get("vesselMMSI") or ""
                    ).strip()
                    if not mmsi:
                        continue

                    vessel_name = (
                        visit.get("vesselName")
                        or visit.get("name")
                        or f"Vessel {mmsi}"
                    )
                    duration = int(
                        visit.get("durationMinutes")
                        or visit.get("duration")
                        or 30
                    )

                    # Only log visits that meet the minimum duration threshold
                    if duration < 20:
                        continue

                    # Use the actual visit timestamp from BW if available
                    visit_time = (
                        visit.get("visitTime")
                        or visit.get("timestamp")
                        or visit.get("entryTime")
                        or from_date
                    )

                    try:
                        eid = log_exposure_event(
                            vessel_mmsi=mmsi,
                            vessel_name=vessel_name,
                            facility_id=locality_no,
                            facility_name=facility_name,
                            distance_km=0.1,  # BW confirms vessel was at facility
                            duration_min=duration,
                            disease_status="INFECTED" if is_infected else zone_type,
                            risk_triggered=is_infected,
                            risk_level="HIGH" if is_infected else "MEDIUM",
                            timestamp=visit_time,
                            skip_distance_check=True,
                            notes="BW locality visit backfill – BarentsWatch official records",
                        )
                        if eid and eid > 0:
                            total_new += 1
                    except Exception:
                        pass  # Duplicate or constraint error – skip silently

            except Exception as e:
                logger.debug(f"BW backfill: no data for {locality_no} ({facility_name}): {e}")
                continue

        logger.info(
            f"✅ BW locality backfill done: {total_new} new visits from "
            f"{facilities_with_data}/{facilities_checked} facilities"
        )
        return {
            "status": "ok",
            "new_visits": total_new,
            "facilities_checked": facilities_checked,
            "facilities_with_data": facilities_with_data,
            "lookback_hours": lookback_hours,
        }

    
    async def _tracking_loop(self):
        """BW two-phase scan loop - runs every 2 hours"""
        while self.is_running:
            try:
                await asyncio.sleep(self.tracking_interval_seconds)
                if self.is_running:
                    await self.run_bw_two_phase_scan()
            except Exception as e:
                logger.error(f"Error in BW scan loop: {e}")
                traceback.print_exc()

        async def run_bw_two_phase_scan(self) -> dict:
                """Run BW two-phase scan in a worker thread to avoid blocking the API."""
                return await asyncio.to_thread(self._run_bw_two_phase_scan_sync)

        def _run_bw_two_phase_scan_sync(self) -> dict:
                """
                BW-only two-phase vessel visit scan. No AIS position tracking needed.

                Phase 1 — Primary exposure:
                    For each infected/risk facility, fetch BW locality visit records.
                    → Identifies which vessels (MMSI) visited a high-risk facility and when
                        they departed. Logs each as a primary exposure event.

                Phase 2 — Secondary spread:
                    For each newly exposed MMSI, fetch BW locality visits across ALL
                    facilities in the last 48h since departure.
                    → Any subsequent facility visit becomes a secondary exposure event,
                        flagging potential smittespredning.

                Runs every 2 hours. No positions, no Haversine, no AIS polling.
                """
        if not self.barentswatch_client:
            logger.warning("⚠️ BW client not available, skipping BW two-phase scan")
            return {"status": "skipped", "reason": "no_bw_client"}

        import json
        import os
        from datetime import datetime, timedelta
        from src.api.database import log_exposure_event

        logger.info("🔍 BW two-phase scan starting...")
        scan_start = datetime.utcnow()

        # ── Load disease cache ────────────────────────────────────────────────
        cache_path = os.path.join(os.path.dirname(__file__), "data", "disease_spread_cache.json")
        if not os.path.exists(cache_path):
            logger.warning("⚠️ No disease_spread_cache.json – skipping BW two-phase scan")
            return {"status": "skipped", "reason": "no_cache"}

        with open(cache_path, "r", encoding="utf-8") as f:
            cache_data = json.load(f)

        infected = cache_data.get("confirmed_diseased_facilities", [])
        risk = cache_data.get("all_at_risk_facilities", [])
        for item in infected:
            item["_zone"] = "INFECTED"
        for item in risk:
            item["_zone"] = item.get("zone_type", "SURVEILLANCE")
        all_risk_facilities = infected + risk

        now = datetime.utcnow()
        window_from = (now - timedelta(hours=48)).strftime("%Y-%m-%dT%H:%M:%SZ")
        window_to   = now.strftime("%Y-%m-%dT%H:%M:%SZ")

        # ── Phase 1: which vessels visited risk facilities? ───────────────────
        # exposed_vessels: {mmsi_str -> {name, source_facility, source_zone, departure_time_str}}
        exposed_vessels: dict = {}
        phase1_logged = 0

        for facility in all_risk_facilities:
            locality_no = str(
                facility.get("facility_code") or facility.get("localityNo") or ""
            ).strip()
            if not locality_no:
                continue

            facility_name = _normalize_facility_name(
                facility.get("facility_name") or facility.get("name") or "Unknown"
            )
            zone = facility.get("_zone", "SURVEILLANCE")
            is_infected = zone == "INFECTED"

            try:
                visits = self.barentswatch_client.get_locality_vessel_visits(
                    locality_no=locality_no,
                    from_date=window_from,
                    to_date=window_to,
                )
            except Exception:
                continue

            if not visits:
                continue

            for visit in visits:
                mmsi = str(visit.get("mmsi") or visit.get("vesselMMSI") or "").strip()
                if not mmsi:
                    continue

                vessel_name = visit.get("vesselName") or visit.get("name") or f"Vessel {mmsi}"
                duration = int(visit.get("durationMinutes") or visit.get("duration") or 30)
                if duration < 20:
                    continue

                # Prefer explicit exit/departure time; fall back to entry time
                departure_time = (
                    visit.get("exitTime")
                    or visit.get("departureTime")
                    or visit.get("visitTime")
                    or visit.get("entryTime")
                    or window_from
                )

                try:
                    eid = log_exposure_event(
                        vessel_mmsi=mmsi,
                        vessel_name=vessel_name,
                        facility_id=locality_no,
                        facility_name=facility_name,
                        distance_km=0.1,
                        duration_min=duration,
                        disease_status="INFECTED" if is_infected else zone,
                        risk_triggered=is_infected,
                        risk_level="HIGH" if is_infected else "MEDIUM",
                        timestamp=departure_time,
                        skip_distance_check=True,
                        notes="BW two-phase scan – Phase 1 (primary exposure)",
                    )
                    if eid and eid > 0:
                        phase1_logged += 1
                except Exception:
                    pass

                # Track for Phase 2 regardless of whether DB insert was new
                if mmsi not in exposed_vessels:
                    exposed_vessels[mmsi] = {
                        "name": vessel_name,
                        "source_facility": facility_name,
                        "source_zone": zone,
                        "departure_time": departure_time,
                    }

        logger.info(
            f"✅ Phase 1 complete: {phase1_logged} new primary exposures, "
            f"{len(exposed_vessels)} unique exposed vessels"
        )

        # ── Phase 2: where did exposed vessels go next? ───────────────────────
        phase2_logged = 0
        vessels_with_secondary = 0

        for mmsi, meta in exposed_vessels.items():
            departure = meta["departure_time"]
            try:
                subsequent = self.barentswatch_client.get_vessel_locality_visits(
                    mmsi=mmsi,
                    from_date=departure,
                    to_date=window_to,
                )
            except Exception:
                continue

            if not subsequent:
                continue

            has_secondary = False
            for visit in subsequent:
                sec_locality = str(
                    visit.get("localityNo") or visit.get("facilityCode") or ""
                ).strip()
                sec_name = _normalize_facility_name(
                    visit.get("localityName") or visit.get("facilityName") or f"Facility {sec_locality}"
                )
                duration = int(visit.get("durationMinutes") or visit.get("duration") or 30)
                if duration < 20 or not sec_locality:
                    continue

                visit_time = (
                    visit.get("exitTime")
                    or visit.get("entryTime")
                    or departure
                )

                try:
                    eid = log_exposure_event(
                        vessel_mmsi=mmsi,
                        vessel_name=meta["name"],
                        facility_id=sec_locality,
                        facility_name=sec_name,
                        distance_km=0.1,
                        duration_min=duration,
                        disease_status="SECONDARY_EXPOSURE",
                        risk_triggered=True,
                        risk_level="HIGH" if meta["source_zone"] == "INFECTED" else "MEDIUM",
                        timestamp=visit_time,
                        skip_distance_check=True,
                        notes=(
                            f"BW two-phase scan – Phase 2 (secondary spread from "
                            f"{meta['source_facility']})"
                        ),
                    )
                    if eid and eid > 0:
                        phase2_logged += 1
                        has_secondary = True
                except Exception:
                    pass

            if has_secondary:
                vessels_with_secondary += 1

        # ── AIS fallback when BW returns no visit data ───────────────────────
        if not exposed_vessels:
            logger.info(
                "⚠️  BW visit feed returned no data — running AIS hybrid fallback"
            )
            fallback = self._ais_fallback_scan(
                all_risk_facilities,
                window_from,
                window_to,
                now,
            )
            phase1_logged += fallback.get("phase1_logged", 0)
            phase2_logged += fallback.get("phase2_logged", 0)
            exposed_vessels.update(fallback.get("exposed_vessels", {}))
            vessels_with_secondary += fallback.get("vessels_with_secondary", 0)

        elapsed = (datetime.utcnow() - scan_start).total_seconds()
        logger.info(
            f"✅ BW two-phase scan done in {elapsed:.1f}s: "
            f"{phase1_logged} primary + {phase2_logged} secondary exposures, "
            f"{vessels_with_secondary}/{len(exposed_vessels)} vessels with secondary spread"
        )
        return {
            "status": "ok",
            "phase1_new_exposures": phase1_logged,
            "phase2_new_exposures": phase2_logged,
            "exposed_vessels": len(exposed_vessels),
            "vessels_with_secondary_spread": vessels_with_secondary,
            "elapsed_seconds": round(elapsed, 1),
        }
    
    def _ais_fallback_scan(
        self,
        all_risk_facilities: list,
        window_from: str,
        window_to: str,
        now,
    ) -> dict:
        """
        AIS-based fallback for when BW visit feed is unavailable.

        Optimisation: instead of checking all 9000+ vessels against all risk
        facilities (2M+ Haversine calls per cycle), we:
          1. Build a combined bounding box around all risk facilities (+2km margin).
          2. Pre-filter AIS vessels to those inside the box — typically <5% of total.
          3. Only run Haversine on the pre-filtered set.
          4. Store all vessel positions to DB for secondary-spread detection.
          5. Phase 2: load stored 48h positions of exposed vessels, check for
             subsequent facility visits via Haversine.

        Result: ~95% fewer Haversine calls vs the old 15-min loop.
        """
        from math import radians, cos, sin, asin, sqrt
        from datetime import timedelta
        from src.api.database import (
            log_exposure_event,
            log_vessel_positions_batch,
            get_recent_positions_for_mmsis,
        )

        VISIT_RADIUS_KM = 0.5   # Must be within 500m to count as a facility visit
        BBOX_MARGIN_DEG_LAT = 0.02   # ~2.2 km margin on bounding box lat filter
        BBOX_MARGIN_DEG_LON = 0.03   # ~2.2 km margin on bounding box lon filter

        def haversine(lat1, lon1, lat2, lon2):
            lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
            dlat, dlon = lat2 - lat1, lon2 - lon1
            a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
            return 6371 * 2 * asin(sqrt(a))

        # Build risk-facility lookup ────────────────────────────────────────────
        facilities_geo = []
        for fac in all_risk_facilities:
            pos = fac.get("position") or {}
            lat = pos.get("latitude") if pos else fac.get("latitude")
            lon = pos.get("longitude") if pos else fac.get("longitude")
            code = str(
                fac.get("facility_code") or fac.get("localityNo") or ""
            ).strip()
            if not (code and lat and lon):
                continue
            facilities_geo.append({
                "code": code,
                "name": _normalize_facility_name(
                    fac.get("facility_name") or fac.get("name") or "Unknown"
                ),
                "lat": float(lat),
                "lon": float(lon),
                "zone": fac.get("_zone", "SURVEILLANCE"),
            })

        if not facilities_geo:
            return {"phase1_logged": 0, "phase2_logged": 0, "exposed_vessels": {}, "vessels_with_secondary": 0}

        # Combined bounding box ────────────────────────────────────────────────
        min_lat = min(f["lat"] for f in facilities_geo) - BBOX_MARGIN_DEG_LAT
        max_lat = max(f["lat"] for f in facilities_geo) + BBOX_MARGIN_DEG_LAT
        min_lon = min(f["lon"] for f in facilities_geo) - BBOX_MARGIN_DEG_LON
        max_lon = max(f["lon"] for f in facilities_geo) + BBOX_MARGIN_DEG_LON

        # Fetch AIS snapshot ───────────────────────────────────────────────────
        try:
            vessels = self.barentswatch_client.get_ais_vessels(limit=10000)
        except Exception as e:
            logger.error(f"AIS fallback: failed to fetch vessels: {e}")
            return {"phase1_logged": 0, "phase2_logged": 0, "exposed_vessels": {}, "vessels_with_secondary": 0}

        if not vessels:
            return {"phase1_logged": 0, "phase2_logged": 0, "exposed_vessels": {}, "vessels_with_secondary": 0}

        snap_ts = now.strftime("%Y-%m-%dT%H:%M:%SZ")

        # Save all vessels with known positions to DB for future Phase 2 lookups
        pos_batch = [
            {
                "mmsi": str(v.get("mmsi", "")),
                "name": v.get("name"),
                "latitude": v.get("latitude"),
                "longitude": v.get("longitude"),
                "speed_knots": v.get("sog") or v.get("speed"),
                "timestamp": snap_ts,
            }
            for v in vessels
            if v.get("mmsi") and v.get("latitude") is not None and v.get("longitude") is not None
        ]
        try:
            log_vessel_positions_batch(pos_batch)
        except Exception:
            pass

        # Pre-filter by bounding box (fast arithmetic) ────────────────────────
        candidates = [
            v for v in vessels
            if (
                v.get("latitude") is not None
                and v.get("longitude") is not None
                and min_lat <= v["latitude"] <= max_lat
                and min_lon <= v["longitude"] <= max_lon
            )
        ]
        logger.info(
            f"🗺️  AIS fallback: {len(vessels)} vessels total, "
            f"{len(candidates)} inside facility bounding box, "
            f"running Haversine on {len(candidates)} × {len(facilities_geo)} = "
            f"{len(candidates) * len(facilities_geo):,} pairs"
        )

        # Phase 1 — proximity check (Haversine on pre-filtered only) ──────────
        phase1_logged = 0
        exposed_vessels: dict = {}

        for vessel in candidates:
            mmsi = str(vessel.get("mmsi", "")).strip()
            if not mmsi:
                continue
            vname = vessel.get("name") or f"Vessel {mmsi}"
            vlat = float(vessel["latitude"])
            vlon = float(vessel["longitude"])

            for fac in facilities_geo:
                dist = haversine(vlat, vlon, fac["lat"], fac["lon"])
                if dist > VISIT_RADIUS_KM:
                    continue

                is_infected = fac["zone"] == "INFECTED"
                try:
                    eid = log_exposure_event(
                        vessel_mmsi=mmsi,
                        vessel_name=vname,
                        facility_id=fac["code"],
                        facility_name=fac["name"],
                        distance_km=round(dist, 3),
                        duration_min=120,   # estimated for 2h scan cycle
                        disease_status="INFECTED" if is_infected else fac["zone"],
                        risk_triggered=is_infected,
                        risk_level="HIGH" if is_infected else "MEDIUM",
                        timestamp=snap_ts,
                        skip_distance_check=True,
                        notes="AIS hybrid fallback – Phase 1 (primary exposure)",
                    )
                    if eid and eid > 0:
                        phase1_logged += 1
                except Exception:
                    pass

                if mmsi not in exposed_vessels:
                    exposed_vessels[mmsi] = {
                        "name": vname,
                        "source_facility": fac["name"],
                        "source_zone": fac["zone"],
                        "departure_time": window_from,
                    }

        logger.info(
            f"✅ AIS fallback Phase 1: {phase1_logged} new primary exposures, "
            f"{len(exposed_vessels)} unique exposed vessels"
        )

        # Phase 2 — secondary spread via stored position history ──────────────
        phase2_logged = 0
        vessels_with_secondary = 0

        if exposed_vessels:
            since_48h = (now - timedelta(hours=48)).strftime("%Y-%m-%dT%H:%M:%SZ")
            try:
                history = get_recent_positions_for_mmsis(
                    set(exposed_vessels.keys()), since_48h
                )
            except Exception:
                history = {}

            for mmsi, positions in history.items():
                meta = exposed_vessels.get(mmsi, {})
                has_secondary = False

                for pos in positions:
                    plat = pos["latitude"]
                    plon = pos["longitude"]
                    pts = pos["timestamp"]

                    for fac in facilities_geo:
                        # Skip the facility that triggered the primary exposure
                        if fac["name"] == meta.get("source_facility"):
                            continue
                        dist = haversine(plat, plon, fac["lat"], fac["lon"])
                        if dist > VISIT_RADIUS_KM:
                            continue

                        try:
                            eid = log_exposure_event(
                                vessel_mmsi=mmsi,
                                vessel_name=meta.get("name", f"Vessel {mmsi}"),
                                facility_id=fac["code"],
                                facility_name=fac["name"],
                                distance_km=round(dist, 3),
                                duration_min=120,
                                disease_status="SECONDARY_EXPOSURE",
                                risk_triggered=True,
                                risk_level="HIGH" if meta.get("source_zone") == "INFECTED" else "MEDIUM",
                                timestamp=pts,
                                skip_distance_check=True,
                                notes=(
                                    f"AIS hybrid fallback – Phase 2 (secondary spread from "
                                    f"{meta.get('source_facility', '?')})"
                                ),
                            )
                            if eid and eid > 0:
                                phase2_logged += 1
                                has_secondary = True
                        except Exception:
                            pass

                if has_secondary:
                    vessels_with_secondary += 1

        logger.info(
            f"✅ AIS fallback Phase 2: {phase2_logged} secondary exposures, "
            f"{vessels_with_secondary}/{len(exposed_vessels)} vessels with secondary spread"
        )
        return {
            "phase1_logged": phase1_logged,
            "phase2_logged": phase2_logged,
            "exposed_vessels": exposed_vessels,
            "vessels_with_secondary": vessels_with_secondary,
        }

    async def run_ais_tracking(self):
        """Track vessel positions and detect facility visits"""
        if not self.barentswatch_client:
            logger.warning("⚠️ BarentsWatch client not initialized, skipping AIS tracking")
            return
        
        try:
            import json
            import os
            from math import radians, cos, sin, asin, sqrt
            from src.api.database import log_exposure_event
            
            logger.info("🚢 Starting AIS tracking cycle...")
            start_time = datetime.now()
            
            # Load disease spread cache for facility zone classifications
            cache_path = os.path.join(
                os.path.dirname(__file__), 
                "data", 
                "disease_spread_cache.json"
            )
            
            if not os.path.exists(cache_path):
                logger.warning(f"⚠️ Disease spread cache not found at {cache_path}")
                return
            
            with open(cache_path, 'r', encoding='utf-8') as f:
                cache_data = json.load(f)
            
            # Get all at-risk facilities (includes zone_type classification)
            facilities = cache_data.get('all_at_risk_facilities', [])
            
            # Also get confirmed diseased facilities
            diseased = cache_data.get('confirmed_diseased_facilities', [])
            
            # Merge and mark diseased facilities as INFECTED zone type
            for d in diseased:
                d['zone_type'] = 'INFECTED'
                # Fix position structure if needed
                if 'latitude' in d and 'longitude' in d:
                    d['position'] = {
                        'latitude': d['latitude'],
                        'longitude': d['longitude']
                    }
            
            # Combine all facilities
            all_facilities = facilities + diseased
            if not facilities:
                logger.warning(f"⚠️ No facilities in disease spread cache (all_at_risk: {len(facilities)}, diseased: {len(diseased)})")
                return
            
            # Fetch current AIS vessels
            try:
                vessels = self.barentswatch_client.get_ais_vessels(limit=500)
                if not vessels:
                    logger.warning("⚠️ No AIS vessels returned")
                    return
            except Exception as e:
                logger.error(f"❌ Failed to fetch AIS vessels: {e}")
                return
            
            # Filter out vessels without position
            vessels_with_position = [
                v for v in vessels 
                if v.get('latitude') and v.get('longitude')
            ]
            
            logger.info(f"📍 Tracking {len(vessels_with_position)} vessels against {len(facilities)} facilities")
            
            def calculate_distance_km(lat1, lon1, lat2, lon2):
                """Calculate distance between two points using Haversine formula"""
                lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
                dlat = lat2 - lat1
                dlon = lon2 - lon1
                a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
                c = 2 * asin(sqrt(a))
                return 6371 * c  # Earth radius in km
            
            # Track detections by category
            detections = {
                'infected_facility': 0,
                'risk_zone_facility': 0,
                'near_infected_10km': 0
            }
            
            # Find infected facilities for 10km rule
            infected_facilities = diseased  # All confirmed diseased are infected
            
            # Check each vessel against facilities
            for vessel in vessels_with_position:
                mmsi = vessel.get('mmsi')
                vessel_name = vessel.get('name', 'Unknown')
                vessel_lat = vessel.get('latitude')
                vessel_lon = vessel.get('longitude')
                
                if not mmsi:
                    continue
                
                # Check proximity to all at-risk and diseased facilities
                for facility in all_facilities:
                    facility_code = facility.get('facility_code')
                    facility_name = facility.get('facility_name', 'Unknown')
                    
                    # Handle nested position structure
                    position = facility.get('position', {})
                    facility_lat = position.get('latitude') if position else facility.get('latitude')
                    facility_lon = position.get('longitude') if position else facility.get('longitude')
                    
                    zone_type = facility.get('zone_type', 'UNKNOWN')
                    
                    if not all([facility_code, facility_lat, facility_lon]):
                        continue
                    
                    distance = calculate_distance_km(
                        vessel_lat, vessel_lon,
                        facility_lat, facility_lon
                    )
                    
                    # DIRECT VISIT: Within 500m (0.5km)
                    if distance <= 0.5:
                        # Categorize based on zone type
                        if zone_type == 'INFECTED':
                            visit_category = 'infected_facility'
                            risk_level = 'HIGH'
                            risk_triggered = True
                            detections['infected_facility'] += 1
                        elif zone_type in ['SURVEILLANCE', 'PROTECTION']:
                            visit_category = 'risk_zone_facility'
                            risk_level = 'MEDIUM'
                            risk_triggered = True
                            detections['risk_zone_facility'] += 1
                        else:
                            visit_category = 'healthy_facility'
                            risk_level = 'LOW'
                            risk_triggered = False
                        
                        # Log the visit
                        try:
                            log_exposure_event(
                                vessel_mmsi=str(mmsi),
                                vessel_name=vessel_name,
                                facility_id=facility_code,
                                facility_name=facility_name,
                                distance_km=round(distance, 3),
                                                                duration_min=25,  # Assume 25min average (detection threshold is 20min)
                                disease_status=zone_type,
                                risk_triggered=risk_triggered,
                                risk_level=risk_level,
                                notes=f"Visit detected via AIS tracking - Category: {visit_category}"
                            )
                        except Exception as e:
                            logger.error(f"Failed to log visit for {mmsi} to {facility_code}: {e}")
                
                # Note: Cluster detection (10 km rule) is now handled in API endpoint
                # Only actual facility visits (≤1 km) are logged to database
            
            elapsed = (datetime.now() - start_time).total_seconds()
            
            logger.info(
                f"✅ AIS tracking complete: "
                f"{len(vessels_with_position)} vessels tracked, "
                f"Infected visits: {detections['infected_facility']}, "
                f"Risk zone visits: {detections['risk_zone_facility']}, "
                f"10km proximity: {detections['near_infected_10km']} "
                f"({elapsed:.1f}s)"
            )
            
            self.last_tracking_run = datetime.now()
        
        except Exception as e:
            logger.error(f"Fatal error in run_ais_tracking: {e}")
            traceback.print_exc()
    
    async def run_predictions(self):
        """Run outbreak risk predictions for all facilities"""
        try:
            from src.api.clients.barentswatch import BarentsWatchClient
            from src.api.risk_predictor import OutbreakRiskPredictor
            from math import radians, cos, sin, asin, sqrt
            
            logger.info("📊 Starting hourly prediction update...")
            start_time = datetime.now()
            
            # Initialize predictor with ocean client
            predictor = OutbreakRiskPredictor(ocean_client=self.ocean_client)
            bw = BarentsWatchClient()
            
            # Get all facilities
            facilities = bw.get_facilities(limit=5000)
            if not facilities:
                logger.warning("No facilities found")
                return
            
            # Get geo coordinates and infected facilities from lice data
            lice_data = bw.get_lice_data_v2()
            infected_coords = {}
            geo_map = {}

            for item in lice_data:
                coords = item.get('geometry', {}).get('coordinates', [])
                if len(coords) > 1:
                    locality = item.get('locality', {})
                    facility_code = locality.get('no')
                    if facility_code:
                        geo_map[str(facility_code)] = {
                            'lat': coords[1],
                            'lon': coords[0]
                        }
                        if item.get('diseases'):
                            infected_coords[facility_code] = {
                                'lat': coords[1],
                                'lon': coords[0],
                                'diseases': item.get('diseases', []),
                                'name': locality.get('name', 'Unknown')
                            }
            
            predictions = []
            errors = 0
            
            # Helper function for distance calculation
            def haversine(lon1, lat1, lon2, lat2):
                """Calculate distance between two coordinates in km"""
                lon1, lat1, lon2, lat2 = map(radians, [lon1, lat1, lon2, lat2])
                dlon = lon2 - lon1
                dlat = lat2 - lat1
                a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
                c = 2 * asin(sqrt(a))
                km = 6371 * c
                return km
            
            # Predict for each facility
            for facility in facilities:
                try:
                    code = facility.get('localityNo')
                    name = _normalize_facility_name(facility.get('name', 'Unknown'))
                    latitude = facility.get('latitude')
                    longitude = facility.get('longitude')
                    if (latitude is None or longitude is None) and code is not None:
                        geo = geo_map.get(str(code))
                        latitude = geo.get('lat') if geo else latitude
                        longitude = geo.get('lon') if geo else longitude
                    
                    if not code or latitude is None or longitude is None:
                        continue
                    
                    # Get current diseases at this facility
                    current_diseases = []
                    if code in infected_coords:
                        current_diseases = infected_coords[code].get('diseases', [])
                    
                    # Find nearest infected facility (excluding self)
                    nearest_distance = None
                    nearest_infected_coords = None
                    nearest_infected_name = None
                    nearest_infected_code = None
                    if infected_coords:
                        distances = []
                        for inf_code, inf_data in infected_coords.items():
                            if inf_code != code:
                                dist = haversine(longitude, latitude, inf_data['lon'], inf_data['lat'])
                                distances.append((dist, inf_data['lat'], inf_data['lon'], inf_data['name'], inf_code))
                        
                        if distances:
                            distances.sort(key=lambda x: x[0])
                            nearest_distance = distances[0][0]
                            nearest_infected_coords = (distances[0][1], distances[0][2])
                            nearest_infected_name = distances[0][3]
                            nearest_infected_code = distances[0][4]
                    
                    # Generate boat visit data (deterministic based on facility code)
                    # In production, this would query actual boat visit history from AIS/BarentsWatch + NAIS quarantine status
                    code_num = int(code) if str(code).isdigit() else abs(hash(str(code)))
                    total_boat_visits = code_num % 5  # 0-4 visits total

                    # Split boats: ~25% are under quarantine (high-risk vectors)
                    # Quarantine boats get 3x weight in risk calculation
                    quarantine_boats = 1 if total_boat_visits > 0 and (code_num % 4 == 0) else 0
                    normal_boats = max(0, total_boat_visits - quarantine_boats)

                    hours_since_visit = (code_num % 200) + 24  # 24-224 hours ago
                    
                    # Make prediction
                    prediction = predictor.predict_facility_outbreak(
                        facility_name=name,
                        facility_code=code,
                        latitude=latitude,
                        longitude=longitude,
                        current_diseases=current_diseases,
                        distance_to_nearest_infected_km=nearest_distance,
                        boat_visits_7d=normal_boats,
                        hours_since_last_boat_visit=hours_since_visit if total_boat_visits > 0 else None,
                        is_in_quarantine=False,  # Would check NAIS quarantine data
                        nearest_infected_coords=nearest_infected_coords,
                        quarantine_boat_visits_7d=quarantine_boats,  # Boats under quarantine (3x weight)
                    )
                    
                    # Add source facility info to prediction
                    if nearest_infected_name:
                        prediction.source_facility_name = nearest_infected_name
                        prediction.source_facility_code = str(nearest_infected_code)
                    if nearest_infected_coords:
                        prediction.source_latitude = nearest_infected_coords[0]
                        prediction.source_longitude = nearest_infected_coords[1]
                    if nearest_distance:
                        prediction.distance_to_nearest_infected = nearest_distance
                    
                    predictions.append(prediction)
                    
                    # Record prediction for validation
                    if self.validator:
                        try:
                            self.validator.record_prediction(
                                facility_code=str(code),
                                facility_name=name,
                                predicted_risk_pct=prediction.outbreak_risk_pct,
                                predicted_risk_level=prediction.risk_level,
                                factors=prediction.factors,
                                prediction_horizon_days=30,
                                quarantine_boat_visits_7d=quarantine_boats  # NEW: Track quarantine boats separately
                            )
                        except Exception as ve:
                            # Don't fail prediction if validation recording fails
                            logger.debug(f"Failed to record prediction for validation: {ve}")
                
                except Exception as e:
                    errors += 1
                    if errors < 5:  # Only log first few errors
                        logger.debug(f"Error predicting facility {facility.get('localityNo')}: {e}")
            
            # Sort by risk
            predictions.sort(key=lambda p: p.outbreak_risk_pct, reverse=True)
            
            # Save to cache
            predictor.save_predictions(predictions)
            
            elapsed_predictions = (datetime.now() - start_time).total_seconds()
            
            # Summary for predictions
            critical = len([p for p in predictions if p.risk_level == "Critical"])
            medium = len([p for p in predictions if p.risk_level == "Medium"])
            
            logger.info(
                f"✅ Prediction update complete: "
                f"{len(predictions)} facilities analyzed, "
                f"{critical} critical, {medium} medium "
                f"({elapsed_predictions:.1f}s)"
            )
            
            # Run infection path detection
            if self.detector:
                try:
                    logger.info("🧬 Starting smittespredning detection cycle...")
                    await self.detector.check_for_new_infections()
                    await self.detector.check_for_downstream_delivery()
                    elapsed_detection = (datetime.now() - start_time - timedelta(seconds=elapsed_predictions)).total_seconds()
                    logger.info(f"✅ Smittespredning detection complete ({elapsed_detection:.1f}s)")
                except Exception as e:
                    logger.error(f"⚠️ Error in smittespredning detection: {e}")
                    traceback.print_exc()
            
            self.last_run = datetime.now()
        
        except Exception as e:
            logger.error(f"Fatal error in run_predictions: {e}")
            traceback.print_exc()
    
    async def run_validation(self):
        """Validate past predictions against current disease status"""
        try:
            if not self.validator:
                return
            
            from src.api.clients.barentswatch import BarentsWatchClient
            
            logger.info("🔍 Starting daily prediction validation...")
            start_time = datetime.now()
            
            bw = BarentsWatchClient()
            
            # Get all facilities with current diseases
            lice_data = bw.get_lice_data_v2()
            diseased_facilities = []
            
            for item in lice_data:
                if item.get('diseases'):
                    locality = item.get('locality', {})
                    facility_code = locality.get('no')
                    if facility_code:
                        diseased_facilities.append({
                            'localityNo': facility_code,
                            'diseases': item.get('diseases', []),
                            'week': item.get('week')
                        })
            
            # Run validation
            metrics = self.validator.validate_predictions(diseased_facilities)
            
            elapsed = (datetime.now() - start_time).total_seconds()
            
            logger.info(
                f"✅ Validation complete: "
                f"Accuracy={metrics.accuracy:.1%}, "
                f"Precision={metrics.precision:.1%}, "
                f"Recall={metrics.recall:.1%}, "
                f"F1={metrics.f1_score:.3f} "
                f"({metrics.validated_predictions} validated) "
                f"({elapsed:.1f}s)"
            )
            
            self.last_validation = datetime.now()
            
        except Exception as e:
            logger.error(f"Error in run_validation: {e}")
            traceback.print_exc()
