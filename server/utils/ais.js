const axios = require('axios');

// Fetch wellboats and service vessels from Kystverket AIS
async function getAllVessels() {
  try {
    console.log('🚢 Fetching vessels from Kystverket AIS...');
    const response = await axios.get('https://www.barentswatch.no/bwapi/v2/vessel', {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'AquaShield/0.1'
      },
      timeout: 10000
    });
    
    const data = Array.isArray(response.data) ? response.data : response.data.items || [];
    
    // Filter to Norwegian waters + aquaculture-relevant types
    const norwegian = data.filter(v => 
      v.latitude >= 59 && v.latitude <= 72 &&
      v.longitude >= 2 && v.longitude <= 32 &&
      v.shipType && (
        v.shipType.includes('Well') || 
        v.shipType.includes('Service') ||
        v.shipType.includes('wellboat')
      )
    );
    
    console.log(`✓ Got ${norwegian.length} relevant vessels from Kystverket`);
    
    return norwegian.map(v => ({
      id: v.mmsi?.toString() || 'unknown',
      name: v.name || `Vessel ${v.mmsi}`,
      type: v.shipType || 'Unknown',
      lat: v.latitude || 0,
      lng: v.longitude || 0,
      heading: v.courseOverGround || 0,
      speed: v.speedOverGround || 0,
      lastUpdate: v.lastPositionUpdate || new Date().toISOString(),
      callSign: v.callSign || null,
      mmsi: v.mmsi
    }));
  } catch (err) {
    console.error('❌ Failed to fetch vessels:', err.message);
    return [];
  }
}

// Get vessels for a specific user
async function getUserVessels(vesselIds) {
  const allVessels = await getAllVessels();
  return allVessels.filter(v => vesselIds.includes(v.id));
}

module.exports = {
  getAllVessels,
  getUserVessels
};
