const axios = require('axios');
const { getBarentsWatchToken } = require('./auth');

// Fetch ALL active facilities from BarentsWatch API
async function getAllFacilities() {
  try {
    console.log('🔄 Fetching aquaculture facilities from BarentsWatch...');
    
    // Get OAuth2 token first
    const token = await getBarentsWatchToken();
    if (!token) {
      console.warn('⚠️ No OAuth2 token available, skipping BarentsWatch sync');
      return [];
    }

    // The correct endpoint returns a simple JSON array, not GeoJSON
    const endpoint = 'https://www.barentswatch.no/bwapi/v1/geodata/fishhealth/localities';
    
    try {
      console.log(`  Fetching: ${endpoint}`);
      const response = await axios.get(endpoint, {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
          'User-Agent': 'AquaShield/0.1'
        },
        timeout: 15000
      });
      
      const localities = Array.isArray(response.data) ? response.data : [];
      
      if (localities.length > 0) {
        console.log(`✓ Got ${localities.length} facilities from BarentsWatch`);
        
        return localities.map(item => ({
          id: item.localityNo?.toString() || 'unknown',
          name: item.name || `Anlegg ${item.localityNo}`,
          lat: item.latitude || 0,
          lng: item.longitude || 0,
          municipality: item.municipality,
          municipalityNo: item.municipalityNo,
          po: item.productionAreaId,
          species: item.species || 'Salmon',
          liceCount: item.adultFemaleLice || 0,
          diseaseStatus: item.diseaseStatus,
          lastUpdate: item.lastUpdate || new Date().toISOString()
        }));
      }
    } catch (err) {
      console.log(`  ❌ Endpoint failed (${err.response?.status || err.code}): ${err.message}`);
    }
    
    console.warn('⚠️ BarentsWatch facility endpoint failed, will use mock data');
    return [];
  } catch (err) {
    console.error('❌ Failed to fetch facilities:', err.message);
    return [];
  }
}

// Old code to preserve - Get facilities for a specific user
async function getUserFacilities(facilityIds) {
  const allFacilities = await getAllFacilities();
  return allFacilities.filter(f => facilityIds.includes(f.id));
}

// Fetch AIS data (vessel positions) from BarentsWatch
async function getVesselPositions(bbox = null) {
  try {
    console.log('🔄 Fetching vessel positions from live AIS API...');
    
    // Get OAuth2 token
    const token = await getBarentsWatchToken();
    if (!token) {
      console.warn('⚠️ No OAuth2 token, skipping AIS fetch');
      return [];
    }
    
    // Try live AIS API endpoints
    const endpoints = [
      'https://live.ais.barentswatch.no/v1/latest/combined',
      'https://live.ais.barentswatch.no/v1/combined'
    ];
    
    for (const url of endpoints) {
      try {
        console.log(`  Trying: ${url}`);
        const response = await axios.get(url, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          },
          timeout: 10000
        });
        
        const vessels = Array.isArray(response.data) ? response.data : response.data.features || [];
        
        if (vessels.length > 0) {
          console.log(`✓ Got ${vessels.length} vessel positions from AIS`);
          return vessels.map(vessel => ({
            id: vessel.mmsi?.toString() || vessel.properties?.mmsi?.toString() || 'unknown',
            name: vessel.name || vessel.properties?.name || 'Unknown',
            lat: vessel.latitude || vessel.properties?.latitude || vessel.geometry?.coordinates?.[1] || 0,
            lng: vessel.longitude || vessel.properties?.longitude || vessel.geometry?.coordinates?.[0] || 0,
            speed: vessel.speedOverGround || vessel.properties?.speedOverGround || 0,
            course: vessel.courseOverGround || vessel.properties?.courseOverGround || 0,
            lastUpdate: vessel.msgtime || vessel.properties?.msgtime || new Date().toISOString()
          }));
        }
      } catch (err) {
        console.log(`  ❌ Failed (${err.response?.status || err.code})`);
        continue;
      }
    }
    
    console.log(`⚠️ All AIS endpoints failed, will use mock data`);
    return [];
  } catch (err) {
    console.error('❌ Failed to fetch vessels:', err.message);
    return [];
  }
}

// OLD MAPPING CODE BELOW - KEEP FOR REFERENCE
async function getVesselPositions_Old(bbox = null) {
  try {
    console.log('🔄 Fetching vessel positions from BarentsWatch...');
    
    // Get OAuth2 token
    const token = await getBarentsWatchToken();
    if (!token) {
      console.warn('⚠️ No OAuth2 token, skipping AIS fetch');
      return [];
    }
    const endpoints = [
      'https://www.barentswatch.no/bwapi/v2/vessels',
      'https://www.barentswatch.no/bwapi/v2/live/vessels',
      'https://www.barentswatch.no/api/v1/ais/vessels',
      'https://www.barentswatch.no/bwapi/v1/latest/ais'
    ];
    
    let response = null;
    let lastError = null;
    
    for (const url of endpoints) {
      try {
        response = await axios.get(url, {
          headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${token}`,
            'User-Agent': 'AquaShield/0.1'
          },
          timeout: 5000
        });
        console.log(`✓ Connected to BarentsWatch: ${url}`);
        break; // Success - exit loop
      } catch (err) {
        lastError = err;
        console.log(`⚠️  Endpoint failed (${err.response?.status || err.message}): ${url}`);
        continue; // Try next endpoint
      }
    }
    
    if (!response) {
      console.log(`⚠️  All BarentsWatch AIS endpoints failed. Using fallback data.`);
      console.log(`   Last error: ${lastError?.message || 'Unknown'}`);
      console.log(`   Note: AIS APIs may require special permissions or may be temporarily unavailable`);
      return []; // Return empty - will trigger fallback
    }
    
    const data = Array.isArray(response.data) ? response.data : response.data.vessels || response.data.features || [];
    console.log(`✓ Got ${data.length} vessel positions from BarentsWatch`);
    
    return data.map(vessel => ({
      id: vessel.mmsi?.toString() || vessel.callsign || `vessel_${Date.now()}`,
      mmsi: vessel.mmsi,
      name: vessel.name || 'Unknown Vessel',
      callsign: vessel.callsign,
      lat: vessel.latitude || vessel.lat || 0,
      lng: vessel.longitude || vessel.lng || 0,
      speed: vessel.sog || vessel.speed || 0,
      heading: vessel.cog || vessel.heading || 0,
      vesselType: vessel.shipType || vessel.type || 'Unknown',
      lastPosition: vessel.positionTime || new Date().toISOString(),
      status: vessel.status || 'underway'
    }));
  } catch (err) {
    console.error('⚠️  Unexpected error fetching vessel positions:', err.message);
    return [];
  }
}

// Calculate distance between two coordinates (in km)
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Find vessels near a facility
function getVesselsNearFacility(vessels, facility, radiusKm = 10) {
  return vessels.filter(vessel => {
    const distance = calculateDistance(
      facility.lat, 
      facility.lng, 
      vessel.lat, 
      vessel.lng
    );
    return distance <= radiusKm;
  }).map(vessel => ({
    ...vessel,
    distanceKm: calculateDistance(facility.lat, facility.lng, vessel.lat, vessel.lng)
  }));
}

// Get outbreak history from Fishhealth API
async function getOutbreakHistory(weeks = 52) {
  try {
    console.log(`🔄 Fetching outbreak history (last ${weeks} weeks) from Fishhealth API...`);
    
    // Fishhealth API v2 endpoint for historical disease data
    const response = await axios.get('https://www.barentswatch.no/bwapi/v2/fishhealth/disease', {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'AquaShield/0.1'
      },
      timeout: 10000
    });
    
    const data = Array.isArray(response.data) ? response.data : response.data.items || [];
    
    console.log(`✓ Got ${data.length} disease records from Fishhealth API`);
    
    // If no data, return empty array (not an error - just no active outbreaks)
    if (data.length === 0) {
      console.log('ℹ️  No outbreak data currently in BarentsWatch Fishhealth API');
      return [];
    }
    
    // Filter and transform data
    return data.map(item => ({
      id: `outbreak_${item.localityNo}_${item.reportDate}`,
      localityNo: item.localityNo,
      facilityName: item.localityName || `Anlegg ${item.localityNo}`,
      diseaseCode: item.diseaseCode, // PD, ISA, etc
      diseaseName: getDiseaseNameFromCode(item.diseaseCode),
      startDate: item.startDate,
      reportDate: item.reportDate,
      endDate: item.endDate,
      severity: calculateSeverity(item),
      location: {
        lat: item.latitude,
        lng: item.longitude
      },
      productionArea: item.productionAreaId,
      status: item.status, // 'active' or 'resolved'
      source: 'Fishhealth_API'
    }));
  } catch (err) {
    console.error('❌ Failed to fetch outbreak history:', err.message);
    console.log('📝 Returning empty outbreak list (BarentsWatch API may be temporarily unavailable)');
    // Return empty array instead of crashing - endpoint will still work
    return [];
  }
}

// Get sea lice data for specific facility
async function getFacilityLiceData(facilityNo) {
  try {
    console.log(`🔄 Fetching lice data for facility ${facilityNo}...`);
    
    const response = await axios.get(`https://www.barentswatch.no/bwapi/v2/fishhealth/lice?localityNo=${facilityNo}`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'AquaShield/0.1'
      },
      timeout: 8000
    });
    
    const data = response.data;
    
    if (!data) {
      console.log(`ℹ️  No lice data for facility ${facilityNo}`);
      return null;
    }
    
    return {
      facilityNo: data.localityNo,
      facilityName: data.localityName,
      adultFemaleLice: data.adultFemaleLice,
      mobileAdultLice: data.mobileAdultLice,
      movableLiceStages: data.movableLiceStages,
      immobileJuvenileLice: data.immobileJuvenileLice,
      femaleAdultLice: data.femaleAdultLice,
      liceLevel: data.liceLevel, // 'GREEN', 'YELLOW', 'RED'
      lastRiskScore: data.lastRiskScore,
      riskScore: data.riskScore,
      treatmentDates: data.treatmentDates,
      measureDate: data.measureDate,
      source: 'Fishhealth_API'
    };
  } catch (err) {
    console.error(`❌ Failed to fetch lice data for ${facilityNo}:`, err.message);
    return null;
  }
}

// Helper: Convert disease code to name
function getDiseaseNameFromCode(code) {
  const diseases = {
    'ISA': 'Infectious Salmon Anaemia',
    'PD': 'Pancreatic Disease',
    'PRV': 'Piscine Reovirus',
    'SRS': 'Salmon Rickettsial Septicaemia',
    'CMS': 'Cardiomyopathy Syndrome',
    'HVS': 'Hitra Virus Syndrome',
    'IPN': 'Infectious Pancreatic Necrosis',
    'VHS': 'Viral Haemorrhagic Septicaemia'
  };
  return diseases[code] || code || 'Unknown Disease';
}

// Helper: Calculate severity based on data
function calculateSeverity(item) {
  if (!item) return 'moderat';
  
  const startDate = item.startDate ? new Date(item.startDate) : null;
  const now = new Date();
  const daysActive = startDate ? Math.floor((now - startDate) / (1000 * 60 * 60 * 24)) : 0;
  
  // Severity based on disease duration and code
  if (item.diseaseCode === 'ISA' || daysActive > 60) return 'kritisk';
  if (daysActive > 30) return 'høy';
  if (daysActive > 14) return 'moderat';
  return 'lav';
}

module.exports = {
  getAllFacilities,
  getUserFacilities,
  getVesselPositions,
  calculateDistance,
  getVesselsNearFacility,
  getOutbreakHistory,
  getFacilityLiceData,
  getDiseaseNameFromCode,
  calculateSeverity
};
