import axios from 'axios';

// Fetch ALL active facilities from BarentsWatch API
export async function getAllFacilities() {
  try {
    console.log('🔄 Fetching facilities from BarentsWatch...');
    const response = await axios.get('https://www.barentswatch.no/bwapi/v2/fishhealth/lice', {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'AquaShield/0.1'
      },
      timeout: 10000
    });
    
    const data = Array.isArray(response.data) ? response.data : response.data.items || [];
    
    console.log(`✓ Got ${data.length} facilities from BarentsWatch`);
    
    return data.map(item => ({
      id: item.localityNo?.toString() || 'unknown',
      name: item.localityName || `Anlegg ${item.localityNo}`,
      lat: item.latitude || 0,
      lng: item.longitude || 0,
      po: item.productionAreaId,
      species: item.species || 'Salmon',
      liceCount: item.adultFemaleLice || 0,
      liceLevel: item.liceLevel,
      disease: item.mostRecentDisease?.diseaseCode || null,
      diseaseStatus: item.diseaseStatus,
      lastUpdate: item.lastRiskScore?.date || new Date().toISOString()
    }));
  } catch (err) {
    console.error('❌ Failed to fetch facilities:', err.message);
    return [];
  }
}

// Get facilities for a specific user
export async function getUserFacilities(facilityIds) {
  const allFacilities = await getAllFacilities();
  return allFacilities.filter(f => facilityIds.includes(f.id));
}
