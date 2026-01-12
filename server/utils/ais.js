const axios = require('axios');
const { getVesselPositions } = require('./barentswatch');

// Fetch all vessels from BarentsWatch AIS API
// Uses new live AIS endpoint with proper OAuth2 scope
async function getAllVessels() {
  try {
    console.log('🚢 Fetching all vessels from AIS API...');
    
    // Use the new getVesselPositions() which has AIS OAuth2 client
    const vessels = await getVesselPositions();
    
    if (!vessels || vessels.length === 0) {
      console.warn('⚠️  No vessels returned from AIS API');
      return [];
    }
    
    console.log(`✓ Got ${vessels.length} vessels from AIS API`);
    
    // Map AIS format to our standard format
    return vessels.map(v => ({
      id: v.id || v.mmsi?.toString() || 'unknown',
      name: v.name || `Vessel ${v.mmsi || 'unknown'}`,
      type: v.shipType || 'Unknown',
      lat: v.lat || v.latitude || 0,
      lng: v.lng || v.longitude || 0,
      heading: v.course || v.courseOverGround || 0,
      speed: v.speed || v.speedOverGround || 0,
      lastUpdate: v.lastUpdate || v.msgtime || new Date().toISOString(),
      callSign: v.callSign || null,
      mmsi: v.mmsi || null
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
