/**
 * AIS Poller - Real vessel traffic data from BarentsWatch API
 * Phase 1: Mock data (fallback)
 * Phase 2: Real BarentsWatch API integration (ACTIVE)
 */

const logger = require('./datalogger');
const barentswatch = require('./utils/barentswatch');

// Mock vessel database with coordinates (fallback if API fails)
const MOCK_VESSELS = [
  {
    mmsi: '257248680',
    name: 'Viking Supply Ship 4',
    homePort: 'Tromsø',
    position: { lat: 69.5, lon: 19.1 }
  },
  {
    mmsi: '258109550',
    name: 'Havyard Song',
    homePort: 'Tromsø',
    position: { lat: 68.8, lon: 18.5 }
  },
  {
    mmsi: '256833000',
    name: 'Sealog Mariner',
    homePort: 'Bergen',
    position: { lat: 60.5, lon: 5.2 }
  },
  {
    mmsi: '259876543',
    name: 'Northern Falcon',
    homePort: 'Trondheim',
    position: { lat: 63.5, lon: 10.8 }
  }
];

// Mock facility coordinates (from AdminMVP)
const MOCK_FACILITIES = [
  {
    id: 'farm_1',
    name: 'Laksegården Nord',
    region: 'Troms & Finnmark',
    lat: 69.3,
    lon: 18.9
  },
  {
    id: 'farm_2',
    name: 'Fjord Aqua AS',
    region: 'Troms & Finnmark',
    lat: 69.1,
    lon: 19.2
  },
  {
    id: 'farm_3',
    name: 'Bergenser Laks',
    region: 'Hordaland',
    lat: 60.3,
    lon: 5.1
  },
  {
    id: 'farm_4',
    name: 'Trøndelag Fisk',
    region: 'Nord-Trøndelag',
    lat: 63.7,
    lon: 10.9
  }
];

/**
 * Calculate distance between two coordinates in km
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Simulate vessel movement (random drift within region) - for mock data only
 */
function updateVesselPosition(vessel) {
  // Add small random drift (±0.05 degrees ≈ ±5km)
  const drift = 0.02;
  vessel.position.lat += (Math.random() - 0.5) * drift;
  vessel.position.lon += (Math.random() - 0.5) * drift;
  return vessel;
}

/**
 * Legacy: Check if vessel is near facility (deprecated - use BarentsWatch functions)
 */
function checkVesselNearbyFacility(vessel, facility) {
  const distance = calculateDistance(
    vessel.position.lat,
    vessel.position.lon,
    facility.lat,
    facility.lon
  );

  if (distance < 15) { // Within 15km
    (async () => {
      try {
        await logger.logVesselPosition({
          mmsi: vessel.mmsi,
          vessel_name: vessel.name,
          lat: vessel.position.lat,
          lon: vessel.position.lon,
          nearest_facility: facility.id,
          distance_km: Math.round(distance * 10) / 10, // 1 decimal place
          heading: Math.floor(Math.random() * 360),
          speed_knots: Math.floor(Math.random() * 12) + 2 // 2-14 knots
        });
      } catch (err) {
        console.error('[AIS] Error logging vessel position:', err.message);
      }
    })();

    console.log(`[AIS] ${vessel.name} (${vessel.mmsi}) is ${distance.toFixed(1)}km from ${facility.name}`);
  }
}

/**
 * Poll vessel traffic from BarentsWatch API with fallback to mock data
 */
async function pollAISData() {
  console.log(`[AIS] Polling BarentsWatch at ${new Date().toISOString()}`);

  try {
    // Try to fetch real vessel data from BarentsWatch
    const vesselData = await barentswatch.getVesselPositions();
    
    if (vesselData && vesselData.length > 0) {
      console.log(`[AIS] ✓ Got ${vesselData.length} real vessels from BarentsWatch`);
      
      // Check each vessel against each facility
      MOCK_FACILITIES.forEach(facility => {
        const nearbyVessels = barentswatch.getVesselsNearFacility(vesselData, facility, 15); // 15km radius
        
        nearbyVessels.forEach(vessel => {
          (async () => {
            try {
              await logger.logVesselPosition({
                mmsi: vessel.mmsi || vessel.id,
                vessel_name: vessel.name,
                lat: vessel.lat,
                lon: vessel.lng,
                nearest_facility: facility.id,
                distance_km: vessel.distanceKm,
                heading: vessel.heading || 0,
                speed_knots: vessel.speed || 0
              });
              console.log(`[AIS] ${vessel.name} is ${vessel.distanceKm.toFixed(1)}km from ${facility.name}`);
            } catch (err) {
              console.error('[AIS] Error logging vessel:', err.message);
            }
          })();
        });
      });
    } else {
      console.log('[AIS] ⚠️  No real vessels from BarentsWatch, using mock data fallback');
      
      // Fallback: Use mock vessels
      MOCK_VESSELS.forEach(vessel => {
        // Simulate movement
        vessel.position.lat += (Math.random() - 0.5) * 0.02;
        vessel.position.lon += (Math.random() - 0.5) * 0.02;
        
        // Check distance
        MOCK_FACILITIES.forEach(facility => {
          const distance = calculateDistance(
            vessel.position.lat, vessel.position.lon,
            facility.lat, facility.lon
          );
          
          if (distance < 15) {
            (async () => {
              try {
                await logger.logVesselPosition({
                  mmsi: vessel.mmsi,
                  vessel_name: vessel.name,
                  lat: vessel.position.lat,
                  lon: vessel.position.lon,
                  nearest_facility: facility.id,
                  distance_km: Math.round(distance * 10) / 10,
                  heading: Math.floor(Math.random() * 360),
                  speed_knots: Math.floor(Math.random() * 12) + 2
                });
              } catch (err) {
                console.error('[AIS] Error logging mock vessel:', err.message);
              }
            })();
          }
        });
      });
    }
  } catch (err) {
    console.error('[AIS] Polling error:', err.message);
    console.log('[AIS] Falling back to mock data...');
    
    // Ultimate fallback: mock data
    MOCK_VESSELS.forEach(vessel => {
      vessel.position.lat += (Math.random() - 0.5) * 0.02;
      vessel.position.lon += (Math.random() - 0.5) * 0.02;
    });
  }
}

/**
 * Occasionally log test alerts for demonstration
 */
async function logTestAlert() {
  const diseases = ['Sea Lice', 'Fish Allergy Syndrome', 'IPN'];
  const severities = ['risikofylt', 'høy oppmerksomhet', 'moderat'];
  const randomDisease = diseases[Math.floor(Math.random() * diseases.length)];
  const randomSeverity = severities[Math.floor(Math.random() * severities.length)];
  const randomFacility = MOCK_FACILITIES[Math.floor(Math.random() * MOCK_FACILITIES.length)];
  const randomVessel = MOCK_VESSELS[Math.floor(Math.random() * MOCK_VESSELS.length)];

  // Only log occasionally (10% chance)
  if (Math.random() > 0.9) {
    try {
      await logger.logAlert({
        facility_id: randomFacility.id,
        disease_type: randomDisease,
        severity: randomSeverity,
        region: randomFacility.region,
        title: `${randomDisease} alert at ${randomFacility.name}`,
        risk_score: Math.floor(Math.random() * 60) + 40,
        vessel_traffic_nearby: [{
          mmsi: randomVessel.mmsi,
          name: randomVessel.name
        }],
        environmental_data: {
          water_temp: 12 + Math.random() * 2,
          salinity: 34 + Math.random() * 2,
          oxygen: 8 + Math.random() * 2
        }
      });

      console.log(`[Alert] Test alert logged for ${randomFacility.name} - ${randomDisease}`);
    } catch (err) {
      console.error('[AIS] Error logging test alert:', err.message);
    }
  }
}

/**
 * Start background polling with BarentsWatch data
 * 
 * For MVP: Daily logging saves CPU/memory while building training data
 * For production: Can increase to 5 minutes or hourly for real-time tracking
 */
function startAISPolling(intervalMinutes = 1440) {
  // Default: 1440 minutes = 24 hours (once per day) for MVP
  // Production Phase 2: Set to 5 (every 5 minutes) for real-time vessel tracking
  // Test mode: Set to 1 (every minute) for quick testing
  
  console.log(`[AIS] Starting BarentsWatch AIS polling every ${intervalMinutes} minute(s)`);
  console.log(`[AIS] Source: BarentsWatch API (with mock data fallback)`);

  // Poll immediately
  (async () => {
    await pollAISData();
    await logTestAlert();
  })();

  // Then poll at interval
  setInterval(() => {
    (async () => {
      try {
        await pollAISData();
        await logTestAlert();
      } catch (err) {
        console.error('[AIS Poller Error]', err);
      }
    })();
  }, intervalMinutes * 60 * 1000);
}

module.exports = {
  startAISPolling,
  pollAISData,
  logTestAlert,
  MOCK_VESSELS,
  MOCK_FACILITIES
};
