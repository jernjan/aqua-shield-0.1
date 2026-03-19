"""Synchronization endpoints for BarentsWatch data."""
import asyncio
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.db.models import Farm
from app.db.models_vessel import Vessel
from app.core.security import get_current_user
from app.services.barentswatch_service import barentswatch_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/sync", tags=["sync"])


@router.post("/farms-from-barentswatch")
async def sync_farms_from_barentswatch(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Sync farms from BarentsWatch API.
    This endpoint fetches all aquaculture locations from BarentsWatch and stores them in the database.
    """
    try:
        logger.info("Starting BarentsWatch farm synchronization...")
        
        # Get farms from BarentsWatch - fetch all locations
        # BarentsWatch provides aquaculture data via their open API
        token = await barentswatch_service.oauth.get_access_token()
        
        # Fetch aquaculture locations from BarentsWatch
        # Using the aquaculture endpoint which returns all registered farms
        import httpx
        
        async with httpx.AsyncClient() as client:
            headers = {"Authorization": f"Bearer {token}"}
            
            # Fetch fishing facilities (aquaculture sites) from BarentsWatch
            # This returns all Norwegian aquaculture sites as GeoJSON FeatureCollection
            response = await client.get(
                "https://www.barentswatch.no/bwapi/v1/geodata/download/fishingfacility",
                headers=headers,
                params={"format": "json"},  # 'json' returns GeoJSON
                timeout=60  # Longer timeout for large dataset
            )
            response.raise_for_status()
            data = response.json()
        
        # Parse GeoJSON features - BarentsWatch returns FeatureCollection with 4000+ features
        features = data.get("features", []) if isinstance(data, dict) else []
        
        # Extract locations from GeoJSON features
        locations = []
        for feature in features:
            geometry = feature.get("geometry", {})
            properties = feature.get("properties", {})
            
            # Get coordinates based on geometry type
            coords = None
            geom_type = geometry.get("type")
            
            if geom_type == "Point":
                coords = geometry.get("coordinates", [])
            elif geom_type == "LineString":
                # For LineString, use the center/first coordinate
                line_coords = geometry.get("coordinates", [])
                if line_coords:
                    coords = line_coords[0]  # Use first point
            elif geom_type == "Polygon":
                # For Polygon, use the first coordinate
                poly_coords = geometry.get("coordinates", [[]])
                if poly_coords and poly_coords[0]:
                    coords = poly_coords[0][0]
            
            # Create location entry if we have valid coordinates
            if coords and len(coords) >= 2:
                location = {
                    "longitude": float(coords[0]),
                    "latitude": float(coords[1]),
                    "name": properties.get("navn") or properties.get("name") or "Unknown Facility",
                    "locationtype": "aquaculture",
                    **properties  # Include all properties from BarentsWatch
                }
                locations.append(location)
        
        if not locations:
            return {
                "message": "No farms found from BarentsWatch",
                "synced": 0,
                "total_in_api": 0
            }
        
        logger.info(f"Found {len(locations)} farms from BarentsWatch")
        
        synced = 0
        skipped = 0
        
        for location in locations:
            try:
                # Extract farm data from GeoJSON
                farm_name = location.get("name", "Unknown")
                latitude = float(location.get("latitude", 0))
                longitude = float(location.get("longitude", 0))
                
                # Skip invalid coordinates
                if latitude == 0 and longitude == 0:
                    skipped += 1
                    continue
                
                # Check if farm already exists (using name and coordinates)
                existing = db.query(Farm).filter(
                    Farm.latitude == latitude,
                    Farm.longitude == longitude
                ).first()
                
                if existing:
                    skipped += 1
                    continue
                
                # Create new farm
                new_farm = Farm(
                    name=farm_name,
                    latitude=latitude,
                    longitude=longitude,
                    description=f"BarentsWatch aquaculture facility ({location.get('locationtype', 'facility')})",
                    owner_id=1,  # Admin user owns all synced farms
                    is_active=True
                )
                
                db.add(new_farm)
                synced += 1
                
                # Commit in batches for performance
                if synced % 100 == 0:
                    db.commit()
                    logger.info(f"Synced {synced} farms so far...")
            except Exception as e:
                logger.warning(f"Error processing farm {location.get('name', 'Unknown')}: {e}")
                skipped += 1
                continue
        
        # Commit all changes
        db.commit()
        logger.info(f"Synchronization complete: {synced} new farms synced, {skipped} skipped")
        
        return {
            "message": "Farms synchronized from BarentsWatch",
            "synced": synced,
            "skipped": skipped,
            "total_processed": synced + skipped,
            "total_in_database": db.query(Farm).filter(Farm.is_active == True).count()
        }
        
    except Exception as e:
        logger.error(f"BarentsWatch sync failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to sync farms from BarentsWatch: {str(e)}"
        )


@router.post("/clear-demo-farms")
async def clear_demo_farms(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Remove all demo/sample farms and prepare for real BarentsWatch data.
    """
    try:
        count = db.query(Farm).delete()
        db.commit()
        logger.info(f"Deleted {count} demo farms")
        
        return {
            "message": f"Deleted {count} demo farms",
            "deleted": count
        }
    except Exception as e:
        logger.error(f"Failed to clear demo farms: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to clear farms: {str(e)}"
        )


@router.post("/vessels-from-barentswatch")
async def sync_vessels_from_barentswatch(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Sync vessels from BarentsWatch AIS data.
    Fetches real-time AIS (Automatic Identification System) vessel positions from BarentsWatch.
    This includes fishing vessels, supply boats, and other maritime traffic around Norwegian aquaculture.
    """
    try:
        logger.info("Starting BarentsWatch vessel synchronization...")
        
        token = await barentswatch_service.oauth.get_access_token()
        
        import httpx
        
        async with httpx.AsyncClient() as client:
            headers = {"Authorization": f"Bearer {token}"}
            
            # Fetch latest AIS positions from BarentsWatch Live AIS API
            # This returns real vessel data with positions, speed, heading, dimensions, etc.
            response = await client.get(
                "https://live.ais.barentswatch.no/v1/latest/combined",
                headers=headers,
                params={"modelType": "Full", "modelFormat": "Json"},
                timeout=60
            )
            response.raise_for_status()
            data = response.json()
        
        # Extract vessels list from response
        vessels_list = data.get("features", []) if isinstance(data.get("features"), list) else data.get("data", [])
        
        if not vessels_list:
            return {
                "message": "No vessels found from BarentsWatch",
                "synced": 0,
                "total_in_api": 0
            }
        
        logger.info(f"Found {len(vessels_list)} vessel positions from BarentsWatch AIS")
        
        synced = 0
        skipped = 0
        
        for vessel_data in vessels_list:
            try:
                # Handle both direct data and GeoJSON feature format
                if "properties" in vessel_data:
                    props = vessel_data.get("properties", {})
                    geometry = vessel_data.get("geometry", {})
                    coords = geometry.get("coordinates", [0, 0])
                    longitude = float(coords[0])
                    latitude = float(coords[1])
                else:
                    props = vessel_data
                    latitude = float(props.get("latitude", 0))
                    longitude = float(props.get("longitude", 0))
                
                # Extract vessel data from AIS
                mmsi = str(props.get("mmsi", ""))
                vessel_name = props.get("name", props.get("shipname", "Unknown Vessel"))
                speed = float(props.get("speed", 0))
                course = float(props.get("course", 0)) if props.get("course") else None
                vessel_type = props.get("shiptype", "Unknown")
                callsign = props.get("callsign", "")
                
                # Skip if no valid MMSI
                if not mmsi or mmsi == "0":
                    skipped += 1
                    continue
                
                # Check if vessel already exists
                existing = db.query(Vessel).filter(Vessel.mmsi == mmsi).first()
                
                if existing:
                    # Update existing vessel with new position
                    existing.latitude = latitude
                    existing.longitude = longitude
                    existing.speed = speed
                    existing.course = course
                    existing.heading = course
                    existing.status = "active"
                    db.add(existing)
                    skipped += 1
                else:
                    # Create new vessel
                    new_vessel = Vessel(
                        mmsi=mmsi,
                        name=vessel_name,
                        callsign=callsign,
                        vessel_type=vessel_type,
                        latitude=latitude,
                        longitude=longitude,
                        speed=speed,
                        course=course,
                        heading=course,
                        length=float(props.get("length", 0)) or None,
                        width=float(props.get("width", 0)) or None,
                        status="active",
                        source="ais"
                    )
                    db.add(new_vessel)
                    synced += 1
                
                # Commit in batches
                if (synced + skipped) % 100 == 0:
                    db.commit()
                    logger.info(f"Processed {synced + skipped} vessels so far...")
                    
            except Exception as e:
                logger.warning(f"Error processing vessel: {e}")
                skipped += 1
                continue
        
        db.commit()
        logger.info(f"Vessel sync complete: {synced} new vessels synced, {skipped} updated/skipped")
        
        return {
            "message": "Vessels synchronized from BarentsWatch AIS",
            "synced_new": synced,
            "updated": skipped,
            "total_processed": synced + skipped,
            "total_in_database": db.query(Vessel).filter(Vessel.status == "active").count()
        }
        
    except Exception as e:
        logger.error(f"BarentsWatch vessel sync failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to sync vessels from BarentsWatch: {str(e)}"
        )


@router.get("/status")
async def sync_status(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get synchronization status."""
    farm_count = db.query(Farm).filter(Farm.is_active == True).count()
    vessel_count = db.query(Vessel).filter(Vessel.status == "active").count()
    
    return {
        "farms_in_database": farm_count,
        "vessels_in_database": vessel_count,
        "barentswatch_api": "https://www.barentswatch.no/bwapi/v1",
        "last_sync": "Check database creation times",
        "status": "ready" if farm_count > 0 else "no_data"
    }
