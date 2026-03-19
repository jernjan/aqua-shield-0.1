/**
 * vessel-map.js
 * Handles map display with Leaflet
 */

// Helper function to format B-survey status
function formatBSurveyStatus(bSurvey) {
  if (!bSurvey || !bSurvey.site_condition) return '--';
  const condition = bSurvey.site_condition;
  const labels = {
    1: 'meget god',
    2: 'god',
    3: 'dårlig',
    4: 'meget dårlig'
  };
  return labels[condition] || '--';
}

let map = null;
let vesselMarker = null;
let facilityMarkers = [];
let proximityCircles = [];
let facilitiesData = [];

function parseFacilityCoordinate(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;

  const normalized = String(value).trim().replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseCoordinatePairFromArray(coords) {
  if (!Array.isArray(coords) || coords.length < 2) return { latitude: null, longitude: null };

  const first = parseFacilityCoordinate(coords[0]);
  const second = parseFacilityCoordinate(coords[1]);

  if (Number.isFinite(first) && Number.isFinite(second)) {
    // Most GeoJSON arrays are [lon, lat]
    const asLonLat = {
      longitude: first,
      latitude: second
    };
    if (Math.abs(asLonLat.latitude) <= 90 && Math.abs(asLonLat.longitude) <= 180) {
      return asLonLat;
    }

    // Fallback in case source is [lat, lon]
    const asLatLon = {
      latitude: first,
      longitude: second
    };
    if (Math.abs(asLatLon.latitude) <= 90 && Math.abs(asLatLon.longitude) <= 180) {
      return asLatLon;
    }
  }

  return { latitude: null, longitude: null };
}

function normalizeFacilityRecord(facility) {
  const arrayCoords = parseCoordinatePairFromArray(
    facility.coordinates
      ?? facility.coord
      ?? facility.location?.coordinates
      ?? facility.position?.coordinates
      ?? facility.geo?.coordinates
      ?? facility.geometry?.coordinates
  );

  const latitude = parseFacilityCoordinate(
    facility.latitude
      ?? facility.lat
      ?? facility.location?.latitude
      ?? facility.location?.lat
      ?? facility.position?.latitude
      ?? facility.position?.lat
      ?? facility.geo?.latitude
      ?? facility.geo?.lat
      ?? arrayCoords.latitude
  );
  const longitude = parseFacilityCoordinate(
    facility.longitude
      ?? facility.lon
      ?? facility.lng
      ?? facility.location?.longitude
      ?? facility.location?.lon
      ?? facility.location?.lng
      ?? facility.position?.longitude
      ?? facility.position?.lon
      ?? facility.position?.lng
      ?? facility.geo?.longitude
      ?? facility.geo?.lon
      ?? facility.geo?.lng
      ?? arrayCoords.longitude
  );

  return {
    ...facility,
    latitude,
    longitude,
    diseases: facility.diseases || facility.diseaseInfo?.diseases || []
  };
}

function isAbortError(error) {
  if (!error) return false;
  const name = String(error.name || '').toLowerCase();
  const message = String(error.message || '').toLowerCase();
  return name === 'aborterror' || message.includes('aborted') || message.includes('timeout');
}

function getErrorMessage(error) {
  if (typeof error === 'string') return error;
  if (error?.message) return String(error.message);
  if (error?.name) return String(error.name);
  try {
    return JSON.stringify(error);
  } catch (_) {
    return String(error || 'Unknown error');
  }
}

function saveBarentsWatchCache(data) {
  try {
    localStorage.setItem('vesselBarentsWatchCacheV1', JSON.stringify({
      ts: Date.now(),
      data
    }));
  } catch (_) {
    // Ignore storage errors
  }
}

function loadBarentsWatchCache(maxAgeMs = 12 * 60 * 60 * 1000) {
  try {
    const raw = localStorage.getItem('vesselBarentsWatchCacheV1');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.data) return null;
    const age = Date.now() - Number(parsed.ts || 0);
    if (!Number.isFinite(age) || age < 0 || age > maxAgeMs) return null;
    return parsed.data;
  } catch (_) {
    return null;
  }
}

function mergeBarentsWatchRiskData(data) {
  const atRiskFacilities = data?.all_at_risk_facilities || [];
  if (!Array.isArray(atRiskFacilities) || atRiskFacilities.length === 0) {
    return 0;
  }

  let matched = 0;
  const facilitiesByCode = new Map();

  facilitiesData.forEach(facility => {
    const code = facility.localityNo ?? facility.locality_no ?? facility.facility_code ?? facility.id;
    if (code !== undefined && code !== null) {
      facilitiesByCode.set(String(code), facility);
    }
  });

  atRiskFacilities.forEach(riskFacility => {
    let matching = null;

    const riskCode = riskFacility.facility_code;
    if (riskCode !== undefined && riskCode !== null) {
      matching = facilitiesByCode.get(String(riskCode)) || null;
    }

    if (!matching && riskFacility.facility_name) {
      const riskName = riskFacility.facility_name.toLowerCase().trim();
      matching = facilitiesData.find(f => f.name && f.name.toLowerCase().trim() === riskName);
    }

    if (!matching && riskFacility.position) {
      const rLat = parseFacilityCoordinate(riskFacility.position.latitude);
      const rLon = parseFacilityCoordinate(riskFacility.position.longitude);
      if (Number.isFinite(rLat) && Number.isFinite(rLon)) {
        matching = facilitiesData.find(f => {
          if (!Number.isFinite(f.latitude) || !Number.isFinite(f.longitude)) return false;
          const dist = calculateDistance(f.latitude, f.longitude, rLat, rLon);
          return dist <= 1;
        });
      }
    }

    if (matching) {
      matched++;
      let diseasesFromNeighbors = [];

      if (Array.isArray(riskFacility.all_nearby_diseases)) {
        const diseaseSet = new Set();
        riskFacility.all_nearby_diseases.forEach(neighbor => {
          if (Array.isArray(neighbor?.diseases)) {
            neighbor.diseases.forEach(d => diseaseSet.add(d));
          }
        });
        diseasesFromNeighbors = Array.from(diseaseSet);
      }

      matching.barentsWatchRisk = {
        risk_level: riskFacility.risk_level,
        zone_type: riskFacility.zone_type || riskFacility.zoneType || null,
        risk_score: riskFacility.risk_score,
        nearby_diseased_count: riskFacility.nearby_diseased_facilities_count,
        highest_risk_neighbor: riskFacility.highest_risk_neighbor
      };

      if (diseasesFromNeighbors.length > 0) {
        matching.nearbyDiseases = diseasesFromNeighbors;
      }
    }
  });

  return matched;
}

async function fetchFacilitiesPageWithRetry(url, maxAttempts = 3, timeoutMs = 120000) {
  let attempt = 0;

  while (attempt < maxAttempts) {
    attempt += 1;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      const retryable = isAbortError(error);
      const hasMoreAttempts = attempt < maxAttempts;

      if (!retryable || !hasMoreAttempts) {
        throw error;
      }

      await new Promise(resolve => setTimeout(resolve, attempt * 700));
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return { facilities: [] };
}

async function fetchAllFacilitiesPaged() {
  const limit = 500;
  let skip = 0;
  const allFacilities = [];

  while (true) {
    const url = `${VesselStorage.API_BASE}/api/facilities?limit=${limit}&skip=${skip}&include_geo=true`;

    const data = await fetchFacilitiesPageWithRetry(url, 3, 120000);
    const pageFacilities = data.facilities || [];
    allFacilities.push(...pageFacilities);

    if (pageFacilities.length < limit) {
      break;
    }

    skip += limit;
    if (skip > 10000) {
      break;
    }
  }

  return allFacilities;
}

async function fetchRemainingFacilitiesPaged(startSkip = 500, limit = 500) {
  let skip = startSkip;
  const additionalFacilities = [];

  while (true) {
    const url = `${VesselStorage.API_BASE}/api/facilities?limit=${limit}&skip=${skip}&include_geo=true`;
    const data = await fetchFacilitiesPageWithRetry(url, 2, 45000);
    const pageFacilities = data.facilities || [];

    if (!Array.isArray(pageFacilities) || pageFacilities.length === 0) {
      break;
    }

    additionalFacilities.push(...pageFacilities);

    if (pageFacilities.length < limit) {
      break;
    }

    skip += limit;
    if (skip > 10000) {
      break;
    }
  }

  return additionalFacilities;
}

function mergeFacilitiesByIdentity(baseFacilities, additionalFacilities) {
  const merged = [];
  const seen = new Set();

  const toKey = (facility) => {
    const code = facility?.localityNo ?? facility?.locality_no ?? facility?.facility_code ?? facility?.id;
    if (code !== null && code !== undefined && String(code).trim() !== '') {
      return `code:${String(code).trim()}`;
    }

    const name = String(facility?.name || '').trim().toLowerCase();
    const lat = Number.isFinite(facility?.latitude) ? facility.latitude.toFixed(5) : 'na';
    const lon = Number.isFinite(facility?.longitude) ? facility.longitude.toFixed(5) : 'na';
    return `name:${name}|${lat}|${lon}`;
  };

  [...baseFacilities, ...additionalFacilities].forEach((facility) => {
    const key = toKey(facility);
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(facility);
  });

  return merged;
}

function isLiceHighFacility(facility) {
  if (!facility || typeof facility !== 'object') return false;
  return facility.liceHigh === true
    || facility.lice_over_threshold === true
    || facility?.lice?.over_threshold === true;
}

function normalizeRiskLevel(level) {
  if (level === null || level === undefined) return '';
  return String(level)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function isSignificantBarentsRisk(level) {
  const normalized = normalizeRiskLevel(level);
  return normalized === 'moderat'
    || normalized === 'moderate'
    || normalized === 'hoy'
    || normalized === 'high'
    || normalized === 'ekstrem'
    || normalized === 'extreme'
    || normalized === 'protection'
    || normalized === 'surveillance'
    || normalized === 'critical';
}

function getBarentsWatchZoneType(riskObject) {
  if (!riskObject || typeof riskObject !== 'object') return null;

  const candidates = [riskObject.zone_type, riskObject.zoneType, riskObject.risk_level, riskObject.riskLevel]
    .filter(value => value !== null && value !== undefined)
    .map(value => String(value).trim().toUpperCase());

  if (candidates.includes('PROTECTION')) return 'PROTECTION';
  if (candidates.includes('SURVEILLANCE')) return 'SURVEILLANCE';
  return null;
}

function applySplitMarkerStyle(element, markerClass, liceHigh) {
  if (!element) return;

  const baseColorMap = {
    'facility-marker-red': '#ef4444',
    'facility-marker-orange': '#f59e0b',
    'facility-marker-amber': '#fbbf24',
    'facility-marker-pink': '#facc15',
    'facility-marker-yellow': '#eab308',
    'facility-marker-green': '#10b981',
    'facility-marker-purple': '#7c3aed'
  };

  const baseColor = baseColorMap[markerClass] || '#10b981';
  const shouldSplit = liceHigh === true && ['facility-marker-red', 'facility-marker-orange', 'facility-marker-amber', 'facility-marker-pink', 'facility-marker-yellow'].includes(markerClass);
  element.style.background = shouldSplit
    ? `linear-gradient(90deg, ${baseColor} 0 50%, #7c3aed 50% 100%)`
    : baseColor;
}

// Initialize map
async function initMap() {
  const mapElement = document.getElementById('map');
  
  
  
  
  if (!mapElement) {
    console.error('❌ Map element not found!');
    return;
  }
  
  // Check if Leaflet is loaded
  
  
  
  if (typeof L === 'undefined') {
    console.error('❌ Leaflet library not loaded! CDN may be unavailable.');
    
    
    // Check if CSS is loaded
    const leafletCss = document.querySelector('link[href*="leaflet.css"]');
    
    
    // Check all script tags
    const scripts = document.querySelectorAll('script[src*="leaflet"]');
    
    
    mapElement.innerHTML = `
      <div style="padding: 2rem; background: linear-gradient(135deg, #fee2e2 0%, #fff5f5 100%); 
                  color: #991b1b; border-radius: 4px; text-align: center; min-height: 200px; 
                  display: flex; align-items: center; justify-content: center; flex-direction: column;">
        <div style="font-size: 2rem; margin-bottom: 1rem;">⚠️</div>
        <h3 style="margin: 0 0 0.5rem 0;">Kartvisualisering utilgjengelig</h3>
        <p style="margin: 0; font-size: 0.9rem;">Leaflet-biblioteket kunne ikke lastes fra CDN.</p>
        <p style="margin: 0.5rem 0 0 0; font-size: 0.85rem; opacity: 0.8;">
          Prøv:<br>
          1. Refresh siden (Ctrl+R)<br>
          2. Sjekk internettforbindelsen<br>
          3. Deaktiver nettfiltrering/proxy
        </p>
      </div>
    `;
    return;
  }
  
  const vesselData = VesselStorage.getVesselData();
  const pos = vesselData.vessel.position;
  
  
  
  try {
    // Create map centered on vessel position
    map = L.map('map').setView([pos.lat, pos.lon], 10);
    
    
    
    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 18
    }).addTo(map);
    
    
    
    // Add vessel marker
    addVesselMarker(pos.lat, pos.lon);
    
    
    
    // Load and display facilities
    await loadFacilities();
    
    
  } catch (error) {
    console.error('❌ Map initialization error:', error);
    console.error('Error details:', error.stack);
    mapElement.innerHTML = `<div style="padding: 1rem; background: #fee2e2; color: #991b1b; border-radius: 4px;">
      ❌ Kartfeil: ${error.message}<br>
      <span style="font-size: 0.85rem; opacity: 0.7;">Se F12 konsoll for detaljer</span>
    </div>`;
  }
}

// Add vessel marker
function addVesselMarker(lat, lon) {
  if (vesselMarker) {
    map.removeLayer(vesselMarker);
  }

  const vesselData = VesselStorage.getVesselData();
  const vessel = vesselData.vessel;

  // Determine nearest facility and use its risk-status to color the boat:
  // - 🔴 hvis båten er ved smittet anlegg
  // - 🟠 hvis båten er ved anlegg i BarentsWatch smittesone
  // - 🟡 hvis båten er ved et friskt anlegg som ligger i 10km-sone
  // - 🟢 ellers (ingen spesiell risiko fra nærmeste anlegg)
  let vesselRiskClass = 'vessel-marker-green';
  let nearestFacilityName = null;
  let nearestFacilityRisk = 'Ingen spesiell risiko';
  let nearestDistanceKm = null;

  if (Array.isArray(facilitiesData) && facilitiesData.length > 0) {
    let closest = null;
    let closestDist = Infinity;

    facilitiesData.forEach(facility => {
      const fLat = facility.latitude;
      const fLon = facility.longitude;
      if (!Number.isFinite(fLat) || !Number.isFinite(fLon)) return;

      const dist = calculateDistance(lat, lon, fLat, fLon);
      if (dist < closestDist) {
        closestDist = dist;
        closest = facility;
      }
    });

    // Kun hvis båten faktisk er "ved" en lokalitet (f.eks. innen 1 km)
    if (closest && closestDist <= 1) {
      const infected = isInfected(closest);
      const liceHigh = isLiceHighFacility(closest);
      const bwRisk = closest.proximityRisk === true; // BarentsWatch smittesone
      const localZone = closest.localZoneRisk === true && !infected && !bwRisk; // 10km-buffet rundt smittet anlegg

      nearestFacilityName = closest.name || 'Ukjent anlegg';
      nearestDistanceKm = closestDist;

      if (infected) {
        vesselRiskClass = 'vessel-marker-red';
        nearestFacilityRisk = 'Smittet anlegg';
      } else if (liceHigh) {
        vesselRiskClass = 'vessel-marker-purple';
        nearestFacilityRisk = 'Høye lusetall';
      } else if (bwRisk) {
        vesselRiskClass = 'vessel-marker-orange';
        nearestFacilityRisk = 'Anlegg i smittesone (BW)';
      } else if (localZone) {
        vesselRiskClass = 'vessel-marker-yellow';
        nearestFacilityRisk = 'Friskt anlegg i 10km-sone';
      }
    }
  }

  const vesselIcon = L.divIcon({
    className: `vessel-marker ${vesselRiskClass}`,
    html: '🚢',
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });

  let popupHtml = `
      <strong>${vessel.name}</strong><br>
      MMSI: ${vessel.mmsi}<br>
      Posisjon: ${lat.toFixed(4)}, ${lon.toFixed(4)}
    `;

  if (nearestFacilityName && nearestDistanceKm !== null) {
    popupHtml += `<br><br><strong>Nærmeste anlegg:</strong><br>${nearestFacilityName} (${nearestDistanceKm.toFixed(1)} km)<br>`;
    popupHtml += `<span style="font-size: 0.85rem; color: #4b5563;">Risiko-status: ${nearestFacilityRisk}</span>`;
  }

  vesselMarker = L.marker([lat, lon], { icon: vesselIcon })
    .addTo(map)
    .bindPopup(popupHtml);
}

// Load facilities from API
async function loadFacilities() {
  try {
    const limit = 500;
    const firstPageUrl = `${VesselStorage.API_BASE}/api/facilities?limit=${limit}&skip=0&include_geo=true`;
    const firstPageData = await fetchFacilitiesPageWithRetry(firstPageUrl, 2, 25000);
    const firstPageFacilities = Array.isArray(firstPageData?.facilities) ? firstPageData.facilities : [];

    if (firstPageFacilities.length === 0) {
      throw new Error('No facilities returned from API');
    }

    facilitiesData = firstPageFacilities.map(normalizeFacilityRecord);

    try {
      localStorage.setItem('vesselFacilitiesCacheV1', JSON.stringify({
        ts: Date.now(),
        facilities: facilitiesData
      }));
    } catch (_) {
      // Ignore storage errors
    }
    
    displayFacilities();

    if (firstPageFacilities.length >= limit) {
      fetchRemainingFacilitiesPaged(limit, limit)
        .then((remainingRawFacilities) => {
          if (!Array.isArray(remainingRawFacilities) || remainingRawFacilities.length === 0) {
            return;
          }

          const normalizedRemaining = remainingRawFacilities.map(normalizeFacilityRecord);
          facilitiesData = mergeFacilitiesByIdentity(facilitiesData, normalizedRemaining);

          try {
            localStorage.setItem('vesselFacilitiesCacheV1', JSON.stringify({
              ts: Date.now(),
              facilities: facilitiesData
            }));
          } catch (_) {
            // Ignore storage errors
          }

          displayFacilities();
        })
        .catch((remainingError) => {
          console.warn('⚠️ Failed to load remaining facility pages:', getErrorMessage(remainingError));
        });
    }

    // Load BarentsWatch disease-spread data in background and repaint when done.
    enrichWithBarentsWatchData()
      .then(() => {
        try {
          displayFacilities();
        } catch (_) {
          // Ignore repaint errors
        }
      })
      .catch((enrichError) => {
        console.warn('⚠️ Disease-spread enrichment failed, continuing with base facilities:', getErrorMessage(enrichError));
      });
  } catch (error) {
    console.error('❌ Failed to load facilities from API:', getErrorMessage(error));

    // Try cached facilities first (better than mock)
    try {
      const cached = localStorage.getItem('vesselFacilitiesCacheV1');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed?.facilities) && parsed.facilities.length > 0) {
          facilitiesData = parsed.facilities.map(normalizeFacilityRecord);

          displayFacilities();

          enrichWithBarentsWatchData()
            .then(() => {
              try {
                displayFacilities();
              } catch (_) {
                // Ignore repaint errors
              }
            })
            .catch((enrichError) => {
              console.warn('⚠️ Disease-spread enrichment failed on cached facilities:', getErrorMessage(enrichError));
            });

          if (typeof showToast === 'function') {
            showToast('API treg/offline. Viser sist lagrede anlegg.', 'warning');
          }
          return;
        }
      }
    } catch (_) {
      // ignore cache read errors
    }
    
    // Use mock data as fallback
    
    facilitiesData = getMockFacilities();
    
    
    displayFacilities();
    
    // Show warning to user
    if (typeof showToast === 'function') {
      showToast('Advarsel: Kunne ikke laste data fra API. Viser eksempeldata.', 'warning');
    }
  }
}

// Enrich facilities with BarentsWatch disease-spread data
async function enrichWithBarentsWatchData() {
  let timeoutId = null;
  try {
    let diseaseData = null;

    try {
      const url = `${VesselStorage.API_BASE}/api/facilities/disease-spread`;
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      });

      if (response.ok) {
        diseaseData = await response.json();
      } else {
        console.warn(`⚠️ Could not load BarentsWatch data (${response.status}), trying snapshot fallback.`);
      }
    } finally {
      clearTimeout(timeoutId);
      timeoutId = null;
    }

    if (!diseaseData) {
      try {
        const snapshotController = new AbortController();
        timeoutId = setTimeout(() => snapshotController.abort(), 20000);
        const snapshotResponse = await fetch(`${VesselStorage.API_BASE}/api/facility-dashboard/snapshot`, {
          signal: snapshotController.signal,
          headers: { 'Accept': 'application/json' },
          cache: 'no-store'
        });

        if (snapshotResponse.ok) {
          const snapshot = await snapshotResponse.json();
          if (snapshot?.disease_spread) {
            diseaseData = snapshot.disease_spread;
          }
        }
      } catch (_) {
        // Ignore snapshot fallback errors and use cache fallback below
      } finally {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    }

    if (!diseaseData) {
      diseaseData = loadBarentsWatchCache();
      if (diseaseData) {
        console.info('ℹ️ Using cached BarentsWatch data while API is slow.');
      }
    }

    if (!diseaseData) {
      console.warn('⚠️ No BarentsWatch risk data available yet; showing facilities without orange BW overlay.');
      return;
    }

    const matched = mergeBarentsWatchRiskData(diseaseData);
    if (matched > 0) {
      saveBarentsWatchCache(diseaseData);
    }
  } catch (error) {
    const message = getErrorMessage(error);
    if (isAbortError(error)) {
      console.warn('⚠️ BarentsWatch disease-spread request timed out, trying cache/snapshot fallback.');
    } else {
      console.warn('⚠️ Failed to load BarentsWatch disease-spread data:', message);
    }
    // Continue without BarentsWatch - not critical, facilities already have basic data
  } finally {
    clearTimeout(timeoutId);
  }
}

function getMockFacilities() {
  return [
    {
      id: 1,
      name: 'Nordlaks Anlegg 1',
      locality: 'Trondheim',
      latitude: 63.4500,
      longitude: 10.4000,
      species: 'Laks',
      diseases: ['FRANCISELLOSE']
    },
    {
      id: 2,
      name: 'Havbruk Nord', 
      locality: 'Frøya',
      latitude: 63.5000,
      longitude: 10.2000,
      species: 'Laks',
      diseases: []
    },
    {
      id: 3,
      name: 'Marin Harvest',
      locality: 'Hitra',
      latitude: 63.4000,
      longitude: 10.5000,
      species: 'Laks',
      diseases: ['FRANCISELLOSE']
    }
  ];
}

// Display facilities on map
function displayFacilities() {
  // Check if map exists
  if (!map) {
    console.warn('⚠️ Map not initialized yet, cannot display facilities');
    return;
  }
  
  // Clear existing markers
  facilityMarkers.forEach(marker => map.removeLayer(marker));
  proximityCircles.forEach(circle => map.removeLayer(circle));
  facilityMarkers = [];
  proximityCircles = [];
  
  
  
  const showProximityCircles = document.getElementById('showProximityCircles')?.checked || false;
  const infectedFacilities = facilitiesData
    .filter(facility => isInfected(facility))
    .map(facility => ({
      name: facility.name,
      lat: facility.latitude,
      lon: facility.longitude
    }));
  
  const infectedCount = infectedFacilities.length;
  
  if (infectedCount > 0) {
    
  }
  
  const missingCoordinateNames = [];

  facilitiesData.forEach(facility => {
    const lat = parseFacilityCoordinate(facility.latitude);
    const lon = parseFacilityCoordinate(facility.longitude);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      missingCoordinateNames.push(facility.name || 'Ukjent anlegg');
      return;
    }

    facility.latitude = lat;
    facility.longitude = lon;
    
    const infected = isInfected(facility);
    let proximityRisk = false;
    let barentsWatchRisk = null;
    let hasSignificantBarentsRisk = false;
    let bwZoneType = null;
    const liceHigh = isLiceHighFacility(facility);

    // Check BarentsWatch disease-spread risk first (highest priority)
    if (facility.barentsWatchRisk) {
      barentsWatchRisk = facility.barentsWatchRisk.risk_level;
      bwZoneType = getBarentsWatchZoneType(facility.barentsWatchRisk);
      // Store for filtering
      facility.riskLevel = barentsWatchRisk;
      facility.bwZoneType = bwZoneType;
      
      // Only consider as "at risk" if level is Moderat, Høy, or Ekstrem (NOT Lav)
      // Also treat zone_type PROTECTION/SURVEILLANCE as significant BW risk
      hasSignificantBarentsRisk = isSignificantBarentsRisk(barentsWatchRisk)
        || bwZoneType === 'PROTECTION'
        || bwZoneType === 'SURVEILLANCE';
    }

    // Check proximity to infected - calculate 10km zone for ALL facilities
    // Display logic will filter to show ONLY those without BW-risk
    let closestDistance = Infinity;
    if (!infected && infectedFacilities.length > 0) {
      for (const infectedFacility of infectedFacilities) {
        const dist = calculateDistance(lat, lon, infectedFacility.lat, infectedFacility.lon);
        if (dist < closestDistance) closestDistance = dist;
        if (dist <= 10) {
          proximityRisk = true;
          if (proximityRisk && !facility._loggedProximity) {
            
            facility._loggedProximity = true;
          }
        }
      }
    }

    // Store risk flags separately for route planning and UI (independent flags)
    facility.localZoneRisk = proximityRisk;  // 10km proximity risk (independent)
    facility.proximityRisk = hasSignificantBarentsRisk; // BW risk (primary - Moderat/Høy/Ekstrem)
    
    if (proximityRisk) {
      
    }
    
    // Determine marker class based on risk hierarchy
    // Note: Marker class will be PINK if localZone=true (even if BW also exists)
    // This is handled dynamically by filterMarkersByStatus when showLocalZone is toggled
    let markerClass = 'facility-marker-green'; // Default
    
    if (infected) {
      markerClass = 'facility-marker-red'; // Infected = highest risk
    } else if (hasSignificantBarentsRisk && !proximityRisk) {
      // BW-risk ONLY (no 10km) = protection orange / surveillance amber
      markerClass = bwZoneType === 'SURVEILLANCE' ? 'facility-marker-amber' : 'facility-marker-orange';
    } else if (proximityRisk && !hasSignificantBarentsRisk) {
      // 10km ONLY (no BW) = yellow (egen 10km-markør)
      markerClass = 'facility-marker-pink';
    } else if (hasSignificantBarentsRisk && proximityRisk) {
      // BOTH BW and 10km = protection orange / surveillance amber (can change to pink when showLocalZone is active)
      markerClass = bwZoneType === 'SURVEILLANCE' ? 'facility-marker-amber' : 'facility-marker-orange';
      facility.hasBothRisks = true;  // Flag for dynamic color switching
    } else if (liceHigh) {
      markerClass = 'facility-marker-purple';
    }
    
    const icon = L.divIcon({
      className: markerClass,
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    });
    
    const marker = L.marker([lat, lon], { icon })
      .addTo(map)
      .bindPopup(createFacilityPopup(facility, infected))
      .bindTooltip(facility.name || 'Ukjent anlegg', { direction: 'top', offset: [0, -8], opacity: 0.95 });

    const markerElement = marker.getElement();
    if (markerElement) {
      applySplitMarkerStyle(markerElement, markerClass, liceHigh);
    }
    
    // Store facility data on marker for later use
    // Extract diseases from both possible API structures
    const diseasesArray = facility.diseases || facility.diseaseInfo?.diseases || [];
    marker.facilityData = {
      id: facility.localityNo || facility.id,
      name: facility.name,
      lat: facility.latitude,
      lon: facility.longitude,
      infected: infected,
      proximityRisk: facility.proximityRisk === true,
      localZoneRisk: facility.localZoneRisk === true,
      bwRisk: hasSignificantBarentsRisk === true,
      bwZoneType: bwZoneType,
      liceHigh: liceHigh === true,
      barentsWatchRisk: facility.barentsWatchRisk || null,
      riskLevel: facility.riskLevel || null,
      diseases: diseasesArray,
      nearbyDiseases: facility.nearbyDiseases || []
    };
    
    // Add click handler to add facility to route planner
    marker.on('click', function(e) {
      // Toggle selected styling
      const icon = marker.getElement();
      if (icon) {
        icon.classList.toggle('selected');
      }
      
      if (typeof addFacilityToRoutePlanner === 'function') {
        addFacilityToRoutePlanner(marker.facilityData);
      }
    });
    
    facilityMarkers.push(marker);
    
    // Add 10 km proximity circle for infected facilities
    if (infected && showProximityCircles) {
      const circle = L.circle([lat, lon], {
        radius: 10000, // 10 km
        color: '#ef4444',
        fillColor: '#fecaca',
        fillOpacity: 0.1,
        weight: 1,
        dashArray: '5, 5'
      }).addTo(map);
      
      proximityCircles.push(circle);
    }
  });
  
  if (missingCoordinateNames.length > 0) {
    console.warn(
      `⚠️ ${missingCoordinateNames.length} facilities are missing coordinates and were skipped on the vessel map.`,
      missingCoordinateNames.slice(0, 25)
    );
  }

  // Count facilities by risk type
  const yellowCount = facilityMarkers.filter(m => m.facilityData?.localZoneRisk === true && !m.facilityData?.infected).length;
  const orangeCount = facilityMarkers.filter(m => m.facilityData?.bwRisk === true && !m.facilityData?.infected).length;
  const redCount = facilityMarkers.filter(m => m.facilityData?.infected === true).length;
  
  
  // Debug: Check if proximity risk was calculated at all
  if (yellowCount === 0 && infectedCount > 0) {
    console.warn(`⚠️ WARNING: Found ${infectedCount} infected facilities but 0 pink (10km proximity) - check distance calculations`);
    console.warn(`   Distance function works? Testing: calculateDistance(0, 0, 0.1, 0) = ${calculateDistance(0, 0, 0.1, 0).toFixed(2)} km (should be ~11 km)`);
  }
  
  // Apply current filters (BW/local zone toggles)
  const showHealthy = document.getElementById('showHealthy')?.checked ?? true;
  const showRiskZone = document.getElementById('showRiskZone')?.checked ?? true;
  const showLocalZone = document.getElementById('showLocalZone')?.checked ?? false;
  const showInfected = document.getElementById('showInfected')?.checked ?? true;
  filterMarkersByStatus(showHealthy, showRiskZone, showLocalZone, showInfected);

  
}

// Check if facility is infected
function isInfected(facility) {
  // API returns diseases as array directly
  const diseases = facility.diseases || facility.diseaseInfo?.diseases || [];
  return Array.isArray(diseases) && diseases.length > 0 && diseases.some(d => {
    if (typeof d === 'string') return d.length > 0;
    if (typeof d === 'object' && d.name) return true;
    return false;
  });
}

// Create facility popup content
function createFacilityPopup(facility, infected) {
  const name = facility.name || 'Ukjent anlegg';
  const lat = facility.latitude;
  const lon = facility.longitude;
  
  let html = `<strong>${name}</strong><br>`;
  const liceHigh = isLiceHighFacility(facility);
  
  // Show infection status first
  if (infected) {
    html += `<span style="color: #ef4444; font-weight: bold;">⚠️ SMITTET</span><br>`;
    
    // API returns diseases directly as array
    const diseases = facility.diseases || [];
    diseases.forEach(d => {
      const diseaseName = typeof d === 'string' ? d : (d.name || 'Ukjent');
      html += `Sykdom: ${diseaseName}<br>`;
    });
  } else if (facility.barentsWatchRisk) {
    // Show BarentsWatch risk level
    const riskLevel = facility.barentsWatchRisk.risk_level;
    const zoneType = getBarentsWatchZoneType(facility.barentsWatchRisk);
    let riskColor = '#10b981';
    let riskIcon = '✓';
    
    if (riskLevel === 'Ekstrem') {
      riskColor = '#ef4444';
      riskIcon = '🔴';
    } else if (riskLevel === 'Høy') {
      riskColor = '#ea580c';
      riskIcon = '🟠';
    } else if (riskLevel === 'Moderat') {
      riskColor = '#f59e0b';
      riskIcon = '🟡';
    }

    if (zoneType === 'PROTECTION') {
      riskColor = '#f59e0b';
      riskIcon = '🟠';
    } else if (zoneType === 'SURVEILLANCE') {
      riskColor = '#fbbf24';
      riskIcon = '🟧';
    }
    
    html += `<span style="color: ${riskColor}; font-weight: bold;">${riskIcon} RISIKO: ${riskLevel}</span><br>`;
    html += `Poengsum: ${facility.barentsWatchRisk.risk_score.toFixed(2)}<br>`;
    
    // Show nearby diseases if present
    if (facility.nearbyDiseases && facility.nearbyDiseases.length > 0) {
      html += `Sykdommer i området: ${facility.nearbyDiseases.join(', ')}<br>`;
    }
    
    if (facility.barentsWatchRisk.nearby_diseased_count > 0) {
      html += `${facility.barentsWatchRisk.nearby_diseased_count} smittede anlegg i nær område<br>`;
    }
  } else {
    html += `<span style="color: #10b981;">✓ Frisk</span><br>`;
    if (facility.localZoneRisk) {
      html += `<span style="color: #f59e0b; font-weight: bold;">🟡 Lokal sone (innen 10 km)</span><br>`;
    }
  }

  if (liceHigh) {
    html += `<span style="color: #7c3aed; font-weight: bold;">🟣 Høye lusetall (delt markør)</span><br>`;
  }
  
  // Show FDIR metadata if available
  if (facility.fdir) {
    html += `<br><strong style="font-size: 0.9em;">🏭 Fiskeridirektoratet</strong><br>`;
    if (facility.fdir.production_category) {
      html += `<span style="font-size: 0.85em;">Produksjon: ${facility.fdir.production_category}</span><br>`;
    }
    if (facility.fdir.latest_b_survey) {
      const bStatus = formatBSurveyStatus(facility.fdir.latest_b_survey);
      html += `<span style="font-size: 0.85em;">B-undersøkelse: ${bStatus}</span><br>`;
    }
  }
  
  // Calculate distance from vessel
  const vesselData = VesselStorage.getVesselData();
  const vesselPos = vesselData.vessel.position;
  const distance = calculateDistance(vesselPos.lat, vesselPos.lon, lat, lon);
  html += `<br>Avstand: ${distance.toFixed(1)} km<br>`;
  
  // Warning if within 10 km of infected facility
  if (infected && distance < 10) {
    html += `<strong style="color: #ef4444;">⚠️ Innenfor 10 km!</strong><br>`;
    html += `<small>Desinfeksjon anbefales</small>`;
  }
  
  return html;
}

// Calculate distance between two points (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees) {
  return degrees * (Math.PI / 180);
}

// Filter map based on checkboxes
function filterMap() {
  displayFacilities();
}

// Check proximity to infected facilities
function checkProximity() {
  const vesselData = VesselStorage.getVesselData();
  const vesselPos = vesselData.vessel.position;
  
  const nearbyInfected = facilitiesData
    .filter(f => {
      const lat = f.latitude;
      const lon = f.longitude;
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
      
      if (!isInfected(f)) return false;
      
      const distance = calculateDistance(vesselPos.lat, vesselPos.lon, lat, lon);
      return distance < 10;
    })
    .map(f => ({
      name: f.name,
      distance: calculateDistance(
        vesselPos.lat, vesselPos.lon,
        f.latitude,
        f.longitude
      )
    }))
    .sort((a, b) => a.distance - b.distance);
  
  if (nearbyInfected.length > 0) {
    const closest = nearbyInfected[0];
    if (typeof showToast === 'function') {
      showToast(
        `⚠️ Nær smittet anlegg: ${closest.name} (${closest.distance.toFixed(1)} km)`,
        'warning'
      );
    }
  }
}

// Update vessel position (can be called from geolocation)
function updateVesselMapPosition(lat, lon) {
  VesselStorage.updateVesselPosition(lat, lon, 'MANUELL');
  addVesselMarker(lat, lon);
  map.setView([lat, lon], map.getZoom());
  if (typeof updatePositionMeta === 'function') {
    updatePositionMeta();
  }
  
  // Check proximity after position update
  checkProximity();
}

// Get facilities data for other modules
function getFacilitiesData() {
  return facilitiesData;
}

/**
 * Marker alle anlegg i en planlagt rute med "in-route" styling
 * @param {Array} facilityIds - Array med facility IDs som er i ruten
 */
function highlightRouteFacilities(facilityIds) {
  if (!facilityIds || !Array.isArray(facilityIds)) return;
  
  const idSet = new Set(facilityIds.map(id => String(id)));
  
  facilityMarkers.forEach(marker => {
    const icon = marker.getElement();
    if (!icon) return;
    
    const facilityId = String(marker.facilityData?.id);
    
    if (idSet.has(facilityId)) {
      icon.classList.add('in-route');
    } else {
      icon.classList.remove('in-route');
    }
  });
}

/**
 * Fjern all route-highlighting
 */
function clearRouteHighlights() {
  facilityMarkers.forEach(marker => {
    const icon = marker.getElement();
    if (icon) {
      icon.classList.remove('in-route');
    }
  });
}

/**
 * Fjern all selection-marking
 */
function clearAllSelections() {
  facilityMarkers.forEach(marker => {
    const icon = marker.getElement();
    if (icon) {
      icon.classList.remove('selected');
    }
  });
}

function deselectFacilityById(facilityId) {
  const targetId = String(facilityId);
  facilityMarkers.forEach(marker => {
    const icon = marker.getElement();
    const markerId = String(marker.facilityData?.id);
    if (icon && markerId === targetId) {
      icon.classList.remove('selected');
    }
  });
}

// Filter markers by status (healthy, BW risk, local zone, infected)
function filterMarkersByStatus(showHealthy, showRiskZone, showLocalZone, showInfected) {
  
  
  let counts = { infected: 0, bwRisk: 0, localZone: 0, healthy: 0, shown: 0, hidden: 0 };
  
  facilityMarkers.forEach(marker => {
    const element = marker.getElement();
    if (!element) return;
    
    const isFacilityInfected = marker.facilityData?.infected ?? false;
    const hasBarentsWatchRisk = marker.facilityData?.bwRisk ?? false;
    const isLocalZoneRisk = marker.facilityData?.localZoneRisk ?? false;
    
    // Count for debug
    if (isFacilityInfected) counts.infected++;
    else if (hasBarentsWatchRisk) counts.bwRisk++;
    else if (isLocalZoneRisk) counts.localZone++;
    else counts.healthy++;
    
    let shouldShow = false;
    
    // Evaluate visibility: Show if risk type toggle is ON, or if 10km toggle controls display
    // Logic: Hide ONLY if the risk category's toggle is OFF
    if (isFacilityInfected && !showInfected) {
      shouldShow = false;
    } else if (hasBarentsWatchRisk && !showRiskZone) {
      // BW toggle OFF - hide BW anlegg
      shouldShow = false;
    } else if (!isFacilityInfected && !hasBarentsWatchRisk && !showHealthy) {
      // Healthy toggle OFF - hide healthy anlegg (which includes those with 10km risk)
      shouldShow = false;
    } else {
      // Show by default
      shouldShow = true;
    }
    
    // Apply visibility and colors (NEVER remove from map, just hide with CSS)
    if (shouldShow) {
      // Update marker color based on risk type and current toggles
      element.classList.remove('facility-marker-orange', 'facility-marker-amber', 'facility-marker-pink', 'facility-marker-green', 'facility-marker-red');
      element.classList.remove('facility-marker-purple');
      
      if (isFacilityInfected) {
        element.classList.add('facility-marker-red');
        applySplitMarkerStyle(element, 'facility-marker-red', marker.facilityData?.liceHigh === true);
      } else if (showLocalZone && isLocalZoneRisk && !hasBarentsWatchRisk) {
        // 10km only, and toggle is ON = show PINK
        element.classList.add('facility-marker-pink');
        applySplitMarkerStyle(element, 'facility-marker-pink', marker.facilityData?.liceHigh === true);
      } else if (hasBarentsWatchRisk) {
        // BW (with or without 10km) = protection orange / surveillance amber
        const bwClass = marker.facilityData?.bwZoneType === 'SURVEILLANCE' ? 'facility-marker-amber' : 'facility-marker-orange';
        element.classList.add(bwClass);
        applySplitMarkerStyle(element, bwClass, marker.facilityData?.liceHigh === true);
      } else if (marker.facilityData?.liceHigh === true) {
        element.classList.add('facility-marker-purple');
        applySplitMarkerStyle(element, 'facility-marker-purple', marker.facilityData?.liceHigh === true);
      } else {
        // Healthy
        element.classList.add('facility-marker-green');
        applySplitMarkerStyle(element, 'facility-marker-green', marker.facilityData?.liceHigh === true);
      }
      
      // Show element
      element.style.display = '';
      element.style.visibility = 'visible';
      counts.shown++;
    } else {
      // Hide element with CSS (keep on map to preserve Leaflet state)
      element.style.display = 'none';
      element.style.visibility = 'hidden';
      counts.hidden++;
    }
  });
  
  
}

// Highlight and zoom to facility on map (for search results)
function highlightAndZoomToFacility(facilityId) {
  const targetId = String(facilityId);
  let targetMarker = null;
  
  // Find the marker
  for (const marker of facilityMarkers) {
    if (String(marker.facilityData?.id) === targetId) {
      targetMarker = marker;
      break;
    }
  }
  
  if (!targetMarker) {
    console.warn(`❌ Facility ${facilityId} not found on map`);
    return;
  }
  
  const icon = targetMarker.getElement();
  const data = targetMarker.facilityData;
  
  // Make sure marker is on map
  if (!map.hasLayer(targetMarker)) {
    targetMarker.addTo(map);
  }
  
  // Add visual highlight
  if (icon) {
    icon.classList.add('selected');
    icon.style.boxShadow = '0 0 15px rgba(59, 130, 246, 0.8)';
    setTimeout(() => {
      icon.style.boxShadow = '';
    }, 2000);
  }
  
  // Zoom to facility
  map.setView([data.lat, data.lon], 13);
  
  // Open popup
  targetMarker.openPopup();
  
  // Log status
  const riskText = data.infected
    ? '🔴 INFISERT'
    : (data.liceHigh
      ? '🟣 LUSERISIKO'
      : (data.bwRisk
        ? (data.bwZoneType === 'SURVEILLANCE' ? '🟧 ILA surveillance-sone' : '🟠 ILA protection-sone')
        : (data.localZoneRisk ? '🟡 10km-sone' : '🟢 Frisk')));
  
}

// Export functions
window.VesselMap = {
  initMap,
  displayFacilities,
  updateVesselMapPosition,
  checkProximity,
  getFacilitiesData,
  calculateDistance,
  highlightRouteFacilities,
  clearRouteHighlights,
  clearAllSelections,
  deselectFacilityById,
  filterMarkersByStatus,
  highlightAndZoomToFacility
};
