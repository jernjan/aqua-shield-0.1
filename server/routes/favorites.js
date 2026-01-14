const express = require('express');
const router = express.Router();

// DEBUG: List all users
router.get('/debug/users', async (req, res) => {
  try {
    const { readDB } = require('../db');
    const db = await readDB();
    
    const userList = Object.entries(db.users || {}).map(([id, user]) => ({
      id,
      name: user.name,
      role: user.role,
      favoriteFacilities: user.favoriteFacilities?.length || 0,
      favoriteVessels: user.favoriteVessels?.length || 0
    }));
    
    res.json({ users: userList });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get user's favorite facilities/vessels
router.get('/favorites/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    console.log(`[FAVORITES] GET for user ${userId}`);
    
    // Use in-memory store (survives dyno restarts, not persisted)
    if (!global.userFavorites) global.userFavorites = {};
    if (!global.userFavorites[userId]) {
      global.userFavorites[userId] = { facilities: [], vessels: [] };
    }
    
    const favorites = global.userFavorites[userId];
    const roleMap = { 'movi': 'farmer', 'aakerblå': 'brønnbåt', 'admin': 'admin' };
    
    console.log(`[FAVORITES] Returning ${favorites.facilities.length} facilities, ${favorites.vessels.length} vessels`);
    
    res.json({
      userId,
      role: roleMap[userId] || 'farmer',
      favorites: {
        facilities: favorites.facilities || [],
        vessels: favorites.vessels || []
      },
      maxFavorites: 10
    });
  } catch (err) {
    console.error('Error fetching favorites:', err);
    res.status(500).json({ error: err.message });
  }
});

// Add facility/vessel to favorites
router.post('/favorites/:userId/add', async (req, res) => {
  try {
    const { userId } = req.params;
    const { resourceId, resourceType } = req.body; // resourceType: 'facility' | 'vessel'
    
    console.log(`[FAVORITES] Adding ${resourceType} ${resourceId} for user ${userId}`);
    
    if (!resourceType || !resourceId) {
      return res.status(400).json({ error: 'resourceId and resourceType required' });
    }
    
    // Use in-memory store
    if (!global.userFavorites) global.userFavorites = {};
    if (!global.userFavorites[userId]) {
      global.userFavorites[userId] = { facilities: [], vessels: [] };
    }
    
    const field = resourceType === 'facility' ? 'facilities' : 'vessels';
    const favorites = global.userFavorites[userId][field];
    
    // Check max 10
    if (favorites.length >= 10) {
      return res.status(400).json({ error: 'Maximum 10 favorites allowed' });
    }
    
    // Check duplicate
    if (favorites.includes(resourceId)) {
      return res.status(400).json({ error: 'Already in favorites' });
    }
    
    favorites.push(resourceId);
    
    console.log(`[FAVORITES] Successfully added. Count: ${favorites.length}`);
    
    res.json({ 
      message: 'Added to favorites',
      count: favorites.length
    });
  } catch (err) {
    console.error('Error adding favorite:', err);
    res.status(500).json({ error: err.message });
  }
});

// Remove facility/vessel from favorites
router.post('/favorites/:userId/remove', async (req, res) => {
  try {
    const { userId } = req.params;
    const { resourceId, resourceType } = req.body;
    
    console.log(`[FAVORITES] Removing ${resourceType} ${resourceId} for user ${userId}`);
    
    // Use in-memory store
    if (!global.userFavorites) global.userFavorites = {};
    if (!global.userFavorites[userId]) {
      global.userFavorites[userId] = { facilities: [], vessels: [] };
    }
    
    const field = resourceType === 'facility' ? 'facilities' : 'vessels';
    const favorites = global.userFavorites[userId][field];
    
    // Remove the item
    global.userFavorites[userId][field] = favorites.filter(id => id !== resourceId);
    
    res.json({ 
      message: 'Removed from favorites',
      count: global.userFavorites[userId][field].length
    });
  } catch (err) {
    console.error('Error removing favorite:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get detailed facility info (risk, sources, diseases, lice count, distance)
router.get('/facility/:facilityId/detailed', async (req, res) => {
  try {
    const { facilityId } = req.params;
    const { readDB } = require('../db');
    const db = await readDB();
    
    const facility = db.facilities?.find(f => f.id === facilityId);
    if (!facility) {
      return res.status(404).json({ error: 'Facility not found' });
    }
    
    // Get contaminated vessels nearby
    const { getContaminatedVesselsNearFacility } = require('../utils/contamination');
    const contaminatedVessels = getContaminatedVesselsNearFacility(db, facilityId);
    
    // Calculate distances to other facilities
    const distances = (db.facilities || [])
      .filter(f => f.id !== facilityId)
      .map(other => ({
        facilityId: other.id,
        facilityName: other.name,
        distance: calculateDistance(facility, other),
        risk: other.riskScore > 60 ? 'HIGH' : 'MEDIUM'
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 10); // Closest 10
    
    res.json({
      facility: {
        id: facility.id,
        name: facility.name,
        location: { lat: facility.lat, lng: facility.lng },
        riskScore: facility.riskScore,
        riskLevel: facility.riskScore > 60 ? 'HIGH' : facility.riskScore > 40 ? 'MEDIUM' : 'LOW'
      },
      contamination: {
        sources: contaminatedVessels.map(v => ({
          vesselId: v.id,
          vesselName: v.name,
          liceCount: v.liceCount || 0,
          diseaseStatus: v.diseaseStatus || 'UNKNOWN',
          lastVisit: v.lastVisited
        }))
      },
      distances: distances,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Error fetching facility details:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get detailed vessel info (visits, disease status, nearby facilities at risk)
router.get('/vessel/:vesselId/detailed', async (req, res) => {
  try {
    const { vesselId } = req.params;
    const { readDB } = require('../db');
    const db = await readDB();
    
    const vessel = db.vessels?.find(v => v.id === vesselId);
    if (!vessel) {
      return res.status(404).json({ error: 'Vessel not found' });
    }
    
    // Get recent visits to facilities
    const facilityVisits = (db.facilities || [])
      .filter(f => f.recentVessels?.includes(vesselId))
      .map(f => ({
        facilityId: f.id,
        facilityName: f.name,
        lastVisit: new Date(Math.random() * Date.now()).toISOString(), // Simulated
        riskAtVisit: f.riskScore
      }))
      .sort((a, b) => new Date(b.lastVisit) - new Date(a.lastVisit))
      .slice(0, 10); // Last 10 visits
    
    res.json({
      vessel: {
        id: vessel.id,
        name: vessel.name,
        mmsi: vessel.mmsi,
        lastPosition: vessel.lastPosition,
        type: vessel.type
      },
      diseaseStatus: vessel.diseaseStatus || 'CLEAN',
      liceCount: vessel.liceCount || 0,
      recentVisits: facilityVisits,
      riskLevel: vessel.diseaseStatus === 'CONTAMINATED' ? 'HIGH' : 'LOW',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Error fetching vessel details:', err);
    res.status(500).json({ error: err.message });
  }
});

// Helper function
function calculateDistance(p1, p2) {
  const lat1 = p1.lat || p1.coordinates?.lat;
  const lon1 = p1.lng || p1.coordinates?.lng;
  const lat2 = p2.lat || p2.coordinates?.lat;
  const lon2 = p2.lng || p2.coordinates?.lng;
  
  if (!lat1 || !lon1 || !lat2 || !lon2) return 999;
  
  // Haversine formula
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return (R * c).toFixed(1);
}

module.exports = router;
