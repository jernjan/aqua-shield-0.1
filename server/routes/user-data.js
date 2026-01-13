/**
 * User Data Routes - Facility/Vessel selection per user
 */

const express = require('express');
const router = express.Router();
const { readDB, writeDB } = require('../db');
const { assessAllRisks } = require('../utils/risk');

// ============ FACILITY SELECTION ============

/**
 * GET /api/user/facilities
 * Get user's selected facilities with risk scores
 */
router.get('/user/facilities', async (req, res) => {
  try {
    const userId = req.query.userId || 'movi'; // Demo user
    const db = await readDB();
    
    // Get user's selected facility IDs
    const user = db.users?.[userId] || {};
    const selectedIds = user.selectedFacilities || [];
    
    // Get all facilities
    let allFacilities = db.facilities || [];
    
    // Calculate risk scores
    allFacilities = await assessAllRisks(allFacilities, db.vessels || []);
    
    // Filter to only user's facilities
    const userFacilities = allFacilities.filter(f => 
      selectedIds.includes(f.id) || selectedIds.length === 0 // Show all if none selected (first time)
    );
    
    res.json({
      userId,
      facilities: userFacilities,
      selectedCount: selectedIds.length,
      totalCount: allFacilities.length,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/user/facilities/select
 * User selects which facilities to monitor
 * Body: { userId, facilityIds: [...] }
 */
router.post('/user/facilities/select', async (req, res) => {
  try {
    const { userId, facilityIds } = req.body;
    
    if (!userId || !facilityIds || !Array.isArray(facilityIds)) {
      return res.status(400).json({ error: 'userId and facilityIds array required' });
    }
    
    const db = await readDB();
    
    // Initialize users object if doesn't exist
    if (!db.users) db.users = {};
    
    // Create or update user
    if (!db.users[userId]) {
      db.users[userId] = {
        id: userId,
        createdAt: new Date().toISOString()
      };
    }
    
    // Update selected facilities
    db.users[userId].selectedFacilities = facilityIds;
    db.users[userId].updatedAt = new Date().toISOString();
    
    await writeDB(db);
    
    console.log(`✅ User ${userId} selected ${facilityIds.length} facilities`);
    
    res.json({
      success: true,
      userId,
      selectedFacilities: facilityIds,
      message: `Du følger nå ${facilityIds.length} anlegg`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/user/facilities/all
 * Get ALL facilities (for selection screen)
 */
router.get('/user/facilities/all', async (req, res) => {
  try {
    const db = await readDB();
    const allFacilities = db.facilities || [];
    
    res.json({
      facilities: allFacilities,
      count: allFacilities.length,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ VESSEL SELECTION ============

/**
 * GET /api/user/vessels
 * Get user's selected vessels
 */
router.get('/user/vessels', async (req, res) => {
  try {
    const userId = req.query.userId || 'aakerblå'; // Demo user
    const db = await readDB();
    
    const user = db.users?.[userId] || {};
    const selectedIds = user.selectedVessels || [];
    
    const allVessels = db.vessels || [];
    
    const userVessels = allVessels.filter(v => 
      selectedIds.includes(v.id) || selectedIds.length === 0
    );
    
    res.json({
      userId,
      vessels: userVessels,
      selectedCount: selectedIds.length,
      totalCount: allVessels.length,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/user/vessels/select
 * User selects which vessel to monitor
 */
router.post('/user/vessels/select', async (req, res) => {
  try {
    const { userId, vesselIds } = req.body;
    
    if (!userId || !vesselIds || !Array.isArray(vesselIds)) {
      return res.status(400).json({ error: 'userId and vesselIds array required' });
    }
    
    const db = await readDB();
    
    if (!db.users) db.users = {};
    if (!db.users[userId]) {
      db.users[userId] = { id: userId, createdAt: new Date().toISOString() };
    }
    
    db.users[userId].selectedVessels = vesselIds;
    db.users[userId].updatedAt = new Date().toISOString();
    
    await writeDB(db);
    
    console.log(`✅ User ${userId} selected ${vesselIds.length} vessels`);
    
    res.json({
      success: true,
      userId,
      selectedVessels: vesselIds,
      message: `Du følger nå ${vesselIds.length} skip`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/user/vessels/all
 * Get ALL vessels (for selection screen)
 */
router.get('/user/vessels/all', async (req, res) => {
  try {
    const db = await readDB();
    const allVessels = db.vessels || [];
    
    res.json({
      vessels: allVessels,
      count: allVessels.length,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
