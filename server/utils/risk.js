function computeRiskForLocality({ locality, nearbyOutbreaks = 0, temperature = 6, currentSpeed = 0.5 }) {
  // Simple rule-based score: base 20, +30 per nearby outbreak, +temp bonus, -currentSpeed*5
  let score = 20
  score += nearbyOutbreaks * 30
  if (temperature >= 8) score += 10
  if (temperature >= 12) score += 10
  score -= currentSpeed * 5
  score = Math.max(0, Math.min(100, score))
  return { score }
}

module.exports = { computeRiskForLocality }
// Distance-weighted rule-based risk calculation
// Score: 0-100, threshold 60 for alert, 40 for warning

function distanceWeight(distanceKm) {
  if (distanceKm <= 1) return 1.0;
  if (distanceKm <= 3) return 0.8;
  if (distanceKm <= 5) return 0.6;
  if (distanceKm <= 10) return 0.4;
  if (distanceKm <= 20) return 0.2;
  return 0;
}

function degreesToKm(degrees) {
  // 1 degree lat ≈ 111 km
  return degrees * 111;
}

// Calculate facility risk (0-100)
function calculateFacilityRisk(facility, nearbyFacilities, temperature, currentStrength) {
  let score = 0;
  
  // Lice load (40% of score)
  const liceRatio = Math.min(facility.liceCount / 2, 1); // Normalize to 2 lice = max
  score += liceRatio * 40;
  
  // Disease presence (35% of score)
  if (facility.disease) {
    score += 35;
    // Specific disease weights
    if (facility.disease === 'ILA') score += 15; // High impact
    if (facility.disease === 'PD') score += 10;
  }
  
  // Nearby diseased facilities (20% of score)
  let diseasedNearby = 0;
  nearbyFacilities.forEach(nearby => {
    if (nearby.disease) {
      const distKm = degreesToKm(
        Math.sqrt(Math.pow(facility.lat - nearby.lat, 2) + Math.pow(facility.lng - nearby.lng, 2))
      );
      const weight = distanceWeight(distKm);
      diseasedNearby += weight;
    }
  });
  score += Math.min(diseasedNearby * 20, 20);
  
  // Temperature bonus (warm = faster disease spread)
  if (temperature > 8) score += 5;
  if (temperature > 10) score += 5;
  
  // Current strength (if strong, spreads faster)
  if (currentStrength > 0.3) score += 5;
  
  return Math.min(Math.round(score), 100);
}

// Calculate vessel risk (0-100)
function calculateVesselRisk(vessel, nearbyFacilities, visitsWithin1h) {
  let score = 0;
  
  // Visited high-risk facilities recently
  let riskyVisits = 0;
  nearbyFacilities.forEach(facility => {
    if (facility.disease || facility.liceCount > 1) {
      riskyVisits += 30;
    }
  });
  score += Math.min(riskyVisits, 60);
  
  // Number of visits within 1 hour
  if (visitsWithin1h > 3) score += 20;
  else if (visitsWithin1h > 1) score += 10;
  
  // Vessel type (wellboats are higher risk)
  if (vessel.type?.includes('Well') || vessel.type?.includes('well')) {
    score += 20;
  }
  
  return Math.min(Math.round(score), 100);
}

// Get risk level name
function getRiskLevel(score) {
  if (score >= 60) return 'kritisk';
  if (score >= 40) return 'varsel';
  return 'grønn';
}

// Get risk color for UI
function getRiskColor(level) {
  switch (level) {
    case 'kritisk': return '#DC2626'; // Red
    case 'varsel': return '#F59E0B'; // Amber
    default: return '#10B981'; // Green
  }
}

module.exports = {
  calculateFacilityRisk,
  calculateVesselRisk,
  getRiskLevel,
  getRiskColor
};
