/**
 * Real Data API Routes - BarentsWatch + AIS APIs only
 * NO MOCK DATA - all endpoints fetch from real sources
 */

const express = require('express');
const router = express.Router();
const { getAllFacilities } = require('../utils/barentswatch');
const { getAllVessels } = require('../utils/ais');
const { readDB, writeDB } = require('../db');

// ============ FACILITIES ENDPOINTS ============

/**
 * GET /api/facilities
 * Returns all aquaculture facilities from BarentsWatch
 * Real data: 2687+ facilities
 */
router.get('/facilities', async (req, res) => {
  try {
    console.log('📡 Fetching facilities from BarentsWatch...');
    
    // Try to get from cache first (db.facilities)
    const db = await readDB();
    
    // If cache is fresh (less than 1 hour old), return it
    if (db.facilities && db.facilities.length > 0 && db.facilities_updated_at) {
      const cacheAge = Date.now() - new Date(db.facilities_updated_at).getTime();
      if (cacheAge < 3600000) { // 1 hour
        console.log(`✅ Returning cached facilities (${db.facilities.length} items, age: ${Math.round(cacheAge/60000)}min)`);
        return res.json({
          facilities: db.facilities,
          count: db.facilities.length,
          source: 'cache',
          timestamp: new Date().toISOString()
        });
      }
    }
    
    // Fetch fresh data from BarentsWatch
    const facilities = await getAllFacilities();
    
    if (!facilities || facilities.length === 0) {
      return res.status(503).json({ 
        error: 'Could not fetch facilities from BarentsWatch',
        hint: 'Check .env credentials or API availability'
      });
    }
    
    // Update cache
    db.facilities = facilities;
    db.facilities_updated_at = new Date().toISOString();
    db.facilities_count = facilities.length;
    await writeDB(db);
    
    console.log(`✅ Fetched and cached ${facilities.length} facilities from BarentsWatch`);
    
    res.json({
      facilities,
      count: facilities.length,
      source: 'barentswatch',
      cached_at: db.facilities_updated_at,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('❌ Error fetching facilities:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/facilities/:id
 * Get single facility by ID
 */
router.get('/facilities/:id', async (req, res) => {
  try {
    const db = await readDB();
    const facility = (db.facilities || []).find(f => f.id === req.params.id);
    
    if (!facility) {
      return res.status(404).json({ error: 'Facility not found' });
    }
    
    res.json(facility);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ VESSELS ENDPOINTS ============

/**
 * GET /api/vessels
 * Returns all AIS vessels
 * Real data: 4066+ vessels
 */
router.get('/vessels', async (req, res) => {
  try {
    console.log('📡 Fetching vessels from AIS...');
    
    const db = await readDB();
    
    // Check cache (max 30 min for vessel data - more volatile)
    if (db.vessels && db.vessels.length > 0 && db.vessels_updated_at) {
      const cacheAge = Date.now() - new Date(db.vessels_updated_at).getTime();
      if (cacheAge < 1800000) { // 30 min
        console.log(`✅ Returning cached vessels (${db.vessels.length} items, age: ${Math.round(cacheAge/60000)}min)`);
        return res.json({
          vessels: db.vessels,
          count: db.vessels.length,
          source: 'cache',
          timestamp: new Date().toISOString()
        });
      }
    }
    
    // Fetch fresh data from AIS
    const vessels = await getAllVessels();
    
    if (!vessels || vessels.length === 0) {
      return res.status(503).json({ 
        error: 'Could not fetch vessels from AIS',
        hint: 'Check API availability'
      });
    }
    
    // Update cache
    db.vessels = vessels;
    db.vessels_updated_at = new Date().toISOString();
    db.vessels_count = vessels.length;
    await writeDB(db);
    
    console.log(`✅ Fetched and cached ${vessels.length} vessels from AIS`);
    
    res.json({
      vessels,
      count: vessels.length,
      source: 'ais',
      cached_at: db.vessels_updated_at,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('❌ Error fetching vessels:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/vessels/:id
 * Get single vessel by MMSI or ID
 */
router.get('/vessels/:id', async (req, res) => {
  try {
    const db = await readDB();
    const vessel = (db.vessels || []).find(v => v.id === req.params.id || v.mmsi === req.params.id);
    
    if (!vessel) {
      return res.status(404).json({ error: 'Vessel not found' });
    }
    
    res.json(vessel);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ SUMMARY ENDPOINTS ============

/**
 * GET /api/summary
 * Returns quick stats about facilities and vessels
 */
router.get('/summary', async (req, res) => {
  try {
    const db = await readDB();
    
    res.json({
      facilities: {
        count: (db.facilities || []).length,
        last_updated: db.facilities_updated_at || null,
        data_source: 'BarentsWatch'
      },
      vessels: {
        count: (db.vessels || []).length,
        last_updated: db.vessels_updated_at || null,
        data_source: 'AIS'
      },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
