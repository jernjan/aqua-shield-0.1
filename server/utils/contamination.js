/**
 * Vessel Contamination Tracking
 * Tracks which vessels have visited high-risk facilities
 * and marks them as potential disease vectors
 */

const CONTAMINATION_THRESHOLD = 60; // Mark as contaminated if facility risk >= 60%
const CONTAMINATION_WINDOW_HOURS = 14 * 24; // 14 days in hours

/**
 * Mark vessel as contaminated after visiting high-risk facility
 * @param {Object} db - Database object
 * @param {string} vesselId - Vessel ID
 * @param {Object} facility - Facility object with riskScore
 * @param {string} timestamp - When vessel visited
 */
function markVesselAsContaminated(db, vesselId, facility, timestamp) {
  if (!db.vessel_contamination) {
    db.vessel_contamination = [];
  }

  // Only mark if facility risk is above threshold
  if (facility.riskScore < CONTAMINATION_THRESHOLD) {
    return;
  }

  // Check if already recorded
  const existing = db.vessel_contamination.find(
    c => c.vessel_id === vesselId && c.facility_id === facility.id && c.timestamp === timestamp
  );

  if (existing) {
    return;
  }

  db.vessel_contamination.push({
    vessel_id: vesselId,
    vessel_name: facility.name, // Will be updated when we have vessel info
    facility_id: facility.id,
    facility_name: facility.name,
    facility_risk_score: facility.riskScore,
    timestamp: timestamp,
    recorded_at: new Date().toISOString(),
    contamination_window_end: new Date(new Date(timestamp).getTime() + CONTAMINATION_WINDOW_HOURS * 60 * 60 * 1000).toISOString()
  });

  console.log(`📍 Vessel ${vesselId} marked as contaminated (visited ${facility.name} with ${facility.riskScore}% risk)`);
}

/**
 * Get contamination status for a vessel
 * Returns array of contamination records still within active window
 */
function getVesselContaminationStatus(db, vesselId) {
  if (!db.vessel_contamination) {
    return { isContaminated: false, records: [] };
  }

  const now = new Date();
  const activeRecords = db.vessel_contamination.filter(c => {
    return c.vessel_id === vesselId && new Date(c.contamination_window_end) > now;
  });

  return {
    isContaminated: activeRecords.length > 0,
    records: activeRecords,
    contaminationSeverity: activeRecords.length > 0 
      ? Math.max(...activeRecords.map(r => r.facility_risk_score))
      : 0,
    hoursRemaining: activeRecords.length > 0
      ? Math.ceil((new Date(activeRecords[0].contamination_window_end) - now) / (60 * 60 * 1000))
      : 0
  };
}

/**
 * Get list of contaminated vessels that could infect a facility
 * Based on recent visits to high-risk facilities
 */
function getContaminatedVesselsNearFacility(db, facilityId, vessels = []) {
  if (!db.vessel_contamination) {
    return [];
  }

  const now = new Date();
  
  // Get contaminated vessels (still in active window)
  const contaminatedVesselIds = new Set(
    db.vessel_contamination
      .filter(c => new Date(c.contamination_window_end) > now)
      .map(c => c.vessel_id)
  );

  // Get vessel visits to this facility
  if (!db.vessel_visits) {
    return [];
  }

  const facilityVisits = db.vessel_visits.filter(v => v.facility_id === facilityId);
  
  // Match contaminated vessels with recent visits
  const contaminatedVisitors = facilityVisits
    .filter(v => contaminatedVesselIds.has(v.vessel_id))
    .slice(0, 10) // Top 10 most recent
    .map(visit => {
      const vessel = vessels.find(v => v.id === visit.vessel_id);
      const contamStatus = getVesselContaminationStatus(db, visit.vessel_id);
      
      return {
        vesselId: visit.vessel_id,
        vesselName: visit.vessel_name || vessel?.name || 'Unknown',
        vesselType: visit.vessel_type || vessel?.type,
        lastVisitTimestamp: visit.timestamp,
        contaminationStatus: contamStatus,
        contaminationSources: contamStatus.records // Where it got contaminated
      };
    });

  return contaminatedVisitors;
}

/**
 * Process vessel visits to mark any that visited high-risk facilities
 * Call this when processing new vessel visits
 */
function processVesselVisitsForContamination(db, facilities = []) {
  if (!db.vessel_visits || !facilities) {
    return;
  }

  let marked = 0;

  db.vessel_visits.forEach(visit => {
    const facility = facilities.find(f => f.id === visit.facility_id);
    if (facility && facility.riskScore >= CONTAMINATION_THRESHOLD) {
      // Check if already marked
      if (!db.vessel_contamination) db.vessel_contamination = [];
      const exists = db.vessel_contamination.some(
        c => c.vessel_id === visit.vessel_id && c.facility_id === visit.facility_id && c.timestamp === visit.timestamp
      );
      if (!exists) {
        markVesselAsContaminated(db, visit.vessel_id, facility, visit.timestamp);
        marked++;
      }
    }
  });

  return { marked };
}

module.exports = {
  CONTAMINATION_THRESHOLD,
  CONTAMINATION_WINDOW_HOURS,
  markVesselAsContaminated,
  getVesselContaminationStatus,
  getContaminatedVesselsNearFacility,
  processVesselVisitsForContamination
};
