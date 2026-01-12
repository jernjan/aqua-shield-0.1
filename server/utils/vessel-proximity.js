/**
 * Vessel Proximity & Risk Assessment
 * Checks nearby facilities and calculates recommended measures
 */

/**
 * Simple haversine distance calculation (meters)
 * Using simplified formula for short distances
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth radius in meters
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
 * Calculate distance between two points (meters)
 */
function getDistance(vessel, facility) {
  if (!vessel.latitude || !vessel.longitude || !facility.latitude || !facility.longitude) {
    return null;
  }
  
  try {
    const distanceMeters = haversineDistance(
      vessel.latitude, 
      vessel.longitude, 
      facility.latitude, 
      facility.longitude
    );
    return Math.round(distanceMeters);
  } catch (err) {
    console.error('Distance calc error:', err);
    return null;
  }
}

/**
 * Calculate recommended measure based on distance and risk
 * Grad 1: Info only (forbikjøring)
 * Grad 2: Karantene (48h)
 * Grad 3: Desinfeksjon + Karantene
 */
function calculateMeasure(distanceMeters, riskScore) {
  const distanceKm = distanceMeters / 1000;
  const ALERT_THRESHOLD = 50; // Match forecast.js
  
  // Primary factor: distance
  if (distanceKm < 1 && riskScore >= ALERT_THRESHOLD) {
    return { grad: 3, label: 'Desinfeksjon + Karantene', description: 'Båten må desinfiseres før annet arbeid' };
  }
  if (distanceKm < 1) {
    return { grad: 2, label: 'Karantene', description: '48 timer pause før annet arbeid' };
  }
  if (distanceKm < 3 && riskScore >= ALERT_THRESHOLD) {
    return { grad: 2, label: 'Karantene', description: '48 timer pause før annet arbeid' };
  }
  if (distanceKm < 3) {
    return { grad: 1, label: 'Info', description: 'Moniter situasjonen' };
  }
  
  // Beyond 3km
  return { grad: 0, label: 'Safe', description: 'Utenfor varslingsavstand' };
}

/**
 * Get nearby facilities for a vessel
 * @param {Object} vessel - vessel with latitude/longitude
 * @param {Array} facilities - all facilities
 * @param {number} maxDistanceKm - max distance to report (default 3km)
 */
function getNearbyFacilities(vessel, facilities, maxDistanceKm = 3) {
  if (!vessel || !vessel.latitude || !vessel.longitude) {
    return [];
  }
  
  const nearby = [];
  
  facilities.forEach(facility => {
    const distanceMeters = getDistance(vessel, facility);
    
    if (distanceMeters === null) return;
    
    const distanceKm = distanceMeters / 1000;
    
    // Only include facilities within max distance
    if (distanceKm > maxDistanceKm) return;
    
    const measure = calculateMeasure(distanceMeters, facility.ownRisk || 0);
    
    nearby.push({
      id: facility.id || facility.locId,
      name: facility.name,
      municipality: facility.municipality,
      distanceMeters,
      distanceKm: distanceKm.toFixed(1),
      riskScore: facility.ownRisk || 0,
      liceCount: facility.liceCount || 0,
      diseaseStatus: facility.diseaseStatus || 'none',
      measure
    });
  });
  
  // Sort by distance
  return nearby.sort((a, b) => a.distanceMeters - b.distanceMeters);
}

module.exports = {
  getDistance,
  calculateMeasure,
  getNearbyFacilities
};
