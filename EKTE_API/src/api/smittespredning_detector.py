#!/usr/bin/env python3
"""
Automatic Smittespredning Detection Service
============================================

Monitors facility health status changes and vessel movements.
When a vessel is detected at a facility with confirmed disease,
automatically logs a smittespredning event.

Triggered by:
1. Scheduled job (every 15 minutes) - check facility disease status
2. Manual confirmation - when operator confirms a facility has disease

Integration: Called from PredictionScheduler.run_predictions()
"""

import asyncio
import sqlite3
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Optional
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class SmittespredningDetector:
    """
    Detects and logs infection path events automatically
    """
    
    def __init__(self, api_client):
        """
        Initialize detector with API access
        
        Args:
            api_client: BarentsWatch client for facility/disease data
        """
        self.api = api_client
        self.db_path = "EKTE_API/src/api/data/exposure_events.db"
        self.last_check = {}  # Track when we last checked each facility
        
    async def check_for_new_infections(self):
        """
        Periodic check: Look for facilities that have disease status
        and vessels that have visited them recently
        """
        logger.info("[SMITTE-DETECT] Running infection detection cycle...")
        
        try:
            from math import radians, cos, sin, asin, sqrt
            
            # Get all vessels and facilities
            all_vessels = self.api.get_ais_vessels(limit=10000)
            all_facilities = self.api.get_facilities(limit=3000)
            
            # Get disease zones from BarentsWatch
            ila_zones = self.api.get_ila_zones()
            pd_zones = self.api.get_pd_zones()
            lice_data = self.api.get_lice_data_v2()
            
            # Build infected facility map from lice data
            infected_facilities = {}
            for item in lice_data:
                locality = item.get('locality', {})
                facility_id = locality.get('no')
                if facility_id and item.get('diseases'):
                    diseases = item.get('diseases', [])
                    disease_type = None
                    if any('Pancr' in d or 'PD' in d for d in diseases):
                        disease_type = 'PD'
                    elif any('Infeksiøs' in d or 'ILA' in d for d in diseases):
                        disease_type = 'ILA'
                    
                    if disease_type:
                        infected_facilities[facility_id] = {
                            'name': locality.get('name', 'Unknown'),
                            'disease': disease_type,
                            'coordinates': (
                                item.get('geometry', {}).get('coordinates', [None, None])[1],
                                item.get('geometry', {}).get('coordinates', [None, None])[0]
                            )
                        }
            
            if not infected_facilities:
                logger.debug("[SMITTE-DETECT] No infected facilities found")
                return
            
            logger.info(f"[SMITTE-DETECT] Found {len(infected_facilities)} infected facilities")
            
            # Helper for distance calculation
            def haversine(lon1, lat1, lon2, lat2):
                """Calculate distance in km"""
                if not all([lon1, lat1, lon2, lat2]):
                    return None
                try:
                    lon1, lat1, lon2, lat2 = map(radians, [lon1, lat1, lon2, lat2])
                    dlon = lon2 - lon1
                    dlat = lat2 - lat1
                    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
                    c = 2 * asin(sqrt(a))
                    return 6371 * c
                except:
                    return None
            
            # Check each vessel against infected facilities
            new_events = 0
            for vessel in all_vessels:
                mmsi = vessel.get('mmsi')
                vessel_name = vessel.get('name', 'Unknown')
                if not (mmsi and vessel.get('latitude') and vessel.get('longitude')):
                    continue
                
                # Check proximity to infected facilities
                for facility_id, facility_data in infected_facilities.items():
                    lat, lon = facility_data.get('coordinates', (None, None))
                    if not (lat and lon):
                        continue
                    
                    distance = haversine(
                        vessel.get('longitude'), vessel.get('latitude'),
                        lon, lat
                    )
                    
                    # Alert if vessel is within 5km of infected facility
                    if distance and distance <= 5:
                        # Check if already logged
                        existing = self._find_existing_event(facility_id, mmsi)
                        if not existing:
                            logger.info(
                                f"[SMITTE-DETECT] NEW: {vessel_name} ({mmsi}) "
                                f"at {facility_data.get('name')} ({facility_data.get('disease')}) "
                                f"- {distance:.1f}km away"
                            )
                            
                            self._log_smittespredning_event(
                                vessel_mmsi=mmsi,
                                vessel_name=vessel_name,
                                facility_start_id=facility_id,
                                facility_start_disease=facility_data.get('disease'),
                                facility_start_name=facility_data.get('name'),
                                detected_via='AIS_PROXIMITY',
                                distance_km=distance,
                                notes=f'Auto-detected via AIS proximity ({distance:.1f}km from facility)'
                            )
                            new_events += 1
            
            if new_events > 0:
                logger.info(f"[SMITTE-DETECT] Logged {new_events} new infection paths")
            else:
                logger.debug("[SMITTE-DETECT] No new infections detected")
                    
        except Exception as e:
            logger.error(f"[SMITTE-DETECT] Error in detection cycle: {e}")
            import traceback
            traceback.print_exc()
    
    async def check_for_downstream_delivery(self):
        """
        Periodic check: Look for vessels that left infected facility 
        and have arrived at other facilities within 48 hours
        """
        logger.info("[SMITTE-DELIVER] Checking for downstream deliveries...")
        
        try:
            from math import radians, cos, sin, asin, sqrt
            from src.api.database import get_smittespredning_events
            
            # Get all DETECTED events without a destination
            all_events = get_smittespredning_events(limit=100)
            open_events = [e for e in all_events 
                          if e.get('path_risk_status') == 'DETECTED' 
                          and not e.get('facility_end_id')]
            
            if not open_events:
                logger.debug("[SMITTE-DELIVER] No open events to check")
                return
            
            # Get current vessel positions
            all_vessels = self.api.get_ais_vessels(limit=10000)
            all_facilities = self.api.get_facilities(limit=3000)
            
            # Build facility coordinates map
            facility_coords = {}
            for facility in all_facilities:
                fid = facility.get('localityNo')
                if fid and facility.get('latitude') and facility.get('longitude'):
                    facility_coords[fid] = (facility.get('latitude'), facility.get('longitude'))
            
            def haversine(lon1, lat1, lon2, lat2):
                """Calculate distance in km"""
                if not all([lon1, lat1, lon2, lat2]):
                    return None
                try:
                    lon1, lat1, lon2, lat2 = map(radians, [lon1, lat1, lon2, lat2])
                    dlon = lon2 - lon1
                    dlat = lat2 - lat1
                    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
                    c = 2 * asin(sqrt(a))
                    return 6371 * c
                except:
                    return None
            
            # Check each open event
            updated_count = 0
            for event in open_events:
                event_id = event.get('event_id')
                mmsi = event.get('vessel_mmsi')
                timestamp_start = event.get('timestamp_start')
                
                # Parse timestamp and check age
                try:
                    start_time = datetime.fromisoformat(str(timestamp_start).replace("Z", "+00:00"))
                    if start_time.tzinfo is None:
                        start_time = start_time.replace(tzinfo=timezone.utc)
                    else:
                        start_time = start_time.astimezone(timezone.utc)

                    now = datetime.now(timezone.utc)
                    elapsed = now - start_time
                    
                    if elapsed > timedelta(hours=48):
                        logger.debug(f"[SMITTE-DELIVER] Event {event_id} older than 48h, skipping")
                        continue
                except:
                    continue
                
                # Find this vessel in current AIS data
                vessel = None
                for v in all_vessels:
                    if v.get('mmsi') == mmsi:
                        vessel = v
                        break
                
                if not (vessel and vessel.get('latitude') and vessel.get('longitude')):
                    continue
                
                # Check proximity to facilities
                for facility_id, (lat, lon) in facility_coords.items():
                    if facility_id == event.get('facility_start_id'):
                        continue  # Skip origin facility
                    
                    distance = haversine(
                        vessel.get('longitude'), vessel.get('latitude'),
                        lon, lat
                    )
                    
                    # If vessel is within 10km of this facility, update event
                    if distance and distance <= 10:
                        logger.info(
                            f"[SMITTE-DELIVER] Event {event_id}: Vessel {mmsi} "
                            f"arrived at {facility_id} ({distance:.1f}km)"
                        )
                        
                        self._update_smittespredning_destination(
                            event_id=event_id,
                            facility_end_id=facility_id,
                            distance_km=distance,
                            timestamp_end=now.isoformat()
                        )
                        updated_count += 1
                        break  # Only one destination per event
            
            if updated_count > 0:
                logger.info(f"[SMITTE-DELIVER] Updated {updated_count} downstream deliveries")
            else:
                logger.debug("[SMITTE-DELIVER] No downstream deliveries detected")
            
        except Exception as e:
            logger.error(f"[SMITTE-DELIVER] Error checking deliveries: {e}")
            import traceback
            traceback.print_exc()
    

    
    def _find_existing_event(self, facility_id: str, mmsi: str) -> Optional[int]:
        """Check if we already logged this vessel at this facility"""
        try:
            from src.api.database import get_smittespredning_events
            
            all_events = get_smittespredning_events(limit=1000)
            for event in all_events:
                if (event.get('facility_start_id') == facility_id and 
                    str(event.get('vessel_mmsi')) == str(mmsi)):
                    return event.get('event_id')
            return None
        except Exception as e:
            logger.debug(f"[SMITTE-DETECT] Error checking existing event: {e}")
            return None
    
    def _log_smittespredning_event(self, **kwargs):
        """Insert new smittespredning event and create alert"""
        from src.api.database import log_smittespredning_event
        
        try:
            event_id = log_smittespredning_event(**kwargs)
            
            # Create alert message
            vessel_mmsi = kwargs.get('vessel_mmsi')
            vessel_name = kwargs.get('vessel_name', 'Unknown')
            facility_id = kwargs.get('facility_start_id')
            facility_name = kwargs.get('facility_start_name', 'Unknown')
            disease = kwargs.get('facility_start_disease', 'UNKNOWN')
            
            alert_msg = (
                f"🚨 [BIOSECURITY ALERT] NEW INFECTION PATH DETECTED\n"
                f"   Event ID: {event_id}\n"
                f"   Vessel: {vessel_name} (MMSI: {vessel_mmsi})\n"
                f"   Origin: {facility_name} ({facility_id}) - {disease}\n"
                f"   Detection: {kwargs.get('detected_via', 'MANUAL')}\n"
                f"   Time: {datetime.now().isoformat()}\n"
                f"   Status: {kwargs.get('path_risk_status', 'DETECTED')}"
            )
            
            # Log to application logs (visible in API startup)
            logger.warning(alert_msg)
            
            # TODO: Email alert - uncomment when email is configured
            # self._send_email_alert(alert_msg)
            
            logger.info(f"[SMITTE-ALERT] Logged event {event_id}")
            return event_id
        except Exception as e:
            logger.error(f"[SMITTE-ALERT] Failed to log event: {e}")
            return None
    
    def _update_smittespredning_destination(self, **kwargs):
        """Update existing smittespredning event with destination"""
        from src.api.database import update_smittespredning_event
        
        try:
            success = update_smittespredning_event(**kwargs)
            logger.info(f"[SMITTE-DELIVER] Updated event {kwargs.get('event_id')}: {success}")
            return success
        except Exception as e:
            logger.error(f"[SMITTE-DELIVER] Failed to update event: {e}")
            return False


# Integration note: SmittespredningDetector is instantiated and called from
# PredictionScheduler during the hourly prediction cycle.
# 
# Usage in scheduler:
#   detector = SmittespredningDetector(bw_client)
#   await detector.check_for_new_infections()
#   await detector.check_for_downstream_delivery()
