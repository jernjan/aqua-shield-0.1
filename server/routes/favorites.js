const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

// Initialize database connection pool
let pool = null;

// Get or create database pool
function getPool() {
  if (!pool) {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      console.warn('[FAVORITES] DATABASE_URL not set, using in-memory fallback');
      return null;
    }
    
    pool = new Pool({
      connectionString: dbUrl,
      ssl: { rejectUnauthorized: false } // Required for Supabase
    });
    
    pool.on('error', (err) => {
      console.error('[DB] Pool error:', err);
      pool = null;
    });
  }
  return pool;
}

// Initialize database table on startup
async function initDatabase() {
  try {
    const p = getPool();
    if (!p) return;
    
    const client = await p.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS users_favorites (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          user_id VARCHAR(50) NOT NULL,
          resource_id VARCHAR(50) NOT NULL,
          resource_type VARCHAR(20) NOT NULL,
          created_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(user_id, resource_id, resource_type)
        );
        
        CREATE INDEX IF NOT EXISTS idx_user_favorites ON users_favorites(user_id);
      `);
      console.log('[FAVORITES] Database table initialized');
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[FAVORITES] Database init error:', err);
  }
}

// Initialize on first request or startup
let dbInitialized = false;
async function ensureDbInit() {
  if (!dbInitialized && getPool()) {
    await initDatabase();
    dbInitialized = true;
  }
}

// In-memory fallback for when database is unavailable
const inMemoryFavorites = {
  movi: { facilities: [], vessels: [] },
  aakerblå: { facilities: [], vessels: [] },
  admin: { facilities: [], vessels: [] }
};

// Get user's favorite facilities/vessels
router.get('/favorites/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    console.log(`[FAVORITES] GET for user ${userId}`);
    
    await ensureDbInit();
    const p = getPool();
    
    if (p) {
      // Use database
      const client = await p.connect();
      try {
        const result = await client.query(
          'SELECT resource_id, resource_type FROM users_favorites WHERE user_id = $1 ORDER BY created_at DESC',
          [userId]
        );
        
        const facilities = result.rows
          .filter(r => r.resource_type === 'facility')
          .map(r => r.resource_id);
        const vessels = result.rows
          .filter(r => r.resource_type === 'vessel')
          .map(r => r.resource_id);
        
        const roleMap = { 'movi': 'farmer', 'aakerblå': 'brønnbåt', 'admin': 'admin' };
        
        console.log(`[FAVORITES] DB: ${facilities.length} facilities, ${vessels.length} vessels`);
        
        return res.json({
          userId,
          role: roleMap[userId] || 'farmer',
          favorites: { facilities, vessels },
          maxFavorites: 10
        });
      } finally {
        client.release();
      }
    } else {
      // Fallback to in-memory
      if (!inMemoryFavorites[userId]) {
        inMemoryFavorites[userId] = { facilities: [], vessels: [] };
      }
      
      const favorites = inMemoryFavorites[userId];
      const roleMap = { 'movi': 'farmer', 'aakerblå': 'brønnbåt', 'admin': 'admin' };
      
      console.log(`[FAVORITES] Memory fallback: ${favorites.facilities.length} facilities`);
      
      res.json({
        userId,
        role: roleMap[userId] || 'farmer',
        favorites,
        maxFavorites: 10
      });
    }
  } catch (err) {
    console.error('[FAVORITES] Error fetching:', err);
    res.status(500).json({ error: err.message });
  }
});

// Add facility/vessel to favorites
router.post('/favorites/:userId/add', async (req, res) => {
  try {
    const { userId } = req.params;
    const { resourceId, resourceType } = req.body;
    
    console.log(`[FAVORITES] Adding ${resourceType} ${resourceId} for user ${userId}`);
    
    if (!resourceType || !resourceId) {
      return res.status(400).json({ error: 'resourceId and resourceType required' });
    }
    
    await ensureDbInit();
    const p = getPool();
    
    if (p) {
      // Use database
      const client = await p.connect();
      try {
        // Check count
        const countResult = await client.query(
          'SELECT COUNT(*) FROM users_favorites WHERE user_id = $1',
          [userId]
        );
        
        if (parseInt(countResult.rows[0].count) >= 10) {
          return res.status(400).json({ error: 'Maximum 10 favorites allowed' });
        }
        
        // Insert (will fail silently on duplicate due to UNIQUE constraint)
        const result = await client.query(
          `INSERT INTO users_favorites (user_id, resource_id, resource_type)
           VALUES ($1, $2, $3)
           ON CONFLICT DO NOTHING
           RETURNING id`,
          [userId, resourceId, resourceType]
        );
        
        if (!result.rows.length) {
          return res.status(400).json({ error: 'Already in favorites' });
        }
        
        console.log(`[FAVORITES] Successfully added to DB`);
        
        res.json({
          message: 'Added to favorites',
          resourceId,
          resourceType
        });
      } finally {
        client.release();
      }
    } else {
      // Fallback to in-memory
      if (!inMemoryFavorites[userId]) {
        inMemoryFavorites[userId] = { facilities: [], vessels: [] };
      }
      
      const field = resourceType === 'facility' ? 'facilities' : 'vessels';
      const favorites = inMemoryFavorites[userId][field];
      
      if (favorites.length >= 10) {
        return res.status(400).json({ error: 'Maximum 10 favorites allowed' });
      }
      
      if (favorites.includes(resourceId)) {
        return res.status(400).json({ error: 'Already in favorites' });
      }
      
      favorites.push(resourceId);
      
      console.log(`[FAVORITES] Added to memory store`);
      
      res.json({
        message: 'Added to favorites',
        resourceId,
        resourceType
      });
    }
  } catch (err) {
    console.error('[FAVORITES] Error adding:', err);
    res.status(500).json({ error: err.message });
  }
});

// Remove facility/vessel from favorites
router.post('/favorites/:userId/remove', async (req, res) => {
  try {
    const { userId } = req.params;
    const { resourceId, resourceType } = req.body;
    
    console.log(`[FAVORITES] Removing ${resourceType} ${resourceId} for user ${userId}`);
    
    await ensureDbInit();
    const p = getPool();
    
    if (p) {
      // Use database
      const client = await p.connect();
      try {
        await client.query(
          'DELETE FROM users_favorites WHERE user_id = $1 AND resource_id = $2 AND resource_type = $3',
          [userId, resourceId, resourceType]
        );
        
        console.log(`[FAVORITES] Removed from DB`);
        
        res.json({
          message: 'Removed from favorites',
          resourceId,
          resourceType
        });
      } finally {
        client.release();
      }
    } else {
      // Fallback to in-memory
      if (!inMemoryFavorites[userId]) {
        inMemoryFavorites[userId] = { facilities: [], vessels: [] };
      }
      
      const field = resourceType === 'facility' ? 'facilities' : 'vessels';
      inMemoryFavorites[userId][field] = inMemoryFavorites[userId][field].filter(
        id => id !== resourceId
      );
      
      console.log(`[FAVORITES] Removed from memory store`);
      
      res.json({
        message: 'Removed from favorites',
        resourceId,
        resourceType
      });
    }
  } catch (err) {
    console.error('[FAVORITES] Error removing:', err);
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
