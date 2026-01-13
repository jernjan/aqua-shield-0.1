/**
 * Vessel Tracking System - Real-time AIS Movement Analysis
 * 
 * Tracks vessel positions 3x daily (09:00, 13:00, 15:00)
 * Matches vessels against facilities to detect transmission paths
 * Builds movement patterns for epidemiological analysis
 */

const { getAllVessels } = require('./ais');
const { getAllFacilities } = require('./barentswatch');

const VISIT_RADIUS_KM = 0.5; // 500m threshold for facility visit
const VESSEL_TRACKING_HISTORY = 'vessel_visits'; // DB key

/**
 * Calculate distance between two coordinates (Haversine)
 */
function getDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Record vessel positions and match against facilities
 * Called 3x daily via cron
 */
async function recordVesselPositions(db) {
  const timestamp = new Date().toISOString();
  const timeOfDay = new Date().getHours();

  console.log(`📍 Recording vessel positions at ${timestamp} (${timeOfDay}:00)...`);

  try {
    // Fetch current data
    const vessels = await getAllVessels();
    const facilities = await getAllFacilities();

    if (!vessels || vessels.length === 0 || !facilities || facilities.length === 0) {
      console.warn('⚠️  No vessels or facilities available');
      return { timestamp, vessels_tracked: 0, visits_recorded: 0 };
    }

    // Initialize storage
    if (!db.vessel_positions_history) db.vessel_positions_history = [];
    if (!db.vessel_visits) db.vessel_visits = [];

    let visitsRecorded = 0;

    // Match each vessel against each facility
    for (const vessel of vessels) {
      if (!vessel.lat || !vessel.lng) continue;

      // Find all facilities within radius
      const visitingFacilities = [];
      for (const facility of facilities) {
        if (!facility.lat || !facility.lng) continue;

        const distance = getDistance(vessel.lat, vessel.lng, facility.lat, facility.lng);
        if (distance <= VISIT_RADIUS_KM) {
          visitingFacilities.push({
            facility_id: facility.id,
            facility_name: facility.name,
            distance_km: distance.toFixed(3),
            lat: facility.lat,
            lng: facility.lng
          });
        }
      }

      // Store vessel visit record
      if (visitingFacilities.length > 0) {
        const visit = {
          id: `visit_${vessel.id}_${Date.now()}`,
          timestamp: timestamp,
          time_of_day: timeOfDay,
          vessel_id: vessel.id,
          vessel_name: vessel.name,
          vessel_type: vessel.type,
          vessel_mmsi: vessel.mmsi,
          vessel_lat: vessel.lat,
          vessel_lng: vessel.lng,
          vessel_speed: vessel.speed,
          vessel_heading: vessel.heading,
          facilities_visited: visitingFacilities,
          visit_count: visitingFacilities.length
        };

        db.vessel_visits.push(visit);
        visitsRecorded += visitingFacilities.length;
      }
    }

    // Store raw position snapshot for analysis
    db.vessel_positions_history.push({
      timestamp: timestamp,
      time_of_day: timeOfDay,
      vessel_count: vessels.length,
      facility_count: facilities.length,
      visits_recorded: visitsRecorded
    });

    console.log(`✓ Recorded ${visitsRecorded} facility visits from ${vessels.length} vessels`);

    return {
      timestamp: timestamp,
      vessels_tracked: vessels.length,
      facilities_scanned: facilities.length,
      visits_recorded: visitsRecorded
    };
  } catch (err) {
    console.error('❌ Failed to record vessel positions:', err.message);
    throw err;
  }
}

/**
 * Analyze vessel movement patterns over time window
 * Used to detect transmission paths
 */
function analyzeVesselMovement(db, hoursWindow = 24) {
  const cutoffTime = new Date(Date.now() - hoursWindow * 60 * 60 * 1000).toISOString();
  const recentVisits = (db.vessel_visits || []).filter(v => v.timestamp > cutoffTime);

  const patterns = {
    total_visits: recentVisits.length,
    unique_vessels: new Set(recentVisits.map(v => v.vessel_id)).size,
    unique_facilities: new Set(recentVisits.flatMap(v => v.facilities_visited.map(f => f.facility_id))).size,
    vessel_frequency: {},
    facility_visits: {},
    transmission_paths: []
  };

  // Analyze per-vessel behavior
  for (const visit of recentVisits) {
    // Vessel frequency
    if (!patterns.vessel_frequency[visit.vessel_id]) {
      patterns.vessel_frequency[visit.vessel_id] = {
        name: visit.vessel_name,
        type: visit.vessel_type,
        visit_count: 0,
        facilities: new Set()
      };
    }
    patterns.vessel_frequency[visit.vessel_id].visit_count++;
    visit.facilities_visited.forEach(f => {
      patterns.vessel_frequency[visit.vessel_id].facilities.add(f.facility_id);
    });

    // Facility visit tracking
    visit.facilities_visited.forEach(facility => {
      if (!patterns.facility_visits[facility.facility_id]) {
        patterns.facility_visits[facility.facility_id] = {
          name: facility.facility_name,
          visit_count: 0,
          vessels: new Set()
        };
      }
      patterns.facility_visits[facility.facility_id].visit_count++;
      patterns.facility_visits[facility.facility_id].vessels.add(visit.vessel_id);
    });
  }

  // Detect transmission paths: vessels visiting 2+ facilities
  const multiVisitVessels = Object.entries(patterns.vessel_frequency).filter(
    ([_, v]) => v.facilities.size >= 2
  );

  for (const [vesselId, vesselData] of multiVisitVessels) {
    const facilitiesVisited = Array.from(vesselData.facilities);
    patterns.transmission_paths.push({
      vessel_id: vesselId,
      vessel_name: vesselData.name,
      vessel_type: vesselData.type,
      facilities: facilitiesVisited,
      facility_count: facilitiesVisited.length,
      potential_transmission_risk: 'HIGH'
    });
  }

  // Convert Sets to arrays for JSON serialization
  for (const vessel of Object.values(patterns.vessel_frequency)) {
    vessel.facilities = Array.from(vessel.facilities);
  }
  for (const facility of Object.values(patterns.facility_visits)) {
    facility.vessels = Array.from(facility.vessels);
  }

  return patterns;
}

/**
 * Get vessel visit history for a specific facility
 */
function getFacilityVesselHistory(db, facilityId, hoursBack = 72) {
  const cutoffTime = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();
  const visits = (db.vessel_visits || [])
    .filter(v => v.timestamp > cutoffTime)
    .filter(v => v.facilities_visited.some(f => f.facility_id === facilityId))
    .map(v => ({
      timestamp: v.timestamp,
      time_of_day: v.time_of_day,
      vessel_id: v.vessel_id,
      vessel_name: v.vessel_name,
      vessel_type: v.vessel_type,
      vessel_speed: v.vessel_speed,
      facility: v.facilities_visited.find(f => f.facility_id === facilityId)
    }));

  return {
    facility_id: facilityId,
    hours_back: hoursBack,
    total_visits: visits.length,
    unique_vessels: new Set(visits.map(v => v.vessel_id)).size,
    visits: visits.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
  };
}

/**
 * Get vessel trajectory - all facilities visited by vessel
 */
function getVesselTrajectory(db, vesselId, hoursBack = 72) {
  const cutoffTime = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();
  const visits = (db.vessel_visits || [])
    .filter(v => v.timestamp > cutoffTime)
    .filter(v => v.vessel_id === vesselId)
    .flatMap(v =>
      v.facilities_visited.map(f => ({
        timestamp: v.timestamp,
        time_of_day: v.time_of_day,
        vessel_lat: v.vessel_lat,
        vessel_lng: v.vessel_lng,
        vessel_speed: v.vessel_speed,
        facility_id: f.facility_id,
        facility_name: f.facility_name,
        facility_lat: f.lat,
        facility_lng: f.lng,
        distance_km: f.distance_km
      }))
    );

  return {
    vessel_id: vesselId,
    hours_back: hoursBack,
    total_facility_visits: visits.length,
    unique_facilities: new Set(visits.map(v => v.facility_id)).size,
    trajectory: visits.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
  };
}

/**
 * Check correlation between vessel movement and facility alerts
 * Used for validation: "Did vessel X visit facility A, then B got infected?"
 */
function correlateVesselMovementWithAlerts(db, snapshots, hoursWindow = 72) {
  const vesselData = analyzeVesselMovement(db, hoursWindow);
  const correlations = [];

  // For each multi-visit vessel
  for (const path of vesselData.transmission_paths) {
    const facilitiesInPath = path.facilities;

    // Check if any pair had consecutive alerts
    for (let i = 0; i < facilitiesInPath.length - 1; i++) {
      const sourceId = facilitiesInPath[i];
      const targetId = facilitiesInPath[i + 1];

      // Find visits in chronological order
      const sourceVisits = (db.vessel_visits || [])
        .filter(v => v.vessel_id === path.vessel_id)
        .filter(v => v.facilities_visited.some(f => f.facility_id === sourceId));

      const targetVisits = (db.vessel_visits || [])
        .filter(v => v.vessel_id === path.vessel_id)
        .filter(v => v.facilities_visited.some(f => f.facility_id === targetId));

      if (sourceVisits.length > 0 && targetVisits.length > 0) {
        const lastSourceVisit = new Date(
          Math.max(...sourceVisits.map(v => new Date(v.timestamp).getTime()))
        );
        const firstTargetVisit = new Date(
          Math.min(...targetVisits.map(v => new Date(v.timestamp).getTime()))
        );

        const hoursGap = (firstTargetVisit - lastSourceVisit) / (1000 * 60 * 60);

        if (hoursGap >= 0 && hoursGap <= 72) {
          // Vessel visited source, then target within 72 hours
          correlations.push({
            vessel_id: path.vessel_id,
            vessel_name: path.vessel_name,
            source_facility: sourceId,
            target_facility: targetId,
            hours_between_visits: hoursGap.toFixed(2),
            last_source_visit: lastSourceVisit.toISOString(),
            first_target_visit: firstTargetVisit.toISOString()
          });
        }
      }
    }
  }

  return {
    window_hours: hoursWindow,
    total_correlations: correlations.length,
    potential_transmission_chains: correlations
  };
}

module.exports = {
  recordVesselPositions,
  analyzeVesselMovement,
  getFacilityVesselHistory,
  getVesselTrajectory,
  correlateVesselMovementWithAlerts,
  VISIT_RADIUS_KM
};
