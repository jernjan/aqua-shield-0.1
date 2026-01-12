/**
 * Risk Assessment Engine
 * Calculates disease transmission risk between aquaculture facilities
 * Based on: lice load, disease status, proximity, and ocean current patterns
 */

const metOcean = require('./metocean');

/**
 * Calculate Haversine distance between two coordinates in kilometers
 */
function getDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate bearing (compass direction) from facility1 to facility2
 * Returns degrees 0-360
 */
function getBearing(lat1, lng1, lat2, lng2) {
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const y = Math.sin(dLng) * Math.cos(lat2 * (Math.PI / 180));
  const x =
    Math.cos(lat1 * (Math.PI / 180)) * Math.sin(lat2 * (Math.PI / 180)) -
    Math.sin(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.cos(dLng);
  let bearing = Math.atan2(y, x) * (180 / Math.PI);
  return (bearing + 360) % 360; // Normalize to 0-360
}

/**
 * Get ocean current direction for facility
 * Uses MET data if available, falls back to geographic model
 * Returns direction in degrees (0=North, 90=East, 180=South, 270=West)
 */
function getDefaultCurrentDirection(lat, lng) {
  // Try to use real MET data (cached, fast)
  // This is called synchronously during risk calculation, so data should already be cached
  // If facility has currentDirection property set during sync, use that
  // Otherwise fallback to simple geographic model
  
  // Simple geographic fallback
  if (lat > 68) return 0; // North
  if (lat > 59 && lng < 8) return 340; // Northwest
  if (lat < 60) return 180; // South
  return 350; // Slight northwest

}

/**
 * Calculate risk score for transmission FROM source TO target facility
 * Risk factors: lice load, disease, proximity, current direction
 */
function calculateTransmissionRisk(source, target) {
  // Factor 1: Source lice load (0-100)
  // Higher lice = higher transmission risk
  // Scale: <5 = 10, 5-10 = 30, 10-20 = 60, >20 = 100
  let liceRisk = 0;
  if (source.liceCount > 20) liceRisk = 100;
  else if (source.liceCount > 10) liceRisk = 60;
  else if (source.liceCount > 5) liceRisk = 30;
  else if (source.liceCount > 0) liceRisk = 10;

  // Factor 2: Source disease status (0-50 bonus)
  let diseaseRisk = 0;
  if (source.diseaseStatus === 'infected') diseaseRisk = 50;
  else if (source.diseaseStatus === 'suspect') diseaseRisk = 25;

  // Factor 3: Distance decay (0-50)
  // Lice primarily spread within 5-10km
  // >10km = minimal risk, 0-2km = maximum risk
  const distance = getDistance(source.lat, source.lng, target.lat, target.lng);
  let distanceRisk = 0;
  if (distance < 2) distanceRisk = 50;
  else if (distance < 5) distanceRisk = 40;
  else if (distance < 10) distanceRisk = 20;
  else if (distance < 15) distanceRisk = 5;
  // else distanceRisk = 0; (already 0)

  // Factor 4: Ocean current direction alignment
  // If current flows FROM source TO target, transmission risk increases
  let currentRisk = 0;
  const bearing = getBearing(source.lat, source.lng, target.lat, target.lng);
  const currentDir = source.currentDirection || getDefaultCurrentDirection(source.lat, source.lng);
  const directionDiff = Math.abs(bearing - currentDir);
  const normalizedDiff = directionDiff > 180 ? 360 - directionDiff : directionDiff;

  // If current is aligned with bearing (within 45°): HIGH risk bonus
  // If current is opposite (>135°): risk penalty
  if (normalizedDiff < 45) {
    currentRisk = 30; // Current flows toward target
  } else if (normalizedDiff < 90) {
    currentRisk = 15; // Partial alignment
  } else if (normalizedDiff > 135) {
    currentRisk = -15; // Current flows away
  }

  // Total risk (0-100 scale)
  const totalRisk = Math.min(100, Math.max(0, liceRisk + diseaseRisk + distanceRisk + currentRisk));

  return {
    score: Math.round(totalRisk),
    factors: {
      lice: Math.round(liceRisk),
      disease: Math.round(diseaseRisk),
      distance: Math.round(distanceRisk),
      current: Math.round(currentRisk),
    },
    distance: Math.round(distance * 10) / 10, // Round to 1 decimal
  };
}

/**
 * Calculate own risk score for a facility
 * This is the baseline risk level (how infected is this facility?)
 */
function calculateFacilityRisk(facility) {
  let score = 0;

  // Lice load component
  if (facility.liceCount > 20) score += 60;
  else if (facility.liceCount > 10) score += 40;
  else if (facility.liceCount > 5) score += 25;
  else if (facility.liceCount > 0) score += 10;

  // Disease status component
  if (facility.diseaseStatus === 'infected') score += 40;
  else if (facility.diseaseStatus === 'suspect') score += 20;

  return Math.min(100, score);
}

/**
 * Find all facilities at risk (score >= threshold)
 * Calculate transmission risks to nearby facilities
 */
function assessAllRisks(facilities, riskThreshold = 70) {
  if (!facilities || facilities.length === 0) {
    return { risky: [], safe: [], summary: { critical: 0, high: 0, medium: 0 } };
  }

  // Calculate own risk for each facility
  const facilitiesWithRisk = facilities.map(f => ({
    ...f,
    ownRisk: calculateFacilityRisk(f),
  }));

  // Find risky facilities
  const risky = facilitiesWithRisk
    .filter(f => f.ownRisk >= riskThreshold)
    .map(source => {
      // For each risky facility, find transmission risks to nearby ones
      const transmissionRisks = facilitiesWithRisk
        .filter(target => target.id !== source.id)
        .map(target => {
          const risk = calculateTransmissionRisk(source, target);
          return risk.score > 0 ? { ...target, transmissionRisk: risk } : null;
        })
        .filter(x => x !== null)
        .sort((a, b) => b.transmissionRisk.score - a.transmissionRisk.score)
        .slice(0, 10); // Top 10 transmission targets

      return {
        ...source,
        transmissionTargets: transmissionRisks,
        riskLevel:
          source.ownRisk >= 85 ? 'CRITICAL' : source.ownRisk >= 75 ? 'HIGH' : 'MEDIUM',
      };
    })
    .sort((a, b) => b.ownRisk - a.ownRisk);

  // Safe facilities
  const safe = facilitiesWithRisk.filter(f => f.ownRisk < riskThreshold);

  // Summary stats
  const summary = {
    total: facilities.length,
    risky: risky.length,
    safe: safe.length,
    critical: risky.filter(f => f.riskLevel === 'CRITICAL').length,
    high: risky.filter(f => f.riskLevel === 'HIGH').length,
    medium: risky.filter(f => f.riskLevel === 'MEDIUM').length,
  };

  return {
    risky,
    safe,
    summary,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Get facilities that could be infected by a specific source facility
 * Within next 2-7 days (simplified: within 15km + good current alignment)
 */
function getPredictedSpreaders(facilities, sourceFacilityId, daysAhead = 3) {
  const source = facilities.find(f => f.id === sourceFacilityId);
  if (!source) return [];

  const targets = facilities
    .filter(f => f.id !== sourceFacilityId)
    .map(target => {
      const risk = calculateTransmissionRisk(source, target);
      return risk.score > 20
        ? {
            ...target,
            spreadRisk: risk,
            daysToInfection: Math.ceil(20 / Math.max(1, risk.score)),
          }
        : null;
    })
    .filter(x => x !== null)
    .sort((a, b) => b.spreadRisk.score - a.spreadRisk.score);

  return targets;
}

module.exports = {
  getDistance,
  getBearing,
  getDefaultCurrentDirection,
  calculateTransmissionRisk,
  calculateFacilityRisk,
  assessAllRisks,
  getPredictedSpreaders,
};
