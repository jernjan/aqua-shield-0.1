"""
Data Sync Scheduler - Daily data fetching and risk calculation

Periodically fetches data from all APIs and updates database.
Runs risk calculations on all facilities.
"""

import logging
import asyncio
from datetime import datetime, timedelta
from typing import List, Dict

from src.api_clients.barentswatch import BarentsWatchClient
from src.api_clients.ais import AISClient
from src.api_clients.weather import WeatherClient
from src.database.connection import SessionLocal
from src.database.models import (
    Facility,
    HealthStatus,
    Vessel,
    VesselVisit,
    WeatherData,
    RiskAssessment,
    Alert,
)
from src.risk_engine.calculator import RiskCalculator
from src.risk_engine.proximity import VesselProximityDetector

logger = logging.getLogger(__name__)


class DataSyncScheduler:
    """Manages periodic data synchronization and risk calculations."""

    def __init__(self):
        """Initialize scheduler with API clients."""
        self.barentswatch = BarentsWatchClient()
        self.ais = AISClient()
        self.weather = WeatherClient()
        self.risk_calculator = RiskCalculator()
        self.proximity_detector = VesselProximityDetector()
        self.logger = logger

    def sync_facilities(self) -> int:
        """
        Sync all aquaculture facilities from BarentsWatch.

        Returns:
            Number of facilities synced
        """
        try:
            self.logger.info("Starting facility sync...")
            facilities = self.barentswatch.get_facilities()

            session = SessionLocal()
            synced = 0

            for facility_data in facilities:
                try:
                    # Map API field names to database field names
                    locality_no = facility_data.get("localityNo")
                    if not locality_no:
                        continue
                    
                    # Check if facility already exists
                    existing = session.query(Facility).filter_by(
                        locality_no=locality_no
                    ).first()

                    if existing:
                        # Update existing
                        existing.name = facility_data.get("name")
                        existing.municipality = facility_data.get("municipality")
                        existing.municipality_no = facility_data.get("municipalityNo")
                    else:
                        # Create new
                        facility = Facility(
                            locality_no=locality_no,
                            name=facility_data.get("name"),
                            municipality=facility_data.get("municipality"),
                            municipality_no=facility_data.get("municipalityNo"),
                            # API doesn't provide lat/long/species - will be null
                            latitude=None,
                            longitude=None,
                            species=None,
                        )
                        session.add(facility)

                    synced += 1

                except Exception as e:
                    self.logger.error(f"Error syncing facility: {e}")
                    continue

            session.commit()
            session.close()
            self.logger.info(f"Facility sync complete: {synced} facilities synced")
            return synced

        except Exception as e:
            self.logger.error(f"Facility sync failed: {e}")
            return 0

    def sync_health_status(self) -> int:
        """
        Sync health status (lice/disease) data for current week.

        Returns:
            Number of health records synced
        """
        try:
            self.logger.info("Starting health status sync...")
            session = SessionLocal()

            # Get current year and week
            now = datetime.utcnow()
            year = now.year
            week = now.isocalendar()[1]

            # Fetch health data
            health_data = self.barentswatch.get_nais_status(year, week)

            synced = 0
            for record in health_data:
                try:
                    facility_id = record.get("locality_no")
                    facility = session.query(Facility).filter_by(
                        locality_no=facility_id
                    ).first()

                    if not facility:
                        continue

                    # Check if health record already exists
                    existing = session.query(HealthStatus).filter_by(
                        facility_id=facility.id,
                        year=year,
                        week=week,
                    ).first()

                    if existing:
                        existing.salmon_lice_count = record.get("lice_count", 0)
                        existing.pd_status = record.get("pd_status")
                        existing.isa_status = record.get("isa_status")
                        existing.lice_treatment_applied = record.get(
                            "treatment_applied", False
                        )
                    else:
                        health = HealthStatus(
                            facility_id=facility.id,
                            year=year,
                            week=week,
                            salmon_lice_count=record.get("lice_count", 0),
                            pd_status=record.get("pd_status"),
                            isa_status=record.get("isa_status"),
                            lice_treatment_applied=record.get("treatment_applied", False),
                            reported_date=datetime.fromisoformat(
                                record.get("report_date", now.isoformat())
                            ),
                        )
                        session.add(health)

                    synced += 1

                except Exception as e:
                    self.logger.error(f"Error syncing health status: {e}")
                    continue

            session.commit()
            session.close()
            self.logger.info(f"Health status sync complete: {synced} records synced")
            return synced

        except Exception as e:
            self.logger.error(f"Health status sync failed: {e}")
            return 0

    def sync_vessel_positions(self) -> int:
        """
        Sync vessel positions from AIS.

        Returns:
            Number of vessels synced
        """
        try:
            self.logger.info("Starting vessel position sync...")
            session = SessionLocal()

            # For now, return 0 since AIS endpoint returns 401
            # In production, this would fetch vessel positions
            self.logger.warning("AIS endpoint currently returning 401 - skipping vessel sync")

            session.close()
            return 0

        except Exception as e:
            self.logger.error(f"Vessel position sync failed: {e}")
            return 0

    def sync_weather_data(self) -> int:
        """
        Sync weather data for all facilities.

        Returns:
            Number of weather records synced
        """
        try:
            self.logger.info("Starting weather data sync...")
            session = SessionLocal()

            facilities = session.query(Facility).all()
            synced = 0

            for facility in facilities:
                try:
                    # Fetch weather for this facility
                    weather = self.weather.get_forecast(
                        facility.latitude, facility.longitude
                    )

                    if weather:
                        # Save weather data
                        weather_record = WeatherData(
                            facility_id=facility.id,
                            temperature=weather.get("temperature"),
                            wind_speed=weather.get("wind_speed"),
                            precipitation=weather.get("precipitation"),
                            forecast_time=datetime.fromisoformat(
                                weather.get("forecast_time", datetime.utcnow().isoformat())
                            ),
                        )
                        session.add(weather_record)
                        synced += 1

                except Exception as e:
                    self.logger.error(f"Error syncing weather for facility {facility.id}: {e}")
                    continue

            session.commit()
            session.close()
            self.logger.info(f"Weather data sync complete: {synced} records synced")
            return synced

        except Exception as e:
            self.logger.error(f"Weather data sync failed: {e}")
            return 0

    def calculate_all_risks(self) -> Dict:
        """
        Calculate risk for all facilities.

        Returns:
            Dictionary with risk calculation results
        """
        try:
            self.logger.info("Starting risk calculations...")
            session = SessionLocal()

            facilities = session.query(Facility).all()
            results = {
                "total": 0,
                "red": 0,
                "yellow": 0,
                "green": 0,
                "errors": 0,
            }

            for facility in facilities:
                try:
                    # Get latest health status
                    health = (
                        session.query(HealthStatus)
                        .filter_by(facility_id=facility.id)
                        .order_by(HealthStatus.reported_date.desc())
                        .first()
                    )

                    # Get latest weather
                    weather = (
                        session.query(WeatherData)
                        .filter_by(facility_id=facility.id)
                        .order_by(WeatherData.forecast_time.desc())
                        .first()
                    )

                    # Get recent vessel visits (14 days)
                    cutoff_date = datetime.utcnow() - timedelta(days=14)
                    visits = (
                        session.query(VesselVisit)
                        .filter(
                            VesselVisit.facility_id == facility.id,
                            VesselVisit.visit_date >= cutoff_date,
                        )
                        .all()
                    )

                    # Prepare data for risk calculation
                    lice_count = health.salmon_lice_count if health else 0
                    temperature = weather.temperature if weather else 10.0

                    # Calculate risk
                    risk = self.risk_calculator.calculate_facility_risk(
                        facility_id=str(facility.id),
                        facility_name=facility.name,
                        current_lice_count=lice_count,
                        current_temperature=temperature,
                        vessel_visits_recent=[
                            {
                                "visit_date": v.visit_date,
                                "source_has_lice": v.source_facility.lice_count > 0
                                if v.source_facility
                                else False,
                            }
                            for v in visits
                        ],
                        downstream_facilities=[],  # TODO: Calculate downstream based on currents
                        wild_fish_risk_factor=0.5,  # TODO: Get from facility data
                    )

                    # Save risk assessment
                    risk_record = RiskAssessment(
                        facility_id=facility.id,
                        total_risk_score=risk["total_score"],
                        risk_level=risk["alert_level"],
                        ocean_current_risk=risk["factors"]["ocean_current"]["score"],
                        vessel_movement_risk=risk["factors"]["vessel_movement"]["score"],
                        genetic_disease_risk=risk["factors"]["genetic_disease"]["score"],
                        temperature_risk=risk["factors"]["temperature"]["score"],
                        assessment_date=datetime.utcnow(),
                    )
                    session.add(risk_record)

                    # Track results
                    results["total"] += 1
                    if risk["alert_level"] == "RED":
                        results["red"] += 1
                    elif risk["alert_level"] == "YELLOW":
                        results["yellow"] += 1
                    else:
                        results["green"] += 1

                except Exception as e:
                    self.logger.error(f"Error calculating risk for facility {facility.id}: {e}")
                    results["errors"] += 1
                    continue

            session.commit()
            session.close()

            self.logger.info(
                f"Risk calculations complete: {results['total']} facilities, "
                f"{results['red']} RED, {results['yellow']} YELLOW, {results['green']} GREEN"
            )
            return results

        except Exception as e:
            self.logger.error(f"Risk calculation failed: {e}")
            return {"error": str(e)}

    def detect_proximity_threats(self) -> int:
        """
        Detect vessels in proximity of infected facilities.

        Returns:
            Number of threats detected
        """
        try:
            self.logger.info("Starting proximity threat detection...")
            session = SessionLocal()

            # Get all vessels
            vessels = session.query(Vessel).all()
            facilities = session.query(Facility).all()

            # Get latest vessel positions (this would normally come from AIS)
            vessel_list = [
                {
                    "vessel_id": v.id,
                    "vessel_name": v.name,
                    "latitude": v.latitude,
                    "longitude": v.longitude,
                }
                for v in vessels
            ]

            # Get facility data with latest lice counts
            facility_list = []
            for facility in facilities:
                health = (
                    session.query(HealthStatus)
                    .filter_by(facility_id=facility.id)
                    .order_by(HealthStatus.reported_date.desc())
                    .first()
                )
                facility_list.append(
                    {
                        "facility_id": facility.id,
                        "facility_name": facility.name,
                        "latitude": facility.latitude,
                        "longitude": facility.longitude,
                        "current_lice_count": health.salmon_lice_count if health else 0,
                    }
                )

            # Detect threats
            threats = self.proximity_detector.detect_proximity_threats(
                vessel_list, facility_list
            )

            # Create alerts for detected threats
            for threat in threats:
                alert = Alert(
                    facility_id=threat["facility_id"],
                    alert_type="vessel_proximity",
                    severity=threat["threat_level"],
                    message=threat["alert_message"],
                    alert_date=datetime.utcnow(),
                    acknowledged=False,
                )
                session.add(alert)

            session.commit()
            session.close()

            self.logger.info(f"Proximity detection complete: {len(threats)} threats detected")
            return len(threats)

        except Exception as e:
            self.logger.error(f"Proximity detection failed: {e}")
            return 0

    async def run_daily_sync(self):
        """
        Run all daily synchronization tasks.

        This should be called once per day.
        """
        try:
            self.logger.info("=" * 60)
            self.logger.info("Starting daily synchronization cycle")
            self.logger.info("=" * 60)

            # 1. Sync facilities
            self.sync_facilities()

            # 2. Sync health status
            self.sync_health_status()

            # 3. Sync vessel positions
            self.sync_vessel_positions()

            # 4. Sync weather
            self.sync_weather_data()

            # 5. Calculate risks
            risk_results = self.calculate_all_risks()

            # 6. Detect proximity threats
            self.detect_proximity_threats()

            self.logger.info("=" * 60)
            self.logger.info("Daily synchronization cycle complete")
            self.logger.info("=" * 60)

        except Exception as e:
            self.logger.error(f"Daily sync cycle failed: {e}")
            raise


if __name__ == "__main__":
    # Test the scheduler
    logging.basicConfig(level=logging.INFO)
    scheduler = DataSyncScheduler()

    # Run sync once
    import asyncio

    asyncio.run(scheduler.run_daily_sync())
