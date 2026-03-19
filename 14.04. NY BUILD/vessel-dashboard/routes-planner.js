/**
 * routes-planner.js
 * Route optimization with calendar planning and biosecurity rules
 * 
 * Mattilsynets krav (Transportforskriften §20a, 2026):
 * - Desinfeksjon påkrevd etter hvert besøk til smittet anlegg eller smittesone
 * - Karantene: 48 timer etter attestert desinfeksjon (kumulativ)
 * - Seilingstid inkluderes i karantenetid
 * - REALISTISK PLANLEGGING: Ruter deles inn i "økter/dager" med karantenetid mellom smittebesøk
 */

let plannedRoute = { batches: [], totalDays: 0, hasQuarantine: false };
let selectedFacilities = new Set();
let facilitiesList = []; // Cache for autocomplete
let quarantineLog = {}; // Track quarantine status: { timestamp, lastInfectedVisit, disinfectionDone }

// Biosecurity constants
const QUARANTINE_HOURS = 48;
const DISINFECTION_TIME_MINUTES = 60; // Desinfeksjon + virketid
// Routing tuning
const CLUSTER_RADIUS_KM = 25;
const MAX_FACILITIES_PER_BATCH = 4;
const DEFAULT_WORKDAY_HOURS = 7.5;
const WORKDAY_LIMIT_STORAGE_KEY = 'routeWorkdayLimitMinutes';
const OPERATION_STORAGE_KEY = 'routeFacilityOperations';
const FACILITY_COMMENTS_STORAGE_KEY = 'routeFacilityComments';

let operationMinutesByFacilityId = loadOperationMinutes();
let workdayLimitMinutes = loadWorkdayLimitMinutes();
let facilityComments = loadFacilityComments();

// Get boat speed from user input or use default
function getBoatSpeed() {
  const speedInput = document.getElementById('boatSpeed');
  if (speedInput && speedInput.value) {
    const speed = parseFloat(speedInput.value);
    return speed > 0 ? speed : 18.52; // Default 18.52 km/h (10 knots)
  }
  return 18.52;
}

function getRouteMode() {
  const modeEl = document.getElementById('routeMode');
  return modeEl && modeEl.value ? modeEl.value : 'safe';
}

function computeProximityRisk(facility, infectedFacilities) {
  if (!facility || infectedFacilities.length === 0) {
    return { bwRisk: false, localZone: false, diseases: [] };
  }

  let bwRisk = false;
  let bwData = null;
  
  // First check if BarentsWatch data is available (more accurate than 10km radius)
  if (facility.barentsWatchRisk && facility.nearbyDiseases && facility.nearbyDiseases.length > 0) {
    const riskLevel = facility.barentsWatchRisk.risk_level;
    const zoneType = String(
      facility.barentsWatchRisk.zone_type
      || facility.barentsWatchRisk.zoneType
      || riskLevel
      || ''
    ).trim().toUpperCase();
    
    // Only flag as risk if BarentsWatch level is Moderat, Høy, or Ekstrem
    // "Lav" risk should NOT be flagged
    if (
      riskLevel === 'Moderat'
      || riskLevel === 'Høy'
      || riskLevel === 'Ekstrem'
      || zoneType === 'PROTECTION'
      || zoneType === 'SURVEILLANCE'
    ) {
      bwRisk = true;
      bwData = {
        diseases: facility.nearbyDiseases,
        riskLevel: riskLevel,
        riskScore: facility.barentsWatchRisk.risk_score,
        zoneType
      };
    }
  }

  // ALWAYS check 10km radius - independent of BW risk
  const nearbyDiseases = new Set();
  let localZone = false;
  
  for (const infectedFacility of infectedFacilities) {
    const dist = VesselMap.calculateDistance(
      facility.latitude,
      facility.longitude,
      infectedFacility.latitude,
      infectedFacility.longitude
    );
    if (dist <= 10) {
      localZone = true;
      const diseases = infectedFacility.diseases || [];
      diseases.forEach(disease => {
        if (typeof disease === 'string' && disease.trim()) {
          nearbyDiseases.add(disease.trim());
        } else if (typeof disease === 'object' && disease?.name) {
          nearbyDiseases.add(String(disease.name).trim());
        }
      });
    }
  }

  // Return combined risk data
  return {
    bwRisk: bwRisk,
    localZone: localZone,
    diseases: bwData ? bwData.diseases : Array.from(nearbyDiseases),
    riskLevel: bwData ? bwData.riskLevel : null,
    riskScore: bwData ? bwData.riskScore : null,
    zoneType: bwData ? bwData.zoneType : null
  };
}

function loadOperationMinutes() {
  try {
    const stored = localStorage.getItem(OPERATION_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (err) {
    console.warn('Failed to load operation minutes:', err);
    return {};
  }
}

function loadWorkdayLimitMinutes() {
  try {
    const stored = localStorage.getItem(WORKDAY_LIMIT_STORAGE_KEY);
    const parsed = stored ? parseInt(stored, 10) : null;
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  } catch (err) {
    console.warn('Failed to load workday limit:', err);
  }
  return Math.round(DEFAULT_WORKDAY_HOURS * 60);
}

function loadFacilityComments() {
  try {
    const stored = localStorage.getItem(FACILITY_COMMENTS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (err) {
    console.warn('Failed to load facility comments:', err);
    return {};
  }
}

function saveFacilityComments() {
  localStorage.setItem(FACILITY_COMMENTS_STORAGE_KEY, JSON.stringify(facilityComments));
}

function setFacilityComment(facilityId, comment) {
  const cleanComment = (comment || '').trim().substring(0, 50);
  if (cleanComment) {
    facilityComments[String(facilityId)] = cleanComment;
  } else {
    delete facilityComments[String(facilityId)];
  }
  saveFacilityComments();
}

function getFacilityComment(facilityId) {
  return facilityComments[String(facilityId)] || '';
}

function saveOperationMinutes() {
  localStorage.setItem(OPERATION_STORAGE_KEY, JSON.stringify(operationMinutesByFacilityId));
}

function saveWorkdayLimitMinutes() {
  localStorage.setItem(WORKDAY_LIMIT_STORAGE_KEY, String(workdayLimitMinutes));
}

function getOperationMinutesForFacility(facilityId) {
  const key = String(facilityId);
  const stored = operationMinutesByFacilityId[key];
  // Always return 0 if not explicitly set (never use auto-generated values)
  return (Number.isFinite(stored) && stored > 0) ? stored : 0;
}

function getWorkdayLimitMinutes() {
  return workdayLimitMinutes;
}

function getWorkdayLimitHours() {
  return (workdayLimitMinutes / 60);
}

function setOperationMinutesForFacility(facilityId, minutes) {
  const key = String(facilityId);
  const parsed = parseInt(minutes, 10);
  const safeMinutes = Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  if (safeMinutes === 0) {
    delete operationMinutesByFacilityId[key];
  } else {
    operationMinutesByFacilityId[key] = safeMinutes;
  }
  saveOperationMinutes();
  if (plannedRoute && plannedRoute.batches && plannedRoute.batches.length > 0) {
    displayPlannedRoute();
  }
}

function setOperationTimeHoursMinutes(facilityId, hours, minutes) {
  const h = parseInt(hours, 10) || 0;
  const m = parseInt(minutes, 10) || 0;
  const totalMinutes = Math.max(0, h * 60 + m);
  setOperationMinutesForFacility(facilityId, totalMinutes);
}

function getOperationTimeHours(facilityId) {
  const minutes = getOperationMinutesForFacility(facilityId);
  return Math.floor(minutes / 60);
}

function getOperationTimeMinutes(facilityId) {
  const minutes = getOperationMinutesForFacility(facilityId);
  return minutes % 60;
}

function formatOperationTime(minutes) {
  if (!minutes || minutes === 0) return 'ingen';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}t`;
  return `${h}t ${m}min`;
}

function setWorkdayLimitHours(hours) {
  const parsed = parseFloat(hours);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return;
  }
  workdayLimitMinutes = Math.round(parsed * 60);
  saveWorkdayLimitMinutes();
  if (plannedRoute && plannedRoute.batches && plannedRoute.batches.length > 0) {
    displayPlannedRoute();
  }
}

function getBatchOperationMinutes(batch) {
  return batch.facilities.reduce((sum, facility) => {
    return sum + getOperationMinutesForFacility(facility.id);
  }, 0);
}

function buildRoute(start, facilities, mode) {
  const boatSpeedKmPerHour = getBoatSpeed();
  
  // MATTILSYNETS REGEL: Sorter anlegg etter valgt modus
  const sortedFacilities = sortFacilitiesBySafety(facilities, mode);
  
  // GEOGRAFISK KLUSTERING: Grupper anlegg som ligger nær hverandre
  const clusters = createGeographicClusters(sortedFacilities, CLUSTER_RADIUS_KM);
  
  // REALISTISK PLANLEGGING: Del opp i batches basert på klynger
  const batchesData = splitRouteIntoBatchesWithClusters(clusters, start, boatSpeedKmPerHour, mode);
  
  // INTELLIGENT SORTERING: Grønne dager først, deretter risikofulle, smittede til slutt
  // Dette lar brukeren bruke båten effektivt og gjøre annet arbeid under karantenetid
  const sortedBatches = sortBatchesByRisk(batchesData.batches, mode);
  
  return {
    batches: sortedBatches,
    totalDays: batchesData.totalDays,
    hasQuarantine: batchesData.hasQuarantine
  };
}

/**
 * Sorterer batches basert på risiko - grønne dager først
 * Dette lar brukere besøke friske anlegg tidlig, deretter gjøre analysearbeid under karantene
 */
function sortBatchesByRisk(batches, mode = 'safe') {
  const sorted = batches.sort((a, b) => {
    // Beregn risiko-score for hver batch
    const aHasInfected = a.facilities.some(f => f.infected);
    const aHasBWRisk = a.facilities.some(f => f.proximityRisk && !f.infected);
    const aHasLocalRisk = a.facilities.some(f => f.localZoneRisk && !f.infected && !f.proximityRisk);
    
    const bHasInfected = b.facilities.some(f => f.infected);
    const bHasBWRisk = b.facilities.some(f => f.proximityRisk && !f.infected);
    const bHasLocalRisk = b.facilities.some(f => f.localZoneRisk && !f.infected && !f.proximityRisk);
    
    // Beregn priority score (lavere score = kom først)
    // Begge moduser beholder dagsprioritet: grønn -> gul -> oransje -> rød
    const aScore = aHasInfected ? 3 : (aHasBWRisk ? 2 : (aHasLocalRisk ? 1 : 0));
    const bScore = bHasInfected ? 3 : (bHasBWRisk ? 2 : (bHasLocalRisk ? 1 : 0));
    
    // Sorter etter score (lavere først)
    return aScore - bScore;
  });
  
  // Re-numerer dager etter sortering
  sorted.forEach((batch, idx) => {
    batch.day = idx + 1;
  });
  
  return sorted;
}

/**
 * Lager geografiske klynger av anlegg som ligger nær hverandre
 * Dette gjør ruter mer effektive ved å besøke hele områder om gangen
 * 
 * @param {Array} facilities - Liste over anlegg
 * @param {number} maxRadius - Maksimal radius (km) for en klynge
 * @returns {Array} Array av klynger, hver med senterpunkt og anlegg
 */
function createGeographicClusters(facilities, maxRadius = 25) {
  if (facilities.length === 0) return [];
  
  const clusters = [];
  const remaining = [...facilities];
  
  while (remaining.length > 0) {
    // Start ny klynge med første gjenværende anlegg
    const seed = remaining.shift();
    const cluster = {
      center: { lat: seed.lat, lon: seed.lon },
      facilities: [seed],
      hasInfected: seed.infected || false,
      hasProximityRisk: seed.proximityRisk || false
    };
    
    // Finn alle anlegg innen radius fra seed
    const nearbyIndices = [];
    for (let i = 0; i < remaining.length; i++) {
      const facility = remaining[i];
      const dist = VesselMap.calculateDistance(
        seed.lat, seed.lon,
        facility.lat, facility.lon
      );
      
      if (dist <= maxRadius) {
        cluster.facilities.push(facility);
        if (facility.infected) cluster.hasInfected = true;
        if (facility.proximityRisk) cluster.hasProximityRisk = true;
        nearbyIndices.push(i);
      }
    }
    
    // Fjern anlegg som ble lagt til klyngen
    for (let i = nearbyIndices.length - 1; i >= 0; i--) {
      remaining.splice(nearbyIndices[i], 1);
    }
    
    // Oppdater senterpunkt til gjennomsnitt av alle anlegg
    const avgLat = cluster.facilities.reduce((sum, f) => sum + f.lat, 0) / cluster.facilities.length;
    const avgLon = cluster.facilities.reduce((sum, f) => sum + f.lon, 0) / cluster.facilities.length;
    cluster.center = { lat: avgLat, lon: avgLon };
    
    clusters.push(cluster);
  }
  
  
  
  // OPTIMALISER: Slå sammen små klynger (1-2 anlegg) med nærmeste nabo
  const optimizedClusters = mergeSmallClusters(clusters, 35); // Max 35 km til nærmeste
  
  
  return optimizedClusters;
}

/**
 * Slår sammen små klynger (1-2 anlegg) med nærmeste nabo-klynge
 * Dette forhindrer ineffektive enkelt-anlegg dager
 */
function mergeSmallClusters(clusters, maxMergeDistance = 35) {
  if (clusters.length <= 1) return clusters;
  
  let merged = [...clusters];
  let didMerge = true;
  
  // Fortsett til ingen flere merge er mulig
  while (didMerge) {
    didMerge = false;
    
    // Finn minste klynge
    let smallestIdx = -1;
    let smallestSize = Infinity;
    
    for (let i = 0; i < merged.length; i++) {
      const size = merged[i].facilities.length;
      if (size <= 2 && size < smallestSize) {
        smallestSize = size;
        smallestIdx = i;
      }
    }
    
    if (smallestIdx === -1) break; // Ingen små klynger igjen
    
    const smallCluster = merged[smallestIdx];
    
    // Finn nærmeste andre klynge
    let nearestIdx = -1;
    let nearestDist = Infinity;
    
    for (let i = 0; i < merged.length; i++) {
      if (i === smallestIdx) continue;
      
      const dist = VesselMap.calculateDistance(
        smallCluster.center.lat, smallCluster.center.lon,
        merged[i].center.lat, merged[i].center.lon
      );
      
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestIdx = i;
      }
    }
    
    // Merge hvis distanse er akseptabel
    if (nearestIdx !== -1 && nearestDist <= maxMergeDistance) {
      const targetCluster = merged[nearestIdx];
      
      // Flytt anlegg fra liten klynge til mål-klynge
      targetCluster.facilities.push(...smallCluster.facilities);
      
      // Oppdater flags
      if (smallCluster.hasInfected) targetCluster.hasInfected = true;
      if (smallCluster.hasProximityRisk) targetCluster.hasProximityRisk = true;
      
      // Oppdater senterpunkt
      const avgLat = targetCluster.facilities.reduce((sum, f) => sum + f.lat, 0) / targetCluster.facilities.length;
      const avgLon = targetCluster.facilities.reduce((sum, f) => sum + f.lon, 0) / targetCluster.facilities.length;
      targetCluster.center = { lat: avgLat, lon: avgLon };
      
      // Fjern den lille klyngen
      merged.splice(smallestIdx, 1);
      didMerge = true;
      
      
    } else {
      break; // Ingen flere merge mulig
    }
  }
  
  return merged;
}

/**
 * Deler ruten inn i realistiske "økter" basert på geografiske klynger
 * Velger nærmeste klynge fra nåværende posisjon, respekterer biosikkerhetsregler
 * 
 * @returns { batches: [...], totalDays: number, hasQuarantine: boolean }
 */
function splitRouteIntoBatchesWithClusters(clusters, start, boatSpeedKmPerHour, mode) {
  if (clusters.length === 0) {
    return { batches: [], totalDays: 0, hasQuarantine: false };
  }
  
  const batches = [];
  let remainingClusters = [...clusters];
  let currentDay = 1;
  let currentPosition = start;
  
  while (remainingClusters.length > 0) {
    // Finn nærmeste klynge fra nåværende posisjon
    let nearestCluster = null;
    let nearestDist = Infinity;
    
    remainingClusters.forEach(cluster => {
      const dist = VesselMap.calculateDistance(
        currentPosition.lat, currentPosition.lon,
        cluster.center.lat, cluster.center.lon
      );
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestCluster = cluster;
      }
    });
    
    if (!nearestCluster) break;
    
    // Del klyngen i batches (maks 1 smittet per batch)
    const clusterBatches = processCluster(
      nearestCluster,
      currentPosition,
      currentDay,
      boatSpeedKmPerHour,
      mode
    );
    
    batches.push(...clusterBatches);
    
    // Oppdater nåværende posisjon og dag
    if (clusterBatches.length > 0) {
      const lastBatch = clusterBatches[clusterBatches.length - 1];
      if (lastBatch.facilities.length > 0) {
        const lastFacility = lastBatch.facilities[lastBatch.facilities.length - 1];
        currentPosition = { lat: lastFacility.lat, lon: lastFacility.lon };
      }
      currentDay = lastBatch.day;
      
      // Legg til karantenetid hvis siste batch hadde smitte
      if (lastBatch.needsQuarantine && remainingClusters.length > 1) {
        currentDay += 3;
      } else if (remainingClusters.length > 1) {
        currentDay += 1;
      }
    }
    
    // Fjern klyngen fra remaining
    remainingClusters = remainingClusters.filter(c => c !== nearestCluster);
  }
  
  return {
    batches: batches,
    totalDays: batches.length > 0 ? batches[batches.length - 1].day : 0,
    hasQuarantine: batches.some(b => b.needsQuarantine)
  };
}

/**
 * Prosesserer en geografisk klynge til én eller flere batches
 * Respekterer regel om maks 1 smittet anlegg per batch
 */
function processCluster(cluster, startPos, startDay, boatSpeedKmPerHour, mode) {
  const batches = [];
  let currentDay = startDay;
  let currentPosition = startPos;
  
  // Separer grønne, gule (10km) og risikoanlegg (BW/røde)
  const greenFacilities = cluster.facilities.filter(f => !f.infected && !f.proximityRisk && !f.localZoneRisk && !f.liceHigh);
  const yellowFacilities = cluster.facilities.filter(f => !f.infected && !f.proximityRisk && !f.liceHigh && f.localZoneRisk);
  const riskyFacilities = cluster.facilities.filter(f => f.infected || f.proximityRisk || f.liceHigh);
  const greenQueue = [...greenFacilities];
  const yellowQueue = [...yellowFacilities];
  const riskyQueue = [...riskyFacilities];

  while (greenQueue.length > 0 || yellowQueue.length > 0 || riskyQueue.length > 0) {
    const batchFacilities = [];
    const hasRisk = riskyQueue.length > 0;
    const maxNonRisk = hasRisk ? Math.max(0, MAX_FACILITIES_PER_BATCH - 1) : MAX_FACILITIES_PER_BATCH;

    // Legg alltid til grønne før gule
    while (batchFacilities.length < maxNonRisk && (greenQueue.length > 0 || yellowQueue.length > 0)) {
      if (greenQueue.length > 0) {
        batchFacilities.push(greenQueue.shift());
      } else {
        batchFacilities.push(yellowQueue.shift());
      }
    }

    // Legg til maks 1 risikofasilitet i denne batchen (oransje/rød)
    if (hasRisk && batchFacilities.length < MAX_FACILITIES_PER_BATCH) {
      batchFacilities.push(riskyQueue.shift());
    }

    const batch = createBatchFromFacilities(
      batchFacilities,
      currentPosition,
      currentDay,
      boatSpeedKmPerHour,
      mode
    );

    if (batch.facilities.length > 0) {
      batches.push(batch);
      const lastFac = batch.facilities[batch.facilities.length - 1];
      currentPosition = { lat: lastFac.lat, lon: lastFac.lon };

      const hasMoreInCluster = greenQueue.length > 0 || riskyQueue.length > 0;
      if (batch.needsQuarantine && hasMoreInCluster) {
        currentDay += 3;
      } else if (hasMoreInCluster) {
        currentDay += 1;
      }
    } else {
      break;
    }
  }
  
  return batches;
}

/**
 * Lager en batch fra en liste med anlegg, optimerer rekkefølge
 */
function createBatchFromFacilities(facilities, startPos, day, boatSpeedKmPerHour, mode) {
  // Get default departure time from input
  const departureTimeInput = document.getElementById('routeDepartureTime');
  const defaultDepartureTime = departureTimeInput && departureTimeInput.value ? departureTimeInput.value : '07:30';
  
  const batch = {
    day: day,
    departureTime: defaultDepartureTime,  // Add per-day departure time
    facilities: [],
    totalDistance: 0,
    totalTimeMinutes: 0,
    hasInfected: false,
    needsQuarantine: false
  };
  
  let current = startPos;
  let remaining = new Set(facilities);
  
  // Greedy nearest neighbor innenfor batchen med risikoprioritet per modus
  while (remaining.size > 0) {
    let nearest = null;
    let nearestScore = Infinity;
    let nearestDist = Infinity;
    const hasGreenRemaining = Array.from(remaining).some(isGreenFacility);
    const hasYellowRemaining = Array.from(remaining).some(isYellowFacility);
    
    remaining.forEach(facility => {
      if (hasGreenRemaining && !isGreenFacility(facility)) {
        return;
      }

      const dist = VesselMap.calculateDistance(
        current.lat, current.lon,
        facility.lat, facility.lon
      );

      let score = dist;

      if (mode === 'safe') {
        // I sikker modus: grønn -> gul -> oransje -> rød
        // Tydelig prioritering over geografi
        score += getFacilityRiskTier(facility) * 10000;
      } else {
        // I raskest-modus: behold kun kravet grønn før gul
        if (!hasGreenRemaining && hasYellowRemaining && isRiskFacilityForOrdering(facility)) {
          score += 2500;
        }
      }

      if (score < nearestScore) {
        nearestScore = score;
        nearestDist = dist;
        nearest = facility;
      }
    });
    
    if (nearest) {
      const travelTimeMinutes = Math.ceil((nearestDist / boatSpeedKmPerHour) * 60);
      batch.totalDistance += nearestDist;
      batch.totalTimeMinutes += travelTimeMinutes;
      
      batch.facilities.push({
        ...nearest,
        distanceFromPrevious: nearestDist,
        estTimeMinutes: travelTimeMinutes,
        disinfectionRequired: nearest.infected || nearest.proximityRisk
      });
      
      if (nearest.infected || nearest.proximityRisk) {
        batch.hasInfected = true;
        batch.needsQuarantine = true;
      }
      
      current = nearest;
      remaining.delete(nearest);
    }
  }
  
  return batch;
}

/**
 * LEGACY: Gammel batch-funksjon (brukes ikke lenger)
 */
function splitRouteIntoBatches(facilities, start, boatSpeedKmPerHour, mode) {
  const batches = [];
  let remaining = [...facilities];
  let currentDay = 1;
  let globalStartLocation = start;
  
  while (remaining.length > 0) {
    const batch = {
      day: currentDay,
      facilities: [],
      totalDistance: 0,
      totalTimeMinutes: 0,
      hasInfected: false,
      needsQuarantine: false
    };
    
    let current = globalStartLocation;
    let batchFacilities = [];
    
    // STRATEGI: Besøk 3-5 anlegg per økt (realistisk antall for én dag)
    // Men: Kun 1 smittet/oransje anlegg per batch (kommer til slutt)
    
    // Finn alle grønne anlegg vi kan besøke
    const greenFacilities = remaining.filter(f => !f.infected && !f.proximityRisk);
    // Finn smittede/oransje (vi tar maks 1 per batch)
    const riskyFacilities = remaining.filter(f => f.infected || f.proximityRisk);
    
    // REALISTISK: Ta maks 3-5 grønne anlegg per batch (ikke alle!)
    const MAX_GREEN_PER_BATCH = 4;
    const greenToVisit = greenFacilities.slice(0, MAX_GREEN_PER_BATCH);
    const riskyToVisit = riskyFacilities.slice(0, 1); // Maks 1 smittet per batch
    
    const visitOrder = [...greenToVisit, ...riskyToVisit];
    
    // Bygg optimal rute innenfor denne batchen
    let localRemaining = new Set(visitOrder);
    
    while (localRemaining.size > 0) {
      let nearest = null;
      let nearestScore = Infinity;
      let nearestDist = Infinity;
      
      localRemaining.forEach(facility => {
        const dist = VesselMap.calculateDistance(current.lat, current.lon, facility.lat, facility.lon);
        let score = dist;
        
        if (mode === 'safe' && facility.proximityRisk && !facility.infected) {
          score += 50; // Penalty for proximity risk
        }
        
        // Smittede anlegg kommer sist i batchen
        if (facility.infected || facility.proximityRisk) {
          score += 100;
        }
        
        if (score < nearestScore) {
          nearestScore = score;
          nearestDist = dist;
          nearest = facility;
        }
      });
      
      if (nearest) {
        const travelTimeMinutes = Math.ceil((nearestDist / boatSpeedKmPerHour) * 60);
        batch.totalDistance += nearestDist;
        batch.totalTimeMinutes += travelTimeMinutes;
        
        batch.facilities.push({
          ...nearest,
          distanceFromPrevious: nearestDist,
          estTimeMinutes: travelTimeMinutes,
          disinfectionRequired: nearest.infected || nearest.proximityRisk || nearest.liceHigh
        });
        
        if (nearest.infected || nearest.proximityRisk || nearest.liceHigh) {
          batch.hasInfected = true;
          batch.needsQuarantine = true;
        }
        
        current = nearest;
        globalStartLocation = nearest; // Neste batch starter herfra
        localRemaining.delete(nearest);
        
        // Fjern fra global remaining
        remaining = remaining.filter(f => f.id !== nearest.id);
      }
    }
    
    if (batch.facilities.length > 0) {
      batches.push(batch);
      
      // Hvis batch har smittet: legg til karantenetid før neste batch
      if (batch.needsQuarantine && remaining.length > 0) {
        currentDay += 3; // 48t karantene ≈ 2 dager + 1 dag desinfeksjon/buffer
      } else if (remaining.length > 0) {
        currentDay += 1; // Neste dag for neste batch
      }
    } else {
      break; // Ingen flere anlegg å besøke
    }
  }
  
  return {
    batches: batches,
    totalDays: batches.length > 0 ? batches[batches.length - 1].day : 0,
    hasQuarantine: batches.some(b => b.needsQuarantine)
  };
}

function isGreenFacility(facility) {
  return !facility.infected && !facility.proximityRisk && !facility.localZoneRisk && !facility.liceHigh;
}

function isYellowFacility(facility) {
  return !facility.infected && !facility.proximityRisk && !facility.liceHigh && facility.localZoneRisk;
}

function isRiskFacilityForOrdering(facility) {
  return facility.infected || facility.proximityRisk || facility.liceHigh;
}

// 0=grønn, 1=gul, 2=oransje/lus, 3=rød
function getFacilityRiskTier(facility) {
  if (facility.infected) return 3;
  if (facility.proximityRisk || facility.liceHigh) return 2;
  if (facility.localZoneRisk) return 1;
  return 0;
}

// Sort facilities by safety: Grønn → Gul (10 km) → Oransje (BW) → Rød (smittet)
function sortFacilitiesBySafety(facilities, mode = 'safe') {
  return [...facilities].sort((a, b) => {
    const aTier = getFacilityRiskTier(a);
    const bTier = getFacilityRiskTier(b);

    // I begge moduser vil vi aldri legge gul foran grønn.
    if (aTier !== bTier) return aTier - bTier;

    // Stabil tie-breaker for konsistent UI
    const aName = (a.name || '').toLowerCase();
    const bName = (b.name || '').toLowerCase();
    return aName.localeCompare(bName);
  });
}

// Initialize route planner
function initRoutePlanner() {
  
  
  // Create facility selection interface
  setupFacilitySelector();
  
  // Setup top search box (added in HTML)
  const topSearchBox = document.getElementById('facilitySearchBoxTop');
  if (topSearchBox) {
    topSearchBox.addEventListener('input', (e) => {
      const term = e.target.value.toLowerCase().trim();
      const normalizedTerm = term.replace(/[æøåäö]/g, m => ({'æ':'ae','ø':'o','å':'a','ä':'a','ö':'o'}[m] || m));
      
      // Filter checkbox list
      let visibleCount = 0;
      let firstVisibleItem = null;
      
      document.querySelectorAll('.facility-checkbox-item').forEach(item => {
        const matchName = item.dataset.name.includes(term);
        const matchNormalized = item.dataset.searchName && item.dataset.searchName.includes(normalizedTerm);
        const visible = term.length === 0 || matchName || matchNormalized;
        item.style.display = visible ? 'block' : 'none';
        if (visible) {
          visibleCount++;
          if (!firstVisibleItem) firstVisibleItem = item;
        }
      });
      
      
      
      // Scroll to first match if searching
      if (term.length > 0 && firstVisibleItem) {
        firstVisibleItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
      
      // Show search result feedback
      const facilityCheckboxList = document.getElementById('facilityCheckboxList');
      if (facilityCheckboxList && term.length > 0) {
        if (visibleCount === 0) {
          // Show "no results" message
          const noResults = facilityCheckboxList.querySelector('.no-search-results');
          if (!noResults) {
            const msg = document.createElement('div');
            msg.className = 'no-search-results';
            msg.style.cssText = 'padding: 1rem; text-align: center; color: #ef4444; background: #fef2f2; border-radius: 4px; margin-bottom: 0.5rem;';
            msg.textContent = `Ingen anlegg funnet for "${term}"`;
            facilityCheckboxList.insertBefore(msg, facilityCheckboxList.firstChild);
          }
        } else {
          // Remove "no results" message if it exists
          const noResults = facilityCheckboxList.querySelector('.no-search-results');
          if (noResults) noResults.remove();
        }
      } else {
        // Clear "no results" message when search is empty
        const noResults = document.querySelector('.no-search-results');
        if (noResults) noResults.remove();
      }
      
      // Also sync with the internal search box if it exists
      const internalSearchBox = document.getElementById('facilitySearchInput');
      if (internalSearchBox) {
        internalSearchBox.value = e.target.value;
      }
    });
  }
  
  
}

// Setup facility selector UI with autocomplete
function setupFacilitySelector() {
  
  
  const container = document.getElementById('facilitySelector');
  if (!container) {
    console.error('❌ facilitySelector container not found in DOM');
    return;
  }
  
  // Check if VesselMap is available and has facilities
  if (typeof VesselMap === 'undefined' || !VesselMap.getFacilitiesData) {
    console.error('❌ VesselMap not available yet');
    return;
  }
  
  const facilities = VesselMap.getFacilitiesData();
  
  
  if (!facilities || facilities.length === 0) {
    console.warn('⚠️ No facilities data available');
    container.innerHTML = '<p style="color: #ef4444; padding: 1rem; text-align: center; background: #fef2f2; border-radius: 4px; border: 1px solid #ef4444;">⚠️ Anlegg er ikke lastet. Sjekk at API-et kjører på port 8000</p>';
    return;
  }
  
  // Show loading indicator
  container.innerHTML = '<p style="color: #3b82f6; padding: 1rem; text-align: center;">⏳ Laster anlegg...</p>';
  
  // Cache facilities for autocomplete
  facilitiesList = facilities.filter(f => f.name && f.latitude && f.longitude);
  
  updateFacilityNameDatalist();
  
  // Create speed control and search
  const html = `
    <div style="margin-bottom: 1rem;">
      <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: #374151;">
        ⚡ Båthastighet (km/t)
      </label>
      <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem;">
        <input 
          type="number" 
          id="boatSpeed" 
          placeholder="18.52 km/h (10 knop)"
          value="18.52"
          min="1"
          max="50"
          step="0.5"
          style="flex: 1; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 4px; font-size: 0.9rem;"
        >
        <span style="padding: 0.5rem; background: #f3f4f6; border-radius: 4px; font-size: 0.85rem; color: #6b7280;">
          <span id="boatSpeedKnots">10.0</span> knop
        </span>
      </div>
    </div>
    <div style="margin-bottom: 1rem;">
      <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: #374151;">
        ⏱️ Maks arbeidstid per dag (timer)
      </label>
      <input
        type="number"
        id="workdayLimitHours"
        min="1"
        max="24"
        step="0.5"
        style="width: 100%; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 4px; font-size: 0.9rem;"
      >
    </div>
    <div style="margin-bottom: 1rem;">
      <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: #374151;">
        🔍 Søk etter anlegg
      </label>
      <div style="position: relative;">
        <input 
          type="text" 
          id="facilitySearchInput" 
          placeholder="Skriv anleggsnavn (f.eks. Valøyan, Slettholmene)..."
          style="width: 100%; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 4px; font-size: 0.9rem;"
        >
        <div id="autocompleteList" style="position: absolute; top: 100%; left: 0; right: 0; background: white; border: 1px solid #d1d5db; border-top: none; border-radius: 0 0 4px 4px; max-height: 200px; overflow-y: auto; display: none; z-index: 1000;"></div>
      </div>
    </div>
    <div id="facilityCheckboxList" style="max-height: 350px; overflow-y: auto; border: 1px solid #e5e7eb; border-radius: 4px; padding: 0.5rem; background: white;">
      <!-- Will be populated by JavaScript -->
    </div>
  `;
  
  container.innerHTML = html;
  
  // Update knots display
  const speedInput = document.getElementById('boatSpeed');
  const knotsDisplay = document.getElementById('boatSpeedKnots');
  speedInput.addEventListener('change', () => {
    const kmh = parseFloat(speedInput.value) || 18.52;
    const knots = (kmh / 1.852).toFixed(1);
    knotsDisplay.textContent = knots;
  });

  const workdayInput = document.getElementById('workdayLimitHours');
  if (workdayInput) {
    workdayInput.value = getWorkdayLimitHours().toString();
    workdayInput.addEventListener('change', () => {
      const hours = parseFloat(workdayInput.value);
      if (!Number.isFinite(hours) || hours <= 0) {
        workdayInput.value = getWorkdayLimitHours().toString();
        showToast('Ugyldig arbeidstid. Bruk timer > 0.', 'warning');
        return;
      }
      setWorkdayLimitHours(hours);
    });
  }
  
  // Populate checkboxes
  const list = document.getElementById('facilityCheckboxList');
  const infectedFacilities = facilitiesList.filter(f => f.diseases && f.diseases.length > 0);
  const sorted = facilitiesList.sort((a, b) => a.name.localeCompare(b.name));
  
  
  
  
  
  sorted.forEach((facility, idx) => {
    const div = document.createElement('div');
    div.style.cssText = 'padding: 0.5rem; border-bottom: 1px solid #f3f4f6;';
    div.className = 'facility-checkbox-item';
    div.dataset.name = facility.name.toLowerCase();
    div.dataset.searchName = facility.name.toLowerCase().replace(/[æøåäö]/g, m => ({'æ':'ae','ø':'o','å':'a','ä':'a','ö':'o'}[m] || m));
    div.dataset.id = facility.localityNo || facility.id || idx;
    div.dataset.fullName = facility.name;
    
    const riskInfo = facility.proximityRisk === true
      ? { bwRisk: true, localZone: false, diseases: [] }
      : computeProximityRisk(facility, infectedFacilities);
    const bwRisk = riskInfo.bwRisk === true;
    const localZoneRisk = riskInfo.localZone === true;
    const nearbyDiseases = riskInfo.diseases || [];
    const infected = facility.diseases && facility.diseases.length > 0;
    const liceHigh = facility.lice_over_threshold === true || facility.lice?.over_threshold === true;
    
    // Primary status (highest priority)
    const status = infected ? '🔴' : (bwRisk ? '🟠' : (liceHigh ? '🧪' : (localZoneRisk ? '🟡' : '🟢')));
    
    // Risk labels - show both if facility has multiple risk types
    let riskLabels = '';
    if (!infected) {
      const labels = [];
      if (bwRisk && localZoneRisk) {
        labels.push('<span style="color: #f59e0b; font-size: 0.75rem; margin-left: 0.5rem;">(BW + 10KM)</span>');
      } else if (bwRisk) {
        labels.push('<span style="color: #f59e0b; font-size: 0.75rem; margin-left: 0.5rem;">(BW-RISIKO)</span>');
      } else if (localZoneRisk) {
        labels.push('<span style="color: #facc15; font-size: 0.75rem; margin-left: 0.5rem;">(10 KM SONE)</span>');
      }
      if (liceHigh) {
        labels.push('<span style="color: #dc2626; font-size: 0.75rem; margin-left: 0.5rem;">(LUS OVER TERSKEL)</span>');
      }
      riskLabels = labels.join('');
    }
    
    div.innerHTML = `
      <label style="display: flex; align-items: center; cursor: pointer; margin: 0;">
        <input 
          type="checkbox" 
          value="${facility.localityNo || facility.id || idx}"
          data-id="${facility.localityNo || facility.id || idx}"
          data-name="${facility.name}"
          data-lat="${facility.latitude}"
          data-lon="${facility.longitude}"
          style="margin-right: 0.5rem; cursor: pointer;"
        >
        <span>${status} ${facility.name}</span>
        ${infected ? `<span style="color: #ef4444; font-size: 0.75rem; margin-left: 0.5rem;">(SMITTET)</span>` : ''}
        ${riskLabels}
      </label>
    `;
    
    const checkbox = div.querySelector('input[type="checkbox"]');
    checkbox.addEventListener('change', (e) => {
      if (e.target.checked) {
        selectedFacilities.add({
          id: facility.localityNo || facility.id || idx,
          name: facility.name,
          lat: facility.latitude,
          lon: facility.longitude,
          infected: infected,
          proximityRisk: bwRisk,
          localZoneRisk: localZoneRisk,
          liceHigh: facility.lice_over_threshold === true || facility.lice?.over_threshold === true,
          liceAdultFemale: facility.lice?.adult_female_lice ?? facility.lice_count ?? null,
          liceTotal: facility.lice?.total_lice ?? null,
          diseases: facility.diseases || [],
          nearbyDiseases: nearbyDiseases
        });
        
        // Highlight on map
        if (typeof VesselMap !== 'undefined' && VesselMap.highlightAndZoomToFacility) {
          VesselMap.highlightAndZoomToFacility(facility.localityNo || facility.id || idx);
        }
      } else {
        removeSelectedFacilityById(facility.localityNo || facility.id || idx, facility.name);
      }
      updateSelectedCount();
    });
    
    list.appendChild(div);
  });
  
  // Autocomplete and search functionality
  const searchInput = document.getElementById('facilitySearchInput');
  const autocompleteList = document.getElementById('autocompleteList');
  
  // Hide autocomplete when clicking outside
  document.addEventListener('click', (e) => {
    if (e.target !== searchInput && !e.target.closest('#autocompleteList')) {
      autocompleteList.style.display = 'none';
    }
  });
  
  searchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase().trim();
    const normalizedTerm = term.replace(/[æøåäö]/g, m => ({'æ':'ae','ø':'o','å':'a','ä':'a','ö':'o'}[m] || m));
    
    
    // Update checkbox visibility and autocomplete
    if (term.length === 0) {
      autocompleteList.style.display = 'none';
      document.querySelectorAll('.facility-checkbox-item').forEach(item => {
        item.style.display = 'block';
      });
      return;
    }
    
    // Filter and show checkboxes
    let visibleCount = 0;
    document.querySelectorAll('.facility-checkbox-item').forEach(item => {
      const matchName = item.dataset.name.includes(term);
      const matchNormalized = item.dataset.searchName && item.dataset.searchName.includes(normalizedTerm);
      const visible = matchName || matchNormalized;
      item.style.display = visible ? 'block' : 'none';
      if (visible) visibleCount++;
    });
    
    
    
    // Show autocomplete suggestions
    const matches = facilitiesList.filter(f => 
      f.name.toLowerCase().includes(term)
    ).slice(0, 8);
    
    
    if (matches.length > 0) {
      autocompleteList.innerHTML = matches.map(facility => `
        <div style="padding: 0.5rem; border-bottom: 1px solid #f3f4f6; cursor: pointer; background: white; transition: background 0.2s;" 
             onmouseover="this.style.background='#f3f4f6'" 
             onmouseout="this.style.background='white'"
             onclick="selectFacilityFromAutocomplete('${facility.name.replace(/'/g, "\\'")}')">
          <strong>${facility.name}</strong>
          <br>
          <small style="color: #6b7280;">${facility.locality || ''}</small>
        </div>
      `).join('');
      autocompleteList.style.display = 'block';
    } else {
      autocompleteList.style.display = 'none';
    }
  });
  
  searchInput.addEventListener('focus', (e) => {
    if (e.target.value.length > 0) {
      const matches = facilitiesList.filter(f => 
        f.name.toLowerCase().includes(e.target.value.toLowerCase())
      ).slice(0, 8);
      
      if (matches.length > 0) {
        autocompleteList.innerHTML = matches.map(facility => `
          <div style="padding: 0.5rem; border-bottom: 1px solid #f3f4f6; cursor: pointer; background: white; transition: background 0.2s;" 
               onmouseover="this.style.background='#f3f4f6'" 
               onmouseout="this.style.background='white'"
               onclick="selectFacilityFromAutocomplete('${facility.name.replace(/'/g, "\\'")}')">
            <strong>${facility.name}</strong>
            <br>
            <small style="color: #6b7280;">${facility.locality || ''}</small>
          </div>
        `).join('');
        autocompleteList.style.display = 'block';
      }
    }
  });

  updateSelectedCount();
  
  
  
}

// Select facility from autocomplete
function selectFacilityFromAutocomplete(facilityName) {
  // Find and check the checkbox
  const checkboxes = document.querySelectorAll('input[type="checkbox"]');
  checkboxes.forEach(cb => {
    if (cb.dataset.name === facilityName) {
      cb.checked = true;
      cb.dispatchEvent(new Event('change', { bubbles: true }));
      
      // Update search and scroll
      const searchInput = document.getElementById('facilitySearchInput');
      const autocompleteList = document.getElementById('autocompleteList');
      
      searchInput.value = facilityName;
      autocompleteList.style.display = 'none';
      
      // Scroll to item
      cb.closest('.facility-checkbox-item').scrollIntoView({ behavior: 'smooth' });
    }
  });
}

window.selectFacilityFromAutocomplete = selectFacilityFromAutocomplete;

// Update selected count display
function updateSelectedCount() {
  const count = selectedFacilities.size;
  const display = document.getElementById('selectedCount');
  if (display) {
    display.textContent = `${count} anlegg valgt`;
  }
  renderSelectedFacilitiesList();
}

function updateFacilityNameDatalist() {
  const list = document.getElementById('facilityNameList');
  if (!list || facilitiesList.length === 0) return;
  list.innerHTML = facilitiesList
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(facility => `<option value="${facility.name}"></option>`)
    .join('');
}

function removeSelectedFacilityById(facilityId, facilityName) {
  const targetId = String(facilityId);
  selectedFacilities.forEach(facility => {
    if (String(facility.id) === targetId || facility.name === facilityName) {
      selectedFacilities.delete(facility);
    }
  });

  const checkboxes = document.querySelectorAll('input[type="checkbox"]');
  checkboxes.forEach(cb => {
    if (String(cb.dataset.id) === targetId || cb.dataset.name === facilityName) {
      cb.checked = false;
    }
  });

  if (typeof VesselMap !== 'undefined' && VesselMap.deselectFacilityById) {
    VesselMap.deselectFacilityById(targetId);
  }
}

function renderSelectedFacilitiesList() {
  const container = document.getElementById('selectedFacilitiesList');
  if (!container) return;

  const facilities = Array.from(selectedFacilities).sort((a, b) => a.name.localeCompare(b.name));
  if (facilities.length === 0) {
    container.innerHTML = '<div style="color: #6b7280; font-size: 0.85rem; text-align: center;">Ingen valgte anlegg</div>';
    return;
  }

  container.innerHTML = '';
  facilities.forEach(facility => {
    const row = document.createElement('div');
    row.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 0.35rem 0.25rem; border-bottom: 1px solid #e5e7eb; gap: 0.5rem;';

    const status = facility.infected ? '🔴' : (facility.proximityRisk ? '🟠' : (facility.localZoneRisk ? '🟡' : '🟢'));
    const label = document.createElement('div');
    label.style.cssText = 'font-size: 0.85rem; color: #111827; flex: 1;';
    label.textContent = `${status} ${facility.name}`;

    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn';
    removeBtn.textContent = 'Fjern';
    removeBtn.style.cssText = 'font-size: 0.75rem; padding: 0.2rem 0.5rem; background: #fee2e2; color: #7f1d1d; border: 1px solid #fecaca;';
    removeBtn.addEventListener('click', () => {
      removeSelectedFacilityById(facility.id, facility.name);
      updateSelectedCount();
    });

    row.appendChild(label);
    row.appendChild(removeBtn);
    container.appendChild(row);
  });
}

// Plan optimal route using nearest neighbor algorithm
function planOptimalRoute() {
  if (selectedFacilities.size === 0) {
    showToast('Velg minst ett anlegg', 'warning');
    return;
  }
  
  const vesselPos = VesselStorage.getVesselData().vessel.position;
  const facilities = Array.from(selectedFacilities);
  const routeMode = getRouteMode();
  
  
  
  const start = { lat: vesselPos.lat, lon: vesselPos.lon, name: 'Labridae (start)' };
  
  // NY LOGIKK: Bygg rute med batches (automatisk oppdeling)
  plannedRoute = buildRoute(start, facilities, routeMode);
  
  const totalDistance = plannedRoute.batches.reduce((sum, b) => sum + b.totalDistance, 0);
  const totalFacilities = plannedRoute.batches.reduce((sum, b) => sum + b.facilities.length, 0);
  
  // Display planned route
  displayPlannedRoute();

  const dateInput = document.getElementById('routePlanDate');
  if (dateInput && !dateInput.value) {
    dateInput.value = new Date().toISOString().split('T')[0];
  }
  
  showToast(`✓ Rute planlagt: ${totalFacilities} anlegg over ${plannedRoute.totalDays} dager, ${totalDistance.toFixed(1)} km`, 'success');
}

// Display planned route with batches/days
function displayPlannedRoute() {
  const container = document.getElementById('routePreview');
  const details = document.getElementById('routeDetails');
  if (!container || !details) return;
  
  if (!plannedRoute || !plannedRoute.batches || plannedRoute.batches.length === 0) {
    container.style.display = 'none';
    return;
  }
  
  const { batches, totalDays, hasQuarantine } = plannedRoute;
  const boatSpeed = getBoatSpeed();
  const boatSpeedKnots = (boatSpeed / 1.852).toFixed(1);
  const totalDistance = batches.reduce((sum, b) => sum + b.totalDistance, 0);
  const totalTime = batches.reduce((sum, b) => sum + b.totalTimeMinutes, 0);
  const totalOperationMinutes = batches.reduce((sum, b) => sum + getBatchOperationMinutes(b), 0);
  const totalWorkMinutes = totalTime + totalOperationMinutes;
  const workdayLimitMinutes = getWorkdayLimitMinutes();
  const totalFacilities = batches.reduce((sum, b) => sum + b.facilities.length, 0);
  
  let html = `
    <div style="background: ${hasQuarantine ? '#fef3c7' : '#f3f4f6'}; padding: 1rem; border-radius: 4px; margin-bottom: 1rem;">
      <h4 style="margin: 0 0 0.5rem 0;">📍 Planlagt rute</h4>
      <p style="margin: 0 0 0.5rem 0; font-size: 0.9rem;">
        <strong>${totalFacilities} anlegg</strong> | 
        <strong>${totalDistance.toFixed(1)} km</strong> | 
        <strong>${totalTime} min kjøretid</strong> | 
        <strong>${totalWorkMinutes} min totalt</strong> | 
        <strong>📅 ${totalDays} dager totalt</strong>
      </p>
      <p style="margin: 0 0 0.5rem 0; font-size: 0.85rem; color: #6b7280;">
        ⚡ Hastighet: ${boatSpeed} km/h (${boatSpeedKnots} knop)
      </p>
      ${hasQuarantine ? '<div style="padding: 0.75rem; background: #fbbf24; color: #78350f; border-radius: 4px; font-weight: 600; margin-top: 0.5rem;">⚠️ VIKTIG: Ruten krever karantenetid (48t) mellom besøk til smittede anlegg</div>' : ''}
    </div>
  `;
  
  // Display each batch (day) separately
  batches.forEach((batch, batchIdx) => {
    const isLastBatch = batchIdx === batches.length - 1;
    
    const batchOperationMinutes = getBatchOperationMinutes(batch);
    const batchWorkMinutes = batch.totalTimeMinutes + batchOperationMinutes;
    const workdayWarning = batchWorkMinutes > workdayLimitMinutes
      ? `<button class="btn" onclick="RoutePlanner.splitBatchByWorkload(${batchIdx})" style="margin-left: 0.5rem; font-size: 0.75rem; padding: 0.2rem 0.5rem; background: #f97316; color: white;">Del opp dagen</button>`
      : '';
    
    // Calculate day start and end times
    const dayDepartureTime = batch.departureTime || '07:30';
    const [depHour, depMin] = dayDepartureTime.split(':').map(Number);
    const startDate = new Date();
    startDate.setHours(depHour, depMin, 0, 0);
    const endDate = new Date(startDate.getTime() + batchWorkMinutes * 60000);
    const endTimeStr = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;
    
    // Determine border color based on highest risk in batch
    let borderColor = '#10b981'; // Default green (healthy)
    let bgColor = '#ffffff';
    let riskIcon = '🟢';
    
    // Check for infected facilities (red - highest priority)
    const hasInfected = batch.facilities.some(f => f.infected);
    if (hasInfected) {
      borderColor = '#ef4444'; // Red
      bgColor = '#fef2f2';
      riskIcon = '🔴';
    }
    // Check for BW-risk facilities (orange - medium priority)
    else if (batch.facilities.some(f => f.proximityRisk && !f.infected)) {
      borderColor = '#f97316'; // Orange
      bgColor = '#fff7ed';
      riskIcon = '🟠';
    }
    // Check for local zone (10km) facilities (gul 10km-buffer - lavere prioritet enn rødt/oransje)
    else if (batch.facilities.some(f => f.localZoneRisk && !f.infected && !f.proximityRisk)) {
      borderColor = '#facc15'; // Gul for 10km zone
      bgColor = '#fdf2f8';
      riskIcon = '🌸';
    }

    html += `
      <div style="background: ${bgColor}; padding: 1rem; margin-bottom: 1.5rem; border: 3px solid ${borderColor}; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; padding-bottom: 0.75rem; border-bottom: 2px solid #e5e7eb;">
          <div style="font-weight: 700; color: #1f2937; font-size: 1.1rem;">
            📅 DAG ${batch.day} ${riskIcon}
            <span style="font-weight: 400; font-size: 0.85rem; color: #6b7280;"> → ${batch.facilities.length} anlegg | ${batch.totalDistance.toFixed(1)} km | ${batch.totalTimeMinutes} min kjøring | ${batchWorkMinutes} min totalt</span>
            ${workdayWarning}
          </div>
        </div>
        <div style="background: #f0f9ff; padding: 0.75rem; border-radius: 6px; margin-bottom: 1rem; border: 1px solid #bfdbfe;">
          <div style="display: flex; align-items: center; gap: 1.5rem; flex-wrap: wrap;">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <label style="font-weight: 600; font-size: 0.9rem; color: #1e3a8a;">🕐 Avreise:</label>
              <input type="time" value="${dayDepartureTime}" id="dayDeparture_${batchIdx}" onchange="RoutePlanner.updateDayDeparture(${batchIdx}, this.value)" style="padding: 0.4rem; border: 2px solid #3b82f6; border-radius: 4px; font-size: 0.9rem; font-weight: 600;"/>
            </div>
            <div style="font-size: 0.95rem; color: #1e3a8a;">
              <strong>🏁 Ferdig:</strong> <span style="background: #dbeafe; padding: 0.35rem 0.75rem; border-radius: 999px; font-weight: 700;">${endTimeStr}</span>
            </div>
            <div style="font-size: 0.85rem; color: #6b7280;">
              <strong>Totalt:</strong> ${formatTimeFromMinutes(batchWorkMinutes)} (kjøring + operasjon)
            </div>
          </div>
        </div>
    `;
    
    // Display facilities in this batch
    batch.facilities.forEach((facility, idx) => {
      const timeSum = batch.facilities.slice(0, idx + 1).reduce((sum, f) => {
        return sum + f.estTimeMinutes + getOperationMinutesForFacility(f.id);
      }, 0);
      const operationMinutes = getOperationMinutesForFacility(facility.id);
      const riskBadge = facility.proximityRisk && !facility.infected
        ? '<br><span style="color: #f59e0b; font-size: 0.85rem;">🟠 BW-risiko</span>'
        : (facility.localZoneRisk && !facility.infected
          ? '<br><span style="color: #facc15; font-size: 0.85rem;">🟡 Lokal sone (10 km)</span>'
          : '');
      const diseaseBadge = facility.infected && Array.isArray(facility.diseases) && facility.diseases.length > 0
        ? `<br><span style="color: #ef4444; font-size: 0.85rem;">💉 Sykdom: ${facility.diseases.map(d => (typeof d === 'string' ? d : d?.name)).filter(Boolean).join(', ')}</span>`
        : '';
      const nearbyDiseaseBadge = !facility.infected && Array.isArray(facility.nearbyDiseases) && facility.nearbyDiseases.length > 0
        ? `<br><span style="color: #f59e0b; font-size: 0.85rem;">🔍 Mulige sykdommer i nærheten: ${facility.nearbyDiseases.join(', ')}</span>`
        : '';
      
      // MATTILSYNETS KRAV: Varsler for desinfeksjon
      let biosecurityWarning = '';
      if (facility.disinfectionRequired && facility.infected) {
        biosecurityWarning += `<br><span style="color: #dc2626; font-weight: 600; font-size: 0.9rem;">🧪 DESINFEKSJON PÅKREVD etter besøk (Virkon S/klor - 60 min virketid)</span>`;
      } else if (facility.disinfectionRequired && facility.proximityRisk) {
        biosecurityWarning += `<br><span style="color: #f59e0b; font-weight: 600; font-size: 0.9rem;">🧪 DESINFEKSJON ANBEFALT (BW-risiko)</span>`;
      } else if (facility.localZoneRisk && !facility.infected) {
        biosecurityWarning += `<br><span style="color: #facc15; font-weight: 600; font-size: 0.9rem;">⚠️ Lokal 10 km sone (utenfor BW-risiko)</span>`;
      }
      
      const borderColor = facility.infected
        ? '#ef4444'
        : (facility.proximityRisk ? '#f59e0b' : (facility.localZoneRisk ? '#facc15' : '#10b981'));
      
      html += `
        <div style="background: white; padding: 0.75rem; margin-bottom: 0.5rem; border-left: 4px solid ${borderColor}; border-radius: 2px;">
          <div style="display: flex; justify-content: space-between; align-items: start; gap: 0.75rem;">
            <div style="flex: 1;">
              <strong style="font-size: 0.95rem;">${idx + 1}. ${facility.name}</strong><br>
              <small style="color: #6b7280;">
                ${facility.distanceFromPrevious > 0 ? `+${facility.distanceFromPrevious.toFixed(1)} km (~${facility.estTimeMinutes} min)` : '🏁 Start'}
              </small>
              <div style="display: flex; flex-wrap: wrap; gap: 0.35rem; margin-top: 0.5rem;">
                <span style="background: #eef2f7; color: #334155; padding: 0.2rem 0.5rem; border-radius: 999px; font-size: 0.75rem; border: 1px solid #e2e8f0;">ETA: ~${calculateArrivalTime(timeSum, batchIdx)}</span>
                <button class="btn" onclick="RoutePlanner.shareFacilityRoute(${batchIdx}, ${idx})" style="font-size: 0.7rem; padding: 0.2rem 0.5rem; background: #3b82f6; color: white; border: none; border-radius: 3px; cursor: pointer;">📤 Del rute</button>
                <button class="btn" onclick="RoutePlanner.moveFacilityToAdjacentDay(${batchIdx}, ${idx}, -1)" style="font-size: 0.7rem; padding: 0.2rem 0.5rem; background: #f1f5f9; color: #334155; border: 1px solid #e2e8f0;">← Flytt dag</button>
                <button class="btn" onclick="RoutePlanner.moveFacilityToAdjacentDay(${batchIdx}, ${idx}, 1)" style="font-size: 0.7rem; padding: 0.2rem 0.5rem; background: #f1f5f9; color: #334155; border: 1px solid #e2e8f0;">Flytt dag →</button>
                <button class="btn" onclick="RoutePlanner.removeFacilityFromBatch(${batchIdx}, ${idx})" style="font-size: 0.7rem; padding: 0.2rem 0.5rem; background: #fee2e2; color: #7f1d1d; border: 1px solid #fecaca;">Slett</button>
              </div>
              <div style="margin-top: 0.35rem; font-size: 0.8rem; color: #6b7280;">
                🛠️ Operasjon: ${formatOperationTime(operationMinutes)}
              </div>
              ${riskBadge}
              ${diseaseBadge}
              ${nearbyDiseaseBadge}
              ${biosecurityWarning}
            </div>
            <div style="min-width: 150px;">
              <label style="display: block; font-size: 0.75rem; color: #6b7280; margin-bottom: 0.25rem; font-weight: 600;">Operasjon</label>
              <div style="display: flex; gap: 0.3rem; margin-bottom: 0.5rem;">
                <div style="flex: 1;">
                  <input
                    type="number"
                    min="0"
                    max="23"
                    value="${getOperationTimeHours(facility.id)}"
                    class="op-hours-input"
                    data-facility-id="${String(facility.id)}"
                    placeholder="t"
                    style="width: 100%; padding: 0.25rem; border: 1px solid #d1d5db; border-radius: 4px; font-size: 0.8rem; text-align: center;"
                  >
                  <div style="font-size: 0.65rem; color: #9ca3af; text-align: center;">timer</div>
                </div>
                <div style="flex: 1;">
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value="${getOperationTimeMinutes(facility.id)}"
                    class="op-minutes-input"
                    data-facility-id="${String(facility.id)}"
                    placeholder="min"
                    style="width: 100%; padding: 0.25rem; border: 1px solid #d1d5db; border-radius: 4px; font-size: 0.8rem; text-align: center;"
                  >
                  <div style="font-size: 0.65rem; color: #9ca3af; text-align: center;">min</div>
                </div>
              </div>
              <label style="display: block; font-size: 0.65rem; color: #6b7280; margin-bottom: 0.25rem;">Notat (max 50)</label>
              <input
                type="text"
                maxlength="50"
                value="${getFacilityComment(facility.id)}"
                class="facility-comment-input"
                data-facility-id="${String(facility.id)}"
                placeholder="f.eks. Kontaker..."
                style="width: 100%; padding: 0.25rem; border: 1px solid #d1d5db; border-radius: 4px; font-size: 0.75rem;"
              >
            </div>
            <div style="text-align: right; color: #6b7280; font-size: 0.85rem; min-width: 90px;">
              ${facility.infected ? '<br><span style="color: #ef4444; font-weight: 600;">⚠️ SMITTET</span>' : ''}
              ${facility.proximityRisk && !facility.infected ? '<br><span style="color: #f59e0b; font-weight: 600;">🟠 BW</span>' : ''}
              ${facility.localZoneRisk && !facility.infected ? '<br><span style="color: #facc15; font-weight: 600;">🟡 10 KM</span>' : ''}
            </div>
          </div>
        </div>
      `;
    });
    
    // Batch footer with totals and merge button
    const hasMergeBtn = batchIdx < batches.length - 1;
    const mergeBtn = hasMergeBtn 
      ? `<button class="btn" onclick="RoutePlanner.mergeBatches(${batchIdx})" style="margin-left: 0.5rem; font-size: 0.75rem; padding: 0.3rem 0.6rem; background: #10b981; color: white; border: none; border-radius: 4px; cursor: pointer;">Slå sammen med neste dag</button>`
      : '';

    html += `
      <div style="background: #f9fafb; padding: 0.75rem; border-top: 1px solid #e5e7eb; border-radius: 0 0 8px 8px; margin-top: 0.5rem; margin-left: -1rem; margin-right: -1rem; margin-bottom: -1rem;">
        <div style="padding: 0 1rem; font-size: 0.85rem; color: #374151; line-height: 1.6;">
          <strong>${batch.facilities.length} anlegg</strong> | 
          <strong>Kjøretid: ${formatTimeFromMinutes(batch.totalTimeMinutes)}</strong> | 
          <strong>Operasjon: ${formatTimeFromMinutes(batchOperationMinutes)}</strong> | 
          <strong style="color: #1f2937;">Totalt: ${formatTimeFromMinutes(batchWorkMinutes)}</strong>
          ${mergeBtn}
        </div>
      </div>
    `;
    
    // Show quarantine period after this batch if needed
    if (batch.needsQuarantine && !isLastBatch) {
      const nextBatch = batches[batchIdx + 1];
      const daysUntilNext = nextBatch.day - batch.day;
      
      html += `
        <div style="margin-top: 1rem; padding: 1rem; background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); color: #78350f; border-radius: 8px; font-weight: 600; text-align: center; border: 2px solid #f59e0b;">
          <div style="font-size: 1.2rem; margin-bottom: 0.25rem;">⏳ KARANTENEPERIODE</div>
          <div style="font-size: 0.9rem;">48 timer desinfeksjon + ventetid</div>
          <div style="font-size: 0.85rem; margin-top: 0.5rem; opacity: 0.9;">Neste besøk: Dag ${nextBatch.day} (om ${daysUntilNext} ${daysUntilNext === 1 ? 'dag' : 'dager'})</div>
        </div>
      `;
    }
    
    html += `</div>`;
  });
  
  container.style.display = 'block';
  details.innerHTML = html;
  
  // Add event listeners for operation time and comment inputs
  document.querySelectorAll('.op-hours-input').forEach(input => {
    input.addEventListener('change', function() {
      const facilityId = this.dataset.facilityId;
      const hours = parseInt(this.value, 10) || 0;
      const minInput = document.querySelector(`.op-minutes-input[data-facility-id="${facilityId}"]`);
      const minutes = minInput ? (parseInt(minInput.value, 10) || 0) : 0;
      setOperationTimeHoursMinutes(facilityId, hours, minutes);
    });
  });

  document.querySelectorAll('.op-minutes-input').forEach(input => {
    input.addEventListener('change', function() {
      const facilityId = this.dataset.facilityId;
      const minutes = parseInt(this.value, 10) || 0;
      const hourInput = document.querySelector(`.op-hours-input[data-facility-id="${facilityId}"]`);
      const hours = hourInput ? (parseInt(hourInput.value, 10) || 0) : 0;
      setOperationTimeHoursMinutes(facilityId, hours, minutes);
    });
  });

  document.querySelectorAll('.facility-comment-input').forEach(input => {
    input.addEventListener('change', function() {
      const facilityId = this.dataset.facilityId;
      setFacilityComment(facilityId, this.value);
    });
  });
  
  // Highlight facilities on map
  if (window.VesselMap && typeof window.VesselMap.highlightRouteFacilities === 'function') {
    const facilityIds = batches.flatMap(batch => 
      batch.facilities.map(f => f.id)
    );
    window.VesselMap.highlightRouteFacilities(facilityIds);
  }
}

// Helper function to format minutes into readable time format
function formatTimeFromMinutes(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  if (hours === 0) {
    return `${mins} min`;
  } else if (mins === 0) {
    return `${hours}t`;
  } else {
    return `${hours}t ${mins}min`;
  }
}

// Calculate actual arrival time (clock time) based on departure time + travel minutes
function calculateArrivalTime(travelMinutes, dayOffset = 0) {
  // If plannedRoute exists and has batches, use day-specific departure time
  if (plannedRoute && plannedRoute.batches && plannedRoute.batches[dayOffset]) {
    const batch = plannedRoute.batches[dayOffset];
    const departureTime = batch.departureTime || '07:30';
    
    // Parse departure time (HH:MM)
    const [depHour, depMin] = departureTime.split(':').map(Number);
    
    // Create a date object for calculation
    const arrivalDate = new Date();
    arrivalDate.setHours(depHour, depMin, 0, 0);
    
    // Add travel minutes
    arrivalDate.setMinutes(arrivalDate.getMinutes() + travelMinutes);
    
    // Format as HH:MM
    const hours = String(arrivalDate.getHours()).padStart(2, '0');
    const minutes = String(arrivalDate.getMinutes()).padStart(2, '0');
    
    return `${hours}:${minutes}`;
  }
  
  // Fallback: use global departure time input
  const departureTimeInput = document.getElementById('routeDepartureTime');
  const departureTime = departureTimeInput && departureTimeInput.value ? departureTimeInput.value : '07:30';
  
  // Parse departure time (HH:MM)
  const [depHour, depMin] = departureTime.split(':').map(Number);
  
  // Create a date object for calculation (use today + dayOffset)
  const arrivalDate = new Date();
  arrivalDate.setDate(arrivalDate.getDate() + dayOffset);
  arrivalDate.setHours(depHour, depMin, 0, 0);
  
  // Add travel minutes
  arrivalDate.setMinutes(arrivalDate.getMinutes() + travelMinutes);
  
  // Format as HH:MM
  const hours = String(arrivalDate.getHours()).padStart(2, '0');
  const minutes = String(arrivalDate.getMinutes()).padStart(2, '0');
  
  return `${hours}:${minutes}`;
}

// Clear planned route
function clearPlannedRoute() {
  plannedRoute = { batches: [], totalDays: 0, hasQuarantine: false };
  selectedFacilities.clear();
  
  const checkboxes = document.querySelectorAll('input[type="checkbox"]');
  checkboxes.forEach(cb => cb.checked = false);
  
  const container = document.getElementById('routePreview');
  if (container) container.style.display = 'none';
  
  // Clear map highlights
  if (window.VesselMap) {
    if (typeof window.VesselMap.clearRouteHighlights === 'function') {
      window.VesselMap.clearRouteHighlights();
    }
    if (typeof window.VesselMap.clearAllSelections === 'function') {
      window.VesselMap.clearAllSelections();
    }
  }
  
  updateSelectedCount();
  showToast('✓ Rute tømt', 'success');
}

function rebuildBatchFromExisting(originalBatch, facilities, day) {
  const totalDistance = facilities.reduce((sum, facility) => {
    return sum + (facility.distanceFromPrevious || 0);
  }, 0);
  const totalTimeMinutes = facilities.reduce((sum, facility) => {
    return sum + (facility.estTimeMinutes || 0);
  }, 0);
  const hasInfected = facilities.some(facility => facility.infected || facility.proximityRisk);

  return {
    ...originalBatch,
    day,
    facilities,
    totalDistance,
    totalTimeMinutes,
    hasInfected,
    needsQuarantine: hasInfected
  };
}

function recomputeRouteAfterManualEdit() {
  if (!plannedRoute || !plannedRoute.batches || plannedRoute.batches.length === 0) {
    displayPlannedRoute();
    return;
  }

  const boatSpeedKmPerHour = getBoatSpeed();
  const vesselPos = VesselStorage.getVesselData().vessel.position;
  let currentStart = { lat: vesselPos.lat, lon: vesselPos.lon };

  const updatedBatches = plannedRoute.batches
    .filter(batch => Array.isArray(batch.facilities) && batch.facilities.length > 0)
    .map((batch, index) => {
      const rebuilt = createBatchFromFacilities(batch.facilities, currentStart, index + 1, boatSpeedKmPerHour, getRouteMode());
      const lastFac = rebuilt.facilities[rebuilt.facilities.length - 1];
      if (lastFac) {
        currentStart = { lat: lastFac.lat, lon: lastFac.lon };
      }
      return rebuilt;
    });

  recalcBatchDays(updatedBatches);
  plannedRoute.batches = updatedBatches;
  plannedRoute.totalDays = updatedBatches.length
    ? updatedBatches[updatedBatches.length - 1].day
    : 0;
  plannedRoute.hasQuarantine = updatedBatches.some(b => b.needsQuarantine);
  displayPlannedRoute();
}

function removeFacilityFromBatch(batchIndex, facilityIndex) {
  if (!plannedRoute || !plannedRoute.batches || !plannedRoute.batches[batchIndex]) {
    return;
  }

  const batch = plannedRoute.batches[batchIndex];
  if (!batch.facilities || !batch.facilities[facilityIndex]) {
    return;
  }

  const [removed] = batch.facilities.splice(facilityIndex, 1);
  if (batch.facilities.length === 0) {
    plannedRoute.batches.splice(batchIndex, 1);
  }

  recomputeRouteAfterManualEdit();
  showToast(`✓ ${removed?.name || 'Anlegg'} fjernet fra ruten`, 'success');
}

function moveFacilityToAdjacentDay(batchIndex, facilityIndex, direction) {
  if (!plannedRoute || !plannedRoute.batches || !plannedRoute.batches[batchIndex]) {
    return;
  }

  const currentBatch = plannedRoute.batches[batchIndex];
  const facility = currentBatch.facilities?.[facilityIndex];
  if (!facility) {
    return;
  }

  const targetIndex = batchIndex + direction;
  if (targetIndex < 0) {
    showToast('Kan ikke flytte til forrige dag', 'warning');
    return;
  }

  currentBatch.facilities.splice(facilityIndex, 1);

  const targetBatch = plannedRoute.batches[targetIndex];
  const isRiskFacility = facility.infected || facility.proximityRisk;
  const targetHasRisk = targetBatch
    ? targetBatch.facilities.some(f => f.infected || f.proximityRisk)
    : false;

  if (isRiskFacility && targetHasRisk) {
    showToast('❌ Kan ikke ha flere smitte-/risikoanlegg på samme dag. Karantenereglene må følges.', 'error');
    return;
  }

  if (!plannedRoute.batches[targetIndex]) {
    plannedRoute.batches.splice(targetIndex, 0, {
      day: targetIndex + 1,
      facilities: [facility],
      totalDistance: 0,
      totalTimeMinutes: 0,
      hasInfected: false,
      needsQuarantine: false
    });
  } else {
    plannedRoute.batches[targetIndex].facilities.push(facility);
  }

  if (currentBatch.facilities.length === 0) {
    plannedRoute.batches.splice(batchIndex, 1);
  }

  recomputeRouteAfterManualEdit();
  showToast(`✓ ${facility.name} flyttet ${direction > 0 ? 'til neste dag' : 'til forrige dag'}`, 'success');
}

function recalcBatchDays(batches) {
  if (!Array.isArray(batches) || batches.length === 0) {
    return;
  }

  batches[0].day = 1;
  for (let i = 1; i < batches.length; i++) {
    const prev = batches[i - 1];
    batches[i].day = prev.day + (prev.needsQuarantine ? 3 : 1);
  }
}

function splitBatchByWorkload(batchIndex) {
  if (!plannedRoute || !plannedRoute.batches || !plannedRoute.batches[batchIndex]) {
    return;
  }

  const batch = plannedRoute.batches[batchIndex];

  // Check quarantine rules: Cannot split if batch has infected facilities
  // (infected = true means facility is registered as sick and requires quarantine)
  const infectedFacilityCount = batch.facilities.filter(f => f.infected).length;
  if (infectedFacilityCount > 0) {
    showToast('❌ Kan ikke dele dag med smittet anlegg. Karantene må respekteres (48t etter besøk)', 'error');
    return;
  }

  const workdayLimitMinutes = getWorkdayLimitMinutes();
  let runningMinutes = 0;
  let splitAt = -1;
  batch.facilities.forEach((facility, idx) => {
    runningMinutes += facility.estTimeMinutes + getOperationMinutesForFacility(facility.id);
    if (runningMinutes > workdayLimitMinutes && splitAt === -1) {
      splitAt = idx;
    }
  });

  if (splitAt <= 0 || splitAt >= batch.facilities.length) {
    showToast('Fant ikke en naturlig deling for denne dagen', 'info');
    return;
  }

  const firstFacilities = batch.facilities.slice(0, splitAt);
  const secondFacilities = batch.facilities.slice(splitAt);

  const firstBatch = rebuildBatchFromExisting(batch, firstFacilities, batch.day);
  const secondBatch = rebuildBatchFromExisting(batch, secondFacilities, batch.day + 1);

  const updatedBatches = [...plannedRoute.batches];
  updatedBatches.splice(batchIndex, 1, firstBatch, secondBatch);

  recalcBatchDays(updatedBatches);

  plannedRoute.batches = updatedBatches;
  plannedRoute.totalDays = updatedBatches.length
    ? updatedBatches[updatedBatches.length - 1].day
    : 0;
  plannedRoute.hasQuarantine = updatedBatches.some(b => b.needsQuarantine);

  displayPlannedRoute();
  showToast('✓ Dagen ble delt i to', 'success');
}

function mergeBatches(batchIndex) {
  if (!plannedRoute || !plannedRoute.batches || plannedRoute.batches.length < 2) {
    showToast('Må ha minst 2 dager for å slå sammen', 'warning');
    return;
  }

  if (batchIndex < 0 || batchIndex >= plannedRoute.batches.length - 1) {
    showToast('Kan ikke slå sammen denne dagen', 'warning');
    return;
  }

  const batch1 = plannedRoute.batches[batchIndex];
  const batch2 = plannedRoute.batches[batchIndex + 1];

  // CRITICAL: Check quarantine rules - cannot merge if EITHER batch has infected facilities
  // Infected facilities require 48-96 hour (3-day) quarantine spacing
  const hasInfectedInBatch1 = batch1.facilities.some(f => f.infected);
  const hasInfectedInBatch2 = batch2.facilities.some(f => f.infected);
  
  if (hasInfectedInBatch1 || hasInfectedInBatch2) {
    showToast('[KARANTENE BRUDD] Kan ikke slå sammen dag med smittet anlegg. Påkrevd: 48t karantene etter smittet besøk', 'error');
    return;
  }

  // Combine facilities from both batches
  const combinedFacilities = [...batch1.facilities, ...batch2.facilities];
  const mergedBatch = rebuildBatchFromExisting(batch1, combinedFacilities, batch1.day);

  // Replace both batches with the merged one
  const updatedBatches = [...plannedRoute.batches];
  updatedBatches.splice(batchIndex, 2, mergedBatch);

  recalcBatchDays(updatedBatches);

  plannedRoute.batches = updatedBatches;
  plannedRoute.totalDays = updatedBatches.length
    ? updatedBatches[updatedBatches.length - 1].day
    : 0;
  plannedRoute.hasQuarantine = updatedBatches.some(b => b.needsQuarantine);

  displayPlannedRoute();
  showToast('✓ Dager slått sammen', 'success');
}

// Execute route - start visiting facilities in order
function executeRoute() {
  if (!plannedRoute || !plannedRoute.batches || plannedRoute.batches.length === 0) {
    showToast('Planlegg en rute først', 'warning');
    return;
  }
  
  
  
  // Start with first batch
  const firstBatch = plannedRoute.batches[0];
  if (firstBatch.facilities.length > 0) {
    const firstDestination = firstBatch.facilities[0];
    
    // Update vessel position to first facility
    VesselMap.updateVesselMapPosition(firstDestination.lat, firstDestination.lon);
    
    // Flatten all facilities for storage
    const allFacilities = [];
    plannedRoute.batches.forEach(batch => {
      allFacilities.push(...batch.facilities);
    });
    
    // Save route to storage with biosecurity info
    VesselStorage.addRoute({
      name: `Rute ${new Date().toLocaleDateString('no-NO')} (${plannedRoute.totalDays} dager)`,
      facilities: allFacilities,
      batches: plannedRoute.batches,
      startTime: new Date(),
      status: 'active',
      biosecurity: {
        disinfectionRequired: allFacilities.some(f => f.disinfectionRequired),
        quarantineApplies: plannedRoute.hasQuarantine,
        totalDays: plannedRoute.totalDays
      }
    });
    
    showToast(`🚀 Rute startet! ${allFacilities.length} anlegg over ${plannedRoute.totalDays} dager. Første mål: ${firstDestination.name}`, 'success');
    
    // Show biosecurity reminder if needed
    if (firstDestination.disinfectionRequired) {
      setTimeout(() => {
        showToast('🧪 HUSK: Desinfeksjon påkrevd etter besøk!', 'warning');
      }, 2000);
    }
    
    if (plannedRoute.hasQuarantine) {
      setTimeout(() => {
        showToast(`⚠️ Ruten krever ${plannedRoute.totalDays} dager totalt pga. karantenetid`, 'warning');
      }, 4000);
    }
    
    clearPlannedRoute();
  }
}

// Log disinfection after facility visit
function logDisinfection(facilityName, method = 'Virkon S') {
  const timestamp = new Date();
  const log = {
    facility: facilityName,
    timestamp: timestamp.toISOString(),
    method: method,
    quarantineEnds: new Date(timestamp.getTime() + QUARANTINE_HOURS * 60 * 60 * 1000).toISOString()
  };
  
  // Store in localStorage
  const disinfectionLogs = JSON.parse(localStorage.getItem('disinfectionLog') || '[]');
  disinfectionLogs.push(log);
  localStorage.setItem('disinfectionLog', JSON.stringify(disinfectionLogs));
  
  
  return log;
}

// Check if vessel is in quarantine
function isInQuarantine() {
  const disinfectionLogs = JSON.parse(localStorage.getItem('disinfectionLog') || '[]');
  if (disinfectionLogs.length === 0) return false;
  
  const lastDisinfection = disinfectionLogs[disinfectionLogs.length - 1];
  const quarantineEnd = new Date(lastDisinfection.quarantineEnds);
  const now = new Date();
  
  return now < quarantineEnd;
}

// Get remaining quarantine time in hours
function getRemainingQuarantineHours() {
  const disinfectionLogs = JSON.parse(localStorage.getItem('disinfectionLog') || '[]');
  if (disinfectionLogs.length === 0) return 0;
  
  const lastDisinfection = disinfectionLogs[disinfectionLogs.length - 1];
  const quarantineEnd = new Date(lastDisinfection.quarantineEnds);
  const now = new Date();
  
  if (now >= quarantineEnd) return 0;
  
  const remainingMs = quarantineEnd - now;
  return remainingMs / (1000 * 60 * 60); // Convert to hours
}

// Add planned route to calendar
function addPlannedRouteToCalendar() {
  if (!plannedRoute || !plannedRoute.batches || plannedRoute.batches.length === 0) {
    showToast('Planlegg en rute først', 'warning');
    return;
  }

  const dateInput = document.getElementById('routePlanDate');
  const startDate = dateInput && dateInput.value
    ? new Date(dateInput.value)
    : new Date();

  // Add each batch to the calendar on the correct day
  plannedRoute.batches.forEach((batch) => {
    const batchDate = new Date(startDate);
    batchDate.setDate(batchDate.getDate() + (batch.day - 1));
    const batchDateStr = batchDate.toISOString().split('T')[0];
    
    if (typeof CalendarView !== 'undefined' && CalendarView.addPlannedRoute) {
      CalendarView.addPlannedRoute(batchDateStr, batch.facilities);
    }
  });
  
  showToast(`✓ Rute lagt til i kalender: ${plannedRoute.totalDays} dager planlagt`, 'success');
}

async function confirmPlannedRoute() {
  if (!plannedRoute || !plannedRoute.batches || plannedRoute.batches.length === 0) {
    showToast('Planlegg en rute først', 'warning');
    return;
  }

  const dateInput = document.getElementById('routePlanDate');
  const startDate = dateInput && dateInput.value
    ? new Date(dateInput.value)
    : new Date();

  const vesselData = VesselStorage.getVesselData();
  const meta = VesselStorage.getPositionMeta ? VesselStorage.getPositionMeta() : { source: 'MANUELL', updatedAt: null };

  const route = plannedRoute.batches.map((batch) => {
    const batchDate = new Date(startDate);
    batchDate.setDate(batchDate.getDate() + (batch.day - 1));
    return {
      day: batch.day,
      date: batchDate.toISOString().split('T')[0],
      needs_quarantine: batch.needsQuarantine === true,
      has_infected: batch.hasInfected === true,
      facilities: batch.facilities.map((facility) => ({
        id: facility.id,
        name: facility.name,
        latitude: facility.lat,
        longitude: facility.lon,
        infected: facility.infected === true,
        proximity_risk: facility.proximityRisk === true,
        operation_minutes: getOperationMinutesForFacility(facility.id),
        comment: getFacilityComment(facility.id)
      }))
    };
  });

  const payload = {
    mmsi: vesselData.vessel.mmsi,
    vessel_name: vesselData.vessel.name,
    callsign: vesselData.vessel.callsign,
    position: vesselData.vessel.position,
    position_source: meta.source,
    position_updated_at: meta.updatedAt,
    route,
    notes: `Planned route (${plannedRoute.totalDays} days)`
  };

  try {
    const response = await fetch(`${VesselStorage.API_BASE}/api/boat/plan/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `Server error ${response.status}`);
    }

    showToast('✅ Rute bekreftet og lagret på server', 'success');
  } catch (err) {
    console.error('Failed to confirm route:', err);
    showToast('❌ Kunne ikke lagre ruten på server', 'error');
  }
}

// Add route to calendar (with batches)
function addRouteToCalendar(route) {
  const calendar = VesselStorage.getCalendar();
  const startDate = new Date();
  
  if (route.batches) {
    // New batch-based route
    route.batches.forEach((batch, idx) => {
      const batchDate = new Date(startDate);
      batchDate.setDate(batchDate.getDate() + (batch.day - 1));
      
      const calendarEntry = {
        date: batchDate.toISOString().split('T')[0],
        type: 'route',
        day: batch.day,
        facilities: batch.facilities.map(f => ({ 
          name: f.name, 
          id: f.id, 
          infected: f.infected,
          proximityRisk: f.proximityRisk,
          diseases: f.diseases || [],
          nearbyDiseases: f.nearbyDiseases || []
        })),
        status: 'planned',
        hasInfected: batch.hasInfected
      };
      
      calendar.push(calendarEntry);
      
      // Add quarantine days
      if (batch.needsQuarantine && idx < route.batches.length - 1) {
        for (let i = 1; i <= 2; i++) {
          const qDate = new Date(batchDate);
          qDate.setDate(qDate.getDate() + i);
          calendar.push({
            date: qDate.toISOString().split('T')[0],
            type: 'quarantine',
            description: 'Karantene etter smittebesøk'
          });
        }
      }
    });
  } else {
    // Old format (flat route)
    const calendarEntry = {
      date: startDate.toISOString().split('T')[0],
      type: 'route',
      facilities: route.map(f => ({ name: f.name, id: f.id })),
      status: 'planned'
    };
    calendar.push(calendarEntry);
  }
  
  VesselStorage.saveCalendar(calendar);
}

// Get calendar entries
function getCalendarEntries() {
  const visits = VesselStorage.getVisits();
  const quarantine = VesselStorage.getQuarantineStatus();
  
  const entries = [];
  
  // Add planned batches from current route
  if (plannedRoute && plannedRoute.batches) {
    plannedRoute.batches.forEach((batch) => {
      entries.push({
        date: null, // Will be set per facility
        type: 'batch',
        batchData: batch,
        facilities: batch.facilities.map(f => ({
          id: f.id,
          name: f.name,
          infected: f.infected,
          proximityRisk: f.proximityRisk,
          operationMinutes: getOperationMinutesForFacility(f.id),
          comment: getFacilityComment(f.id),
          estTimeMinutes: f.estTimeMinutes
        }))
      });
    });
  }
  
  // Add visits
  visits.forEach(visit => {
    const date = new Date(visit.timestamp).toISOString().split('T')[0];
    entries.push({
      date,
      type: 'visit',
      facility: visit.facilityName,
      infected: visit.infected,
      disinfection: visit.disinfection
    });
  });
  
  // Add quarantine period
  if (quarantine.active) {
    let current = new Date(quarantine.startTime);
    while (current <= new Date(quarantine.endTime)) {
      entries.push({
        date: current.toISOString().split('T')[0],
        type: 'quarantine',
        facility: quarantine.reason
      });
      current.setDate(current.getDate() + 1);
    }
  }
  
  return entries.sort((a, b) => new Date(a.date || '2099-01-01') - new Date(b.date || '2099-01-01'));
}

// Load executed events (batches/facilities marked as done)
function getExecutedBatches() {
  const stored = localStorage.getItem('executedBatches');
  return stored ? new Set(JSON.parse(stored)) : new Set();
}

function saveExecutedBatches(executed) {
  localStorage.setItem('executedBatches', JSON.stringify(Array.from(executed)));
}

function markBatchAsExecuted(batchDay) {
  const executed = getExecutedBatches();
  executed.add(String(batchDay));
  saveExecutedBatches(executed);
}

function isBatchExecuted(batchDay) {
  return getExecutedBatches().has(String(batchDay));
}

// Display calendar with status (planned=red, executed=green)
function displayCalendar() {
  const container = document.getElementById('calendarView');
  if (!container) return;
  
  const entries = getCalendarEntries();
  let html = '<div style="padding: 1rem;">';
  
  if (!entries || entries.length === 0) {
    html += '<div style="color: #9ca3af; text-align: center; padding: 2rem;">Ingen planlagte ruter eller besøk</div>';
  } else {
    // Group batch entries and visits/quarantine by day
    const byDay = {};
    
    entries.forEach(entry => {
      if (entry.type === 'batch') {
        // For batch, create an entry per day (based on batch.day from batchData)
        entry.batchData.facilities.forEach((facility, idx) => {
          const timeSum = entry.batchData.facilities.slice(0, idx + 1).reduce((sum, f) => {
            return sum + f.estTimeMinutes + getOperationMinutesForFacility(f.id);
          }, 0);
          const batchTotalOp = entry.batchData.facilities.reduce((sum, f) => {
            return sum + getOperationMinutesForFacility(f.id);
          }, 0);
          
          const dayKey = entry.batchData.day;
          if (!byDay[dayKey]) byDay[dayKey] = [];
          byDay[dayKey].push({
            type: 'batch-facility',
            facility: facility,
            operationMinutes: getOperationMinutesForFacility(facility.id),
            comment: getFacilityComment(facility.id),
            batchTotalOp,
            timeSum,
            facilities: entry.batchData.facilities,
            batchDay: dayKey
          });
        });
      } else if (entry.date) {
        const dateKey = entry.date;
        if (!byDay[dateKey]) byDay[dateKey] = [];
        byDay[dateKey].push(entry);
      }
    });
    
    // Render by day/batch
    Object.entries(byDay).sort().forEach(([dayKey, dayEntries]) => {
      // Check if this is a batch day
      const batchEntry = dayEntries.find(e => e.type === 'batch-facility');
      if (batchEntry) {
        const isExecuted = isBatchExecuted(dayKey);
        const uniqueFacilities = batchEntry.facilities;
        const batchTotalOp = batchEntry.batchTotalOp || 0;
        const batchTotalDrive = uniqueFacilities.reduce((s, f) => s + (f.estTimeMinutes || 0), 0);
        const batchTotalWork = batchTotalDrive + batchTotalOp;
        
        const statusColor = isExecuted ? '#dcfce7' : '#fee2e2';  // Green if executed, red if planned
        const statusBorder = isExecuted ? '#22c55e' : '#ef4444';
        const statusText = isExecuted ? '✓ GJENNOMFØRT' : '○ PLANLAGT';
        const statusButtonText = isExecuted ? 'Angre' : 'Bekreft';
        
        html += `
          <div style="margin-bottom: 2rem;">
            <div style="background: ${statusColor}; padding: 1rem; border-left: 5px solid ${statusBorder}; border-radius: 4px; margin-bottom: 0.75rem;">
              <div style="display: flex; justify-content: space-between; align-items: start;">
                <div>
                  <h4 style="margin: 0 0 0.5rem 0; color: #1f2937; font-size: 1rem;">
                    📅 DAG ${dayKey} - ${uniqueFacilities.length} anlegg | ${statusText}
                  </h4>
                  <div style="font-size: 0.85rem; color: #4b5563; line-height: 1.5;">
                    <strong>Kjøretid:</strong> ${formatTimeFromMinutes(batchTotalDrive)} | 
                    <strong>Operasjon:</strong> ${formatTimeFromMinutes(batchTotalOp)} | 
                    <strong>Totalt:</strong> ${formatTimeFromMinutes(batchTotalWork)}
                  </div>
                </div>
                <button class="btn" style="background: ${statusBorder}; color: white; border: none; padding: 0.5rem 1rem; cursor: pointer; border-radius: 3px; font-size: 0.85rem;" 
                  onclick="RoutePlanner.toggleBatchExecuted(${dayKey})">
                  ${statusButtonText}
                </button>
              </div>
            </div>
            
            <!-- Facilities in batch -->
            <div style="margin-left: 1rem;">
        `;
        
        // List facilities in batch with operations and comments
        dayEntries.filter(e => e.type === 'batch-facility').forEach((entry, idx) => {
          const opTime = formatOperationTime(entry.operationMinutes);
          const commentText = entry.comment ? ` • ${entry.comment}` : '';
          const status = entry.facility.infected ? '🔴' : (entry.facility.proximityRisk ? '🟠' : '🟢');
          
          html += `
            <div style="background: white; padding: 0.7rem; margin-bottom: 0.5rem; border-left: 3px solid ${entry.facility.infected ? '#ef4444' : (entry.facility.proximityRisk ? '#f59e0b' : '#10b981')}; border-radius: 2px;">
              <div style="display: flex; justify-content: space-between; align-items: baseline; font-size: 0.85rem;">
                <div>
                  <strong>${status} ${entry.facility.name}</strong><br>
                  <small style="color: #6b7280;">Operasjon: ${opTime}${commentText}</small>
                </div>
                <div style="text-align: right; color: #6b7280; font-size: 0.8rem;">
                  <strong>ETA: ~${calculateArrivalTime(entry.timeSum, dayKey - 1)}</strong>
                </div>
              </div>
            </div>
          `;
        });
        
        html += `</div></div>`;
      } else {
        // Non-batch entries (visits, quarantine)
        const dateObj = new Date(dayKey + 'T00:00:00');
        const weekday = dateObj.toLocaleDateString('no-NO', { weekday: 'short' });
        const dateStr = dateObj.toLocaleDateString('no-NO');
        
        html += `<h4 style="margin: 0.5rem 0; color: #374151;">${weekday.toUpperCase()} ${dateStr}</h4>`;
        
        dayEntries.forEach(entry => {
          let icon = '📋';
          let bgColor = '#f3f4f6';
          
          if (entry.type === 'visit') {
            icon = entry.infected ? '⚠️' : '✓';
            bgColor = entry.infected ? '#fee2e2' : '#d1fae5';
          } else if (entry.type === 'quarantine') {
            icon = '⏱️';
            bgColor = '#fef3c7';
          }
          
          html += `
            <div style="background: ${bgColor}; padding: 0.75rem; margin-bottom: 0.5rem; border-radius: 4px; border-left: 4px solid ${bgColor}; font-size: 0.85rem;">
              <strong>${icon} ${entry.facility || entry.type}</strong>
              ${entry.disinfection ? '<br><small style="color: #6b7280;">🧼 Desinfisert</small>' : ''}
            </div>
          `;
        });
      }
    });
  }
  
  html += '</div>';
  container.innerHTML = html;
}

// Toggle batch execution status
function toggleBatchExecuted(batchDay) {
  if (isBatchExecuted(batchDay)) {
    const executed = getExecutedBatches();
    executed.delete(String(batchDay));
    saveExecutedBatches(executed);
  } else {
    markBatchAsExecuted(batchDay);
  }
  displayCalendar();
}

/**
 * Del båtrute med anlegget - sender info til anleggets kalender
 * @param {number} batchIndex - Indeks på dagen
 * @param {number} facilityIndex - Indeks på anlegget i dagen
 */
async function shareFacilityRoute(batchIndex, facilityIndex) {
  if (!plannedRoute || !plannedRoute.batches[batchIndex]) {
    showToast('Ruten er ikke planlagt ennå', 'warning');
    return;
  }

  const batch = plannedRoute.batches[batchIndex];
  const facility = batch.facilities?.[facilityIndex];
  if (!facility) {
    showToast('Anlegget ble ikke funnet', 'error');
    return;
  }

  // Get vessel name from storage
  const vesselData = VesselStorage.getVesselData();
  const vesselName = vesselData?.vessel?.name || 'Ukjent båt';
  const vesselMMSI = vesselData?.vessel?.mmsi || 0;

  // Create modal to send route to facility
  const visitDate = new Date();
  visitDate.setDate(visitDate.getDate() + batchIndex); // Add days for batch

  // Fetch facility availability from API
  let availabilityHtml = '<p style="color: #6b7280; font-size: 12px;">Laster tilgjengelighet...</p>';
  try {
    const response = await fetch(`http://localhost:8000/api/facilities/${facility.code}/availability`);
    if (response.ok) {
      const availability = await response.json();
      const availDays = availability.available_days.join(', ');
      const notes = availability.notes || 'Ingen merknader';
      
      availabilityHtml = `
        <div style="background: #f0f9ff; padding: 10px; border-radius: 6px; margin-bottom: 15px; border-left: 4px solid #3b82f6;">
          <div style="font-weight: 600; color: #1e40af; margin-bottom: 5px;">📅 Anleggets tilgjengelighet:</div>
          <div style="font-size: 13px; color: #1e40af;">Tilgjengelig: ${availDays}</div>
          ${notes !== 'Ingen merknader' ? `<div style="font-size: 12px; color: #6b7280; margin-top: 5px;">📝 ${notes}</div>` : ''}
        </div>
      `;
    }
  } catch (e) {
    console.warn('Could not fetch availability:', e);
  }

  const modalContent = `
    <div style="background: white; padding: 20px; border-radius: 8px; max-width: 500px;">
      <h3>📤 Del rute med ${facility.name}</h3>
      
      ${availabilityHtml}
      
      <div style="margin: 15px 0;">
        <label style="display: block; margin-bottom: 5px; font-weight: 600;">Båt:</label>
        <input type="text" id="shareRouteBBoat" value="${vesselName}" readonly style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; background: #f5f5f5;">
      </div>

      <div style="margin: 15px 0;">
        <label style="display: block; margin-bottom: 5px; font-weight: 600;">Dato:</label>
        <input type="date" id="shareRouteBDate" value="${visitDate.toISOString().split('T')[0]}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
      </div>

      <div style="margin: 15px 0;">
        <label style="display: block; margin-bottom: 5px; font-weight: 600;">Anslått tid:</label>
        <input type="time" id="shareRouteBTime" value="10:00" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
      </div>

      <div style="margin: 15px 0;">
        <label style="display: block; margin-bottom: 5px; font-weight: 600;">Kontaktperson (valgfri):</label>
        <input type="text" id="shareRouteBContact" placeholder="Navn og telefon" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
      </div>

      <div style="margin: 15px 0;">
        <label style="display: block; margin-bottom: 5px; font-weight: 600;">Notater (valgfri):</label>
        <textarea id="shareRouteBNotes" placeholder="Eks: Fra ruteplanleggeren..." style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; height: 80px; resize: none;"></textarea>
      </div>

      <div style="display: flex; gap: 10px; margin-top: 20px;">
        <button onclick="RoutePlanner.confirmShareRoute('${facility.code}', '${facility.name}', ${vesselMMSI})" style="flex: 1; padding: 10px; background: #10b981; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600;">✓ Send forespørsel</button>
        <button onclick="closeModal()" style="flex: 1; padding: 10px; background: #e5e7eb; color: #333; border: none; border-radius: 4px; cursor: pointer;">Avbryt</button>
      </div>
    </div>
  `;

  showModal(modalContent);
}

/**
 * Bekreftet å dele rute med anlegget - sender til backend API
 */
async function confirmShareRoute(facilityCode, facilityName, vesselMMSI) {
  const vesselName = document.getElementById('shareRouteBBoat')?.value || 'Ukjent';
  const dateStr = document.getElementById('shareRouteBDate')?.value || '';
  const timeStr = document.getElementById('shareRouteBTime')?.value || '10:00';
  const contact = document.getElementById('shareRouteBContact')?.value || '';
  const notes = document.getElementById('shareRouteBNotes')?.value || '';

  if (!dateStr) {
    showToast('Vennligst velg en dato', 'error');
    return;
  }

  // Send to backend API
  try {
    const response = await fetch('http://localhost:8000/api/route-proposals', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        mmsi: vesselMMSI,
        vessel_name: vesselName,
        facility_code: facilityCode,
        facility_name: facilityName,
        proposed_date: dateStr,
        proposed_time: timeStr,
        contact_person: contact,
        notes: notes,
        operation_type: 'visit'
      })
    });

    const result = await response.json();

    if (response.ok && result.success) {
      showToast(`✓ Forespørsel sendt til ${facilityName}`, 'success');
      
      // Also store locally for backup
      const key = `routeProposal_${result.proposal_id}`;
      localStorage.setItem(key, JSON.stringify(result.proposal));
      
      closeModal();
    } else if (result.error === 'date_not_available') {
      // Date is not on a green day
      const availDays = result.available_days.join(', ');
      showToast(`⚠️ Anlegget tar ikke imot besøk på valgt dag. Tilgjengelig: ${availDays}`, 'warning', 5000);
    } else {
      showToast('Feil ved sending av forespørsel', 'error');
    }
  } catch (e) {
    console.error('Error sharing route:', e);
    showToast('Kunne ikke koble til server', 'error');
  }
}

// Update departure time for a specific day
function updateDayDeparture(batchIdx, newTime) {
  if (!plannedRoute || !plannedRoute.batches || !plannedRoute.batches[batchIdx]) {
    console.error('Invalid batch index:', batchIdx);
    return;
  }
  
  plannedRoute.batches[batchIdx].departureTime = newTime;
  
  // Refresh display to show updated ETAs
  displayPlannedRoute();
  
  showToast(`✓ Oppdatert avreise for dag ${batchIdx + 1} til ${newTime}`, 'success');
}

// Export functions
window.RoutePlanner = {
  initRoutePlanner,
  planOptimalRoute,
  clearPlannedRoute,
  executeRoute,
  addPlannedRouteToCalendar,
  confirmPlannedRoute,
  getCalendarEntries,
  displayCalendar,
  addRouteToCalendar,
  logDisinfection,
  isInQuarantine,
  getRemainingQuarantineHours,
  setOperationMinutes: setOperationMinutesForFacility,
  setOpTimeHM: setOperationTimeHoursMinutes,
  setComment: setFacilityComment,
  splitBatchByWorkload,
  mergeBatches,
  removeFacilityFromBatch,
  moveFacilityToAdjacentDay,
  toggleBatchExecuted,
  shareFacilityRoute,
  confirmShareRoute,
  updateDayDeparture
};
// Add facility to route planner (called from map clicks)
function addFacilityToRoutePlanner(facility) {
  // Check if already selected
  const already = Array.from(selectedFacilities).find(f => f.id === facility.id);
  if (already) {
    showToast(`${facility.name} er allerede valgt`, 'info');
    
    // Scroll to checkbox
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(cb => {
      if (cb.dataset.name === facility.name) {
        cb.scrollIntoView({ behavior: 'smooth' });
      }
    });
    return;
  }
  
  // Add to selected
  selectedFacilities.add(facility);
  
  // Update UI by checking the checkbox
  const checkboxes = document.querySelectorAll('input[type="checkbox"]');
  checkboxes.forEach(cb => {
    if (cb.dataset.name === facility.name) {
      cb.checked = true;
    }
  });
  
  updateSelectedCount();
  showToast(`✓ ${facility.name} lagt til i rute`, 'success');
  
  // Auto-open route planner modal if not already open
  const modal = document.getElementById('routePlannerModal');
  if (modal && !modal.classList.contains('show')) {
    showRoutePlanner();
  }
}

window.addFacilityToRoutePlanner = addFacilityToRoutePlanner;
