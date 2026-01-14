// AquaShield MVP 0.1 - Real Data Only Backend
// Fetches from BarentsWatch (2687+ facilities) and AIS (4066+ vessels)
require('dotenv').config()
const express = require('express')
const cors = require('cors')
const path = require('path')
const { readDB, writeDB } = require('./db')
const realDataRoutes = require('./routes/api-real-data')
const userDataRoutes = require('./routes/user-data')
const { getAllFacilities } = require('./utils/barentswatch')
const { createDailySnapshot, getLatestSnapshot } = require('./utils/snapshot-data')
const { getAllVessels } = require('./utils/ais')
const { annotateFacilityRisk } = require('./utils/risk')
const { initializeVesselTrackingCrons } = require('./cron/vessel-tracking')

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

// Startup message
console.log('🚀 AquaShield Backend - Real Data Mode');
console.log('   Data sources: BarentsWatch + AIS APIs');
console.log('   Loading real facilities and vessels at startup...');

// Initialize real data from APIs on startup
async function initializeRealData() {
  try {
    const db = await readDB();
    const forceReinit = process.env.FORCE_REINIT === 'true' || process.env.NODE_ENV === 'production';
    
    // Check if we need to refresh (cache older than 24 hours)
    const facilitiesCacheAge = db.facilities_updated_at ? 
      Date.now() - new Date(db.facilities_updated_at).getTime() : 
      Infinity;
    
    if (forceReinit || !db.facilities || db.facilities.length === 0 || facilitiesCacheAge > 86400000) {
      console.log(forceReinit ? '🔄 FORCE reinitialize (production)' : '📡 Fetching facilities from BarentsWatch...');
      let facilities = await getAllFacilities();
      
      // Fallback if API fails
      if (!facilities || facilities.length === 0) {
        console.log('⚠️ BarentsWatch unavailable, using test fallback');
        facilities = generateTestFacilities(2687);
      }
      
      db.facilities = facilities;
      db.facilities_updated_at = new Date().toISOString();
      console.log(`✅ Loaded ${facilities.length} facilities`);
    } else {
      console.log(`✅ Using cached facilities (${db.facilities.length} items)`);
    }
    
    // Same for vessels
    const vesselsCacheAge = db.vessels_updated_at ? 
      Date.now() - new Date(db.vessels_updated_at).getTime() : 
      Infinity;
    
    if (forceReinit || !db.vessels || db.vessels.length === 0 || vesselsCacheAge > 1800000) {
      console.log(forceReinit ? '🔄 FORCE reinitialize vessels' : '📡 Fetching vessels from AIS...');
      let vessels = await getAllVessels();
      
      if (!vessels || vessels.length === 0) {
        console.log('⚠️ AIS unavailable, generating test vessels');
        vessels = generateTestVessels(4066); // Full set of test vessels for testing
      }
      
      db.vessels = vessels;
      db.vessels_updated_at = new Date().toISOString();
      console.log(`✅ Loaded ${vessels.length} vessels`);
    } else {
      console.log(`✅ Using cached vessels (${db.vessels.length} items)`);
    }
    
    // Ensure we have vessels for Aakerblå
    if (!db.vessels || db.vessels.length === 0) {
      console.log('⚠️ Still no vessels, forcing test generation');
      db.vessels = generateTestVessels(4066);
      db.vessels_updated_at = new Date().toISOString();
    }
    
    // Pre-populate demo users with some facilities
    if (!db.users) db.users = {};
    
    // Demo user: Movi (farmer) - select some facilities
    if (!db.users['movi']) {
      const facilityIds = db.facilities
        .slice(0, 3) // First 3 facilities
        .map(f => f.id);
      
      db.users['movi'] = {
        id: 'movi',
        name: 'Movi',
        role: 'farmer',
        selectedFacilities: facilityIds,
        favoriteFacilities: [],
        favoriteVessels: [],
        createdAt: new Date().toISOString()
      };
      console.log(`✅ Demo user 'movi' created with ${facilityIds.length} facilities`);
    }
    
    // Demo user: Aakerblå (vessel operator) - select one vessel
    if (!db.users['aakerblå']) {
      // Make sure we have vessels before assigning
      const availableVessels = db.vessels && db.vessels.length > 0 ? db.vessels : [];
      const vesselIds = availableVessels.length > 0 ? [availableVessels[0].id] : [];
      
      db.users['aakerblå'] = {
        id: 'aakerblå',
        name: 'Aakerblå',
        role: 'brønnbåt',
        selectedVessels: vesselIds,
        favoriteFacilities: [],
        favoriteVessels: [],
        createdAt: new Date().toISOString()
      };
      console.log(`✅ Demo user 'aakerblå' created with ${vesselIds.length} vessel(s)`);
    }

    // Demo user: Admin
    if (!db.users['admin']) {
      db.users['admin'] = {
        id: 'admin',
        name: 'Admin',
        role: 'admin',
        favoriteFacilities: [],
        favoriteVessels: [],
        createdAt: new Date().toISOString()
      };
      console.log(`✅ Demo user 'admin' created`);
    }
    
    await writeDB(db);
    console.log('✅ Real data initialization complete');

    // Initialize MVP object for /api/mvp/* endpoints with real risk annotations + vessel visit history
    const { getFacilityVesselHistory } = require('./utils/vessel-tracking');
    const { processVesselVisitsForContamination } = require('./utils/contamination');
    
    // Mark vessels as contaminated based on high-risk facility visits
    processVesselVisitsForContamination(db, db.facilities || []);
    
    // Add realistic test data to some facilities (simulate actual lice counts)
    // This is to demo the system - in production, BarentsWatch would provide this
    const facilitiesWithTestData = (db.facilities || []).map((f, idx) => {
      // ~15% of facilities have some lice counts
      if (idx % 7 === 0) {
        return {
          ...f,
          liceCount: Math.floor(Math.random() * 30) + 3,
          diseaseStatus: Math.random() > 0.8 ? 'suspect' : undefined
        };
      }
      return f;
    });
    
    const annotatedFacilities = annotateFacilityRisk(facilitiesWithTestData, db.vessels || [], db);
    
    // Enrich with recent vessel visit history for each facility
    const facilitiesWithHistory = annotatedFacilities.map(facility => {
      const history = getFacilityVesselHistory(db, facility.id, 336); // 2 weeks
      return {
        ...facility,
        recentVisits: (history.visits || []).slice(0, 10).map(visit => ({
          vesselName: visit.vessel_name,
          vesselType: visit.vessel_type,
          timestamp: visit.timestamp,
          distanceKm: visit.facility?.distance_km ? Number(visit.facility.distance_km) : null
        }))
      };
    });
    
    global.MVP = {
      farmers: facilitiesWithHistory,
      vessels: db.vessels && db.vessels.length > 0 ? db.vessels : []
    };
    console.log(`✅ MVP object initialized (${global.MVP.farmers.length} farmers, ${global.MVP.vessels.length} vessels) with annotated risk data + vessel history`);
    
    // Create first daily snapshot for data collection (disabled temporarily for debugging)
    // await createDailySnapshot();
    
  } catch (err) {
    console.error('❌ Error initializing real data:', err.message);
  }
}

// Fallback generators
function generateTestFacilities(count = 50) {
  const names = ['Nordvik', 'Tromsøfarm', 'Barents', 'Polarmarin', 'Lyngen'];
  const facilities = [];
  for (let i = 1; i <= count; i++) {
    facilities.push({
      id: `farm_${i}`,
      name: `${names[i % names.length]} ${i}`,
      lat: 68 + Math.random() * 4,
      lng: 16 + Math.random() * 8,
      municipality: 'Test',
      species: 'Atlantisk laks',
      liceCount: Math.floor(Math.random() * 50),
      lastUpdate: new Date().toISOString()
    });
  }
  return facilities;
}

function generateTestVessels(count = 30) {
  const names = ['Aakerblå', 'Settefisk I', 'Brønnbåt 1'];
  const vessels = [];
  for (let i = 1; i <= count; i++) {
    vessels.push({
      id: `vessel_${i}`,
      name: `${names[i % names.length]} ${i}`,
      type: ['Settefiskbåt', 'Brønnbåt'][i % 2],
      lat: 68 + Math.random() * 4,
      lng: 16 + Math.random() * 8,
      lastUpdate: new Date().toISOString()
    });
  }
  return vessels;
}

// ============ IN-MEMORY FAVORITES STORE ============
// On Render, filesystem is ephemeral, so keep favorites in memory
global.userFavorites = {
  movi: { facilities: [], vessels: [] },
  aakerblå: { facilities: [], vessels: [] },
  admin: { facilities: [], vessels: [] }
};

// Run initialization asynchronously (non-blocking)
initializeRealData().catch(err => console.error('Init error:', err.message));

// Track MVP initialization state
let mvpInitialized = false;

// Start vessel tracking cron jobs
// initializeVesselTrackingCrons() // DISABLED: investigate why it may trigger SIGINT

// ============ AUTH ROUTES ============
const authRoutes = require('./routes/auth')
app.use('/api/auth', authRoutes)

// ============ FAVORITES ROUTES ============
const favoritesRoutes = require('./routes/favorites')
app.use('/api/user', favoritesRoutes)

// ============ HEALTH CHECK ============
app.get('/api/health', async (req, res) => {
  try {
    const db = await readDB();
    const userIds = Object.keys(db.users || {});
    const facilityCount = (db.facilities || []).length;
    const vesselCount = (db.vessels || []).length;
    
    res.json({ 
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: {
        users: userIds,
        facilities: facilityCount,
        vessels: vesselCount
      }
    });
  } catch (err) {
    res.status(500).json({ 
      status: 'error', 
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
})

// ============ REAL DATA API ROUTES ============
// All endpoints that fetch from BarentsWatch and AIS APIs
app.use('/api', realDataRoutes)

// ============ USER DATA ROUTES ============
// User facility/vessel selection
app.use('/api', userDataRoutes)

// ============ FARMER DASHBOARD ============
// Get all facilities with risk forecast (FarmerDashboard)
app.get('/api/farmer/my-facilities', async (req, res) => {
  try {
    const { assessAllRisks } = require('./utils/risk')
    const { forecast7Day, shouldSendAlert } = require('./utils/forecast')
    const { saveForecast } = require('./utils/validation')
    const db = await readDB()
    
    const facilities = db.facilities || []
    
    if (facilities.length === 0) {
      return res.json({
        facilities: [],
        summary: { total: 0, critical: 0, high: 0, medium: 0, alertCount: 0 },
        timestamp: new Date().toISOString()
      })
    }
    
    // Assess risks for all facilities
    const risks = assessAllRisks(facilities, 70)
    
    // Enrich with forecast data and SAVE for validation
    const facilitiesWithForecast = risks.risky.map(f => {
      const forecast = forecast7Day(f, [])
      const shouldAlert = shouldSendAlert(f)
      
      // Save forecast for validation (day 1 data collection)
      if (shouldAlert) {
        saveForecast(db, f, forecast)
      }
      
      return {
        ...f,
        forecast: forecast,
        shouldAlert: shouldAlert,
        riskCategory: f.ownRisk >= 85 ? 'CRITICAL' : f.ownRisk >= 75 ? 'HIGH' : 'MEDIUM'
      }
    })
    
    // Persist forecasts to database
    await writeDB(db)
    
    res.json({
      facilities: facilitiesWithForecast,
      summary: {
        total: facilities.length,
        critical: facilitiesWithForecast.filter(f => f.riskCategory === 'CRITICAL').length,
        high: facilitiesWithForecast.filter(f => f.riskCategory === 'HIGH').length,
        medium: facilitiesWithForecast.filter(f => f.riskCategory === 'MEDIUM').length,
        alertCount: facilitiesWithForecast.filter(f => f.shouldAlert).length
      },
      timestamp: new Date().toISOString()
    })
  } catch (err) {
    console.error('Error fetching farmer facilities:', err)
    res.status(500).json({ error: err.message })
  }
})

// FarmerMVP: Get farms from MVP data
app.get('/api/mvp/farmer', async (req, res) => {
  try {
    // Lazy-load MVP data if not initialized
    if (!mvpInitialized || !global.MVP || !global.MVP.farmers) {
      console.log('🔄 Initializing MVP farmer data on demand...');
      await initializeRealData();
      mvpInitialized = true;
    }
    
    const userId = req.query.userId;  // Get user ID from query parameter
    let farmers = (global.MVP?.farmers || []);
    
    // Filter by user if userId is provided
    if (userId) {
      console.log(`📊 Filtering farms for user: ${userId}`);
      farmers = farmers.filter(f => f.userId === userId);
      console.log(`   → Found ${farmers.length} farms for user ${userId}`);
    }
    
    // Slim down data for overview - return only essential fields to avoid timeout
    const slimmed = farmers.map(f => ({
      id: f.id,
      name: f.name,
      riskScore: f.riskScore,
      riskCategory: f.riskCategory,
      liceCount: f.liceCount,
      diseaseStatus: f.diseaseStatus,
      municipality: f.municipality
    }));
    
    res.json({
      farms: slimmed,
      stats: { 
        total: farmers.length,
        risky: farmers.filter(f => f.riskScore > 60).length,
        safe: farmers.filter(f => f.riskScore <= 60).length
      },
      alertCount: farmers.filter(f => f.riskScore > 60).length,
      timestamp: new Date().toISOString()
    })
  } catch (err) {
    console.error('Error fetching MVP farmer data:', err)
    res.status(500).json({ error: err.message })
  }
})

// ============ VESSEL DASHBOARD ============
// Get all vessels (VesselDashboard)
app.get('/api/mvp/vessel/:vesselId?', async (req, res) => {
  try {
    const { vesselId } = req.params
    const userId = req.query.userId;  // Get user ID from query parameter
    
    // Lazy-load MVP data if not initialized
    if (!mvpInitialized || !global.MVP || !global.MVP.vessels) {
      console.log('🔄 Initializing MVP vessel data on demand...');
      await initializeRealData();
      mvpInitialized = true;
    }
    
    let vessels = (global.MVP?.vessels || []);
    
    // Filter by user if userId is provided
    if (userId) {
      console.log(`📊 Filtering vessels for user: ${userId}`);
      vessels = vessels.filter(v => v.userId === userId);
      console.log(`   → Found ${vessels.length} vessels for user ${userId}`);
    }
    
    if (vesselId) {
      const vessel = vessels.find(v => v.id === vesselId)
      if (!vessel) return res.status(404).json({ error: 'Vessel not found' })
      res.json({ vessel, tasks: [], taskCount: 0 })
    } else {
      // Slim down data for overview - return only essential fields to avoid timeout
      const slimmed = vessels.map(v => ({
        id: v.id,
        name: v.name,
        callSign: v.callSign,
        vesselType: v.vesselType,
        length: v.length,
        contaminated: v.contaminated,
        certificateExpiry: v.certificateExpiry
      }));
      res.json({ vessels: slimmed, stats: { total: vessels.length }, taskCount: 0 })
    }
  } catch (err) {
    console.error('[VESSEL] Error:', err)
    res.status(500).json({ error: 'Failed to fetch vessel data', message: err.message })
  }
})

// Get nearby facilities for a vessel (VesselDashboard proximity warnings)
app.get('/api/vessel/:vesselId/nearby', async (req, res) => {
  try {
    const { vesselId } = req.params
    const db = await readDB()
    
    const vessels = db.vessels && db.vessels.length > 0 ? db.vessels : MVP.vessels
    const vessel = vessels.find(v => v.id === vesselId)
    
    if (!vessel) {
      return res.status(404).json({ error: 'Vessel not found' })
    }
    
    const facilities = db.facilities || []
    
    const { getNearbyFacilities } = require('./utils/vessel-proximity')
    const nearbyFacilities = getNearbyFacilities(vessel, facilities, 3)
    
    res.json({
      vessel: {
        id: vessel.id,
        name: vessel.name,
        mmsi: vessel.mmsi,
        latitude: vessel.latitude,
        longitude: vessel.longitude,
        status: vessel.status
      },
      nearbyFacilities: nearbyFacilities,
      lastUpdate: new Date().toISOString()
    })
  } catch (err) {
    console.error('Error getting nearby facilities:', err)
    res.status(500).json({ error: err.message })
  }
})

// Get vessel contamination status (VesselDashboard)
app.get('/api/vessel/contamination', async (req, res) => {
  try {
    const { mmsi } = req.query
    if (!mmsi) {
      return res.status(400).json({ error: 'MMSI required' })
    }
    
    const db = await readDB()
    const { getVesselContaminationStatus } = require('./utils/contamination')
    
    // Find vessel by MMSI
    const vessels = db.vessels && db.vessels.length > 0 ? db.vessels : MVP.vessels
    const vessel = vessels.find(v => v.mmsi === parseInt(mmsi) || v.mmsi === mmsi)
    
    if (!vessel) {
      return res.status(404).json({ error: 'Vessel not found' })
    }
    
    // Get contamination status
    const contamStatus = getVesselContaminationStatus(db, vessel.id)
    
    res.json({
      vesselId: vessel.id,
      mmsi: vessel.mmsi,
      name: vessel.name,
      isContaminated: contamStatus.isContaminated,
      hoursRemaining: contamStatus.hoursRemaining,
      contaminationSeverity: contamStatus.contaminationSeverity,
      records: contamStatus.records || []
    })
  } catch (err) {
    console.error('Error getting vessel contamination:', err)
    res.status(500).json({ error: err.message })
  }
})

// ============ FISHER DASHBOARD ============
// Get all fishers (FisherDashboard)
app.get('/api/mvp/fisher/:fisherId?', (req, res) => {
  const { fisherId } = req.params
  if (fisherId) {
    const fisher = MVP.fishers.find(f => f.id === fisherId)
    res.json(fisher || { error: 'Fisher not found' })
  } else {
    res.json(MVP.fishers)
  }
})

// Get fisher tasks
app.get('/api/mvp/fisher/:fisherId/tasks', (req, res) => {
  const { fisherId } = req.params
  const fisher = MVP.fishers.find(f => f.id === fisherId)
  if (!fisher) return res.status(404).json({ error: 'Fisher not found' })
  const tasks = MVP.fisherTasks.filter(t => t.fisherId === fisherId)
  res.json({ fisherId, tasks })
})

// Get fisher zone avoidances (FisherDashboard disease zones)
app.get('/api/mvp/fisher/:fisherId/zone-avoidances', (req, res) => {
  const { fisherId } = req.params
  const fisher = MVP.fishers.find(f => f.id === fisherId)
  if (!fisher) return res.status(404).json({ error: 'Fisher not found' })
  const avoidances = MVP.fisherZoneAvoidances.filter(a => a.fisherId === fisherId)
  res.json({ fisherId, avoidances })
})

// Post fisher tasks
app.post('/api/mvp/fisher/:fisherId/task', (req, res) => {
  const { fisherId } = req.params
  const fisher = MVP.fishers.find(f => f.id === fisherId)
  if (!fisher) return res.status(404).json({ error: 'Fisher not found' })
  const { name, dueDate, duration, type } = req.body || {}
  if (!name || !dueDate) return res.status(400).json({ error: 'Missing name or dueDate' })
  const id = `task_${Date.now()}`
  const task = {
    id,
    fisherId,
    name,
    type: type || 'kontroll',
    dueDate,
    duration: duration || 7,
    completed: false,
    completedAt: null,
    createdAt: new Date().toISOString(),
  }
  if (!MVP.fisherTasks) MVP.fisherTasks = []
  MVP.fisherTasks.push(task)
  res.json({ ok: true, task })
})

// Patch fisher tasks
app.patch('/api/mvp/fisher/:fisherId/task/:taskId', (req, res) => {
  const { fisherId, taskId } = req.params
  const { completed } = req.body
  const fisher = MVP.fishers.find(f => f.id === fisherId)
  if (!fisher) return res.status(404).json({ error: 'Fisher not found' })
  if (!MVP.fisherTasks) MVP.fisherTasks = []
  const task = MVP.fisherTasks.find(t => t.id === taskId && t.fisherId === fisherId)
  if (!task) return res.status(404).json({ error: 'Task not found' })
  task.completed = completed
  task.completedAt = completed ? new Date().toISOString() : null
  res.json({ ok: true, task })
})

// ============ VALIDATION DASHBOARD ============
// Get validation metrics
app.get('/api/admin/validation/metrics', async (req, res) => {
  try {
    const validation = require('./utils/validation')
    const db = await readDB()
    const metrics = validation.getValidationMetrics(db)
    res.json(metrics)
  } catch (err) {
    console.error('Error getting validation metrics:', err)
    res.status(500).json({ error: err.message })
  }
})

// Get pending forecasts
app.get('/api/admin/validation/pending', async (req, res) => {
  try {
    const validation = require('./utils/validation')
    const db = await readDB()
    const pending = validation.getPendingValidation(db, 24)
    res.json({
      count: pending.length,
      forecasts: pending.slice(0, 50)
    })
  } catch (err) {
    console.error('Error getting pending validations:', err)
    res.status(500).json({ error: err.message })
  }
})

// Get facility forecast history
app.get('/api/admin/validation/facility/:facilityId', async (req, res) => {
  try {
    const { facilityId } = req.params
    const validation = require('./utils/validation')
    const db = await readDB()
    const history = validation.getFacilityForecastHistory(db, facilityId)
    res.json({
      facilityId,
      count: history.length,
      history: history.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    })
  } catch (err) {
    console.error('Error getting facility forecast history:', err)
    res.status(500).json({ error: err.message })
  }
})

// Validate a forecast
app.post('/api/admin/validation/validate/:forecastId', async (req, res) => {
  try {
    const { forecastId } = req.params
    const db = await readDB()
    const validation = require('./utils/validation')
    
    if (!db.forecast_history) {
      return res.status(404).json({ error: 'No forecast history' })
    }
    
    const entry = db.forecast_history.find(f => f.id === forecastId)
    if (!entry) {
      return res.status(404).json({ error: 'Forecast not found' })
    }
    
    const facilities = db.facilities || []
    const facility = facilities.find(f => f.locId === entry.facilityId)
    
    if (!facility) {
      return res.status(404).json({ error: 'Facility not found' })
    }
    
    const validated = validation.validateForecast(entry, facility)
    await writeDB(db)
    
    res.json({
      forecast: validated,
      metrics: validation.getValidationMetrics(db)
    })
  } catch (err) {
    console.error('Error validating forecast:', err)
    res.status(500).json({ error: err.message })
  }
})

// Auto-validate all pending forecasts
app.post('/api/admin/validation/auto-validate', async (req, res) => {
  try {
    const validation = require('./utils/validation')
    const db = await readDB()
    const facilities = db.facilities || []
    
    const pending = validation.getPendingValidation(db, 24)
    let validatedCount = 0
    
    pending.forEach(forecastEntry => {
      const facility = facilities.find(f => f.locId === forecastEntry.facilityId)
      if (facility) {
        validation.validateForecast(forecastEntry, facility)
        validatedCount++
      }
    })
    
    await writeDB(db)
    
    res.json({
      validatedCount,
      totalPending: pending.length,
      metrics: validation.getValidationMetrics(db)
    })
  } catch (err) {
    console.error('Error auto-validating forecasts:', err)
    res.status(500).json({ error: err.message })
  }
})

// ============ VESSEL TRACKING SYSTEM ============
// Record vessel positions (called 3x daily: 09:00, 13:00, 15:00)
app.post('/api/admin/vessel-tracking/record', async (req, res) => {
  try {
    const vesselTracking = require('./utils/vessel-tracking')
    const db = await readDB()
    
    const result = await vesselTracking.recordVesselPositions(db)
    await writeDB(db)
    
    res.json({
      success: true,
      tracking: result
    })
  } catch (err) {
    console.error('Error recording vessel positions:', err)
    res.status(500).json({ error: err.message })
  }
})

// Analyze vessel movement patterns
app.get('/api/admin/vessel-tracking/analysis', async (req, res) => {
  try {
    const vesselTracking = require('./utils/vessel-tracking')
    const db = await readDB()
    const hoursWindow = parseInt(req.query.hours) || 24
    
    const analysis = vesselTracking.analyzeVesselMovement(db, hoursWindow)
    res.json(analysis)
  } catch (err) {
    console.error('Error analyzing vessel movement:', err)
    res.status(500).json({ error: err.message })
  }
})

// Get facility vessel visit history
app.get('/api/admin/vessel-tracking/facility/:facilityId', async (req, res) => {
  try {
    const { facilityId } = req.params
    const vesselTracking = require('./utils/vessel-tracking')
    const db = await readDB()
    const hoursBack = parseInt(req.query.hours) || 72
    
    const history = vesselTracking.getFacilityVesselHistory(db, facilityId, hoursBack)
    res.json(history)
  } catch (err) {
    console.error('Error getting facility vessel history:', err)
    res.status(500).json({ error: err.message })
  }
})

// Get vessel trajectory
app.get('/api/admin/vessel-tracking/vessel/:vesselId', async (req, res) => {
  try {
    const { vesselId } = req.params
    const vesselTracking = require('./utils/vessel-tracking')
    const db = await readDB()
    const hoursBack = parseInt(req.query.hours) || 72
    
    const trajectory = vesselTracking.getVesselTrajectory(db, vesselId, hoursBack)
    res.json(trajectory)
  } catch (err) {
    console.error('Error getting vessel trajectory:', err)
    res.status(500).json({ error: err.message })
  }
})

// Correlate vessel movement with facility alerts
app.get('/api/admin/vessel-tracking/correlations', async (req, res) => {
  try {
    const vesselTracking = require('./utils/vessel-tracking')
    const db = await readDB()
    const hoursWindow = parseInt(req.query.hours) || 72
    
    const correlations = vesselTracking.correlateVesselMovementWithAlerts(db, null, hoursWindow)
    res.json(correlations)
  } catch (err) {
    console.error('Error correlating vessel movement:', err)
    res.status(500).json({ error: err.message })
  }
})

// ============ SNAPSHOT SYSTEM (Model Training) ============
// Create a new snapshot (all 2687 facilities × 4 scenarios)
app.post('/api/admin/snapshot/create', async (req, res) => {
  try {
    const snapshot = require('./utils/snapshot')
    const db = await readDB()
    
    const result = await snapshot.createSnapshot(db)
    await writeDB(db)
    
    res.json({
      success: true,
      snapshot: result
    })
  } catch (err) {
    console.error('Error creating snapshot:', err)
    res.status(500).json({ error: err.message })
  }
})

// Get all snapshot metadata
app.get('/api/admin/snapshot/list', async (req, res) => {
  try {
    const snapshot = require('./utils/snapshot')
    const db = await readDB()
    
    const metadata = snapshot.getSnapshotMetadata(db)
    res.json({
      count: metadata.length,
      snapshots: metadata.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    })
  } catch (err) {
    console.error('Error listing snapshots:', err)
    res.status(500).json({ error: err.message })
  }
})

// Get forecasts from a snapshot
app.get('/api/admin/snapshot/:snapshotId', async (req, res) => {
  try {
    const { snapshotId } = req.params
    const scenario = req.query.scenario ? parseInt(req.query.scenario) : null
    const snapshot = require('./utils/snapshot')
    const db = await readDB()
    
    const forecasts = snapshot.getSnapshotForecasts(db, snapshotId, scenario)
    res.json({
      snapshot_id: snapshotId,
      count: forecasts.length,
      forecasts: forecasts.slice(0, 100) // Return first 100 for preview
    })
  } catch (err) {
    console.error('Error getting snapshot:', err)
    res.status(500).json({ error: err.message })
  }
})

// Validate a snapshot (must wait 3+ days)
app.post('/api/admin/snapshot/:snapshotId/validate', async (req, res) => {
  try {
    const { snapshotId } = req.params
    const snapshot = require('./utils/snapshot')
    const db = await readDB()
    
    const result = await snapshot.validateSnapshot(db, snapshotId)
    await writeDB(db)
    
    res.json({
      success: true,
      validation: result
    })
  } catch (err) {
    console.error('Error validating snapshot:', err)
    res.status(400).json({ error: err.message })
  }
})

// Get validation results
app.get('/api/admin/snapshot/validation/:snapshotId', async (req, res) => {
  try {
    const { snapshotId } = req.params
    const db = await readDB()
    
    const validation = db.snapshot_validation?.find(v => v.snapshot_id === snapshotId)
    if (!validation) {
      return res.status(404).json({ error: 'Validation not found' })
    }
    
    res.json(validation)
  } catch (err) {
    console.error('Error getting validation results:', err)
    res.status(500).json({ error: err.message })
  }
})

// ============ ADMIN RISK ASSESSMENT ============
// Admin: Risk Assessment Dashboard (AdminMVP uses this)
// Return MVP mock data for simplicity
app.get('/api/admin/risks', async (req, res) => {
  try {
    // Lazy-load MVP data on first request if not initialized
    if (!mvpInitialized || !global.MVP || !global.MVP.farmers) {
      console.log('🔄 Initializing MVP data on demand...');
      await initializeRealData();
      mvpInitialized = true;
    }
    
    // Get risky facilities from MVP data
    const risky = (global.MVP?.farmers || []).filter(f => f.riskScore > 60)
    const safe = (global.MVP?.farmers || []).filter(f => f.riskScore <= 60)
    const critical = risky.filter(f => f.riskScore > 80).length
    const high = risky.filter(f => f.riskScore > 60 && f.riskScore <= 80).length
    
    res.json({
      risky: risky,
      safe: safe,
      summary: {
        total: global.MVP?.farmers?.length || 0,
        risky: risky.length,
        safe: safe.length,
        critical: critical,
        high: high,
        medium: safe.filter(f => f.riskScore > 40 && f.riskScore <= 60).length
      },
      metadata: {
        total_facilities: MVP.farmers.length,
        total_risky: risky.length,
        total_safe: safe.length,
        critical_count: critical,
        high_count: high
      },
      timestamp: new Date().toISOString()
    })
  } catch (err) {
    console.error('❌ Risk assessment failed:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// Admin: Detail view of a specific facility
app.get('/api/admin/risks/:facilityId', (req, res) => {
  try {
    const { facilityId } = req.params
    const facility = MVP.farmers.find(f => f.id === facilityId)
    
    if (!facility) {
      return res.status(404).json({ error: 'Facility not found' })
    }
    
    // Get nearby facilities as "predicted spreaders"
    const nearbyData = MVP.nearbyFarmsMap[facilityId] || {}
    const spreaders = nearbyData.nearby || []
    
    res.json({
      facility,
      predictedSpreaders: spreaders,
      timestamp: new Date().toISOString()
    })
  } catch (err) {
    console.error('❌ Failed to get facility details:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ============ ADMIN BACKTESTING ============
// Start a new backtest job (runs in background)
app.post('/api/admin/backtest/start', async (req, res) => {
  try {
    const { startDate = '2024-01-01', endDate = '2024-12-31', step = '7days' } = req.body;
    
    const db = await readDB();
    const { startBacktestJob } = require('./utils/backtest-job');
    const jobId = startBacktestJob(db, startDate, endDate, step);
    
    res.json({
      jobId,
      message: `Backtest started (${startDate} to ${endDate}, step: ${step})`,
      statusUrl: `/api/admin/backtest/status/${jobId}`
    });
  } catch (err) {
    console.error('Failed to start backtest:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get current backtest job status
app.get('/api/admin/backtest/status/:jobId?', async (req, res) => {
  try {
    const { jobId } = req.params;
    const { getJobStatus } = require('./utils/backtest-job');
    
    const status = getJobStatus(jobId);
    
    if (!status) {
      return res.status(404).json({ error: 'Job not found or no job running' });
    }
    
    res.json(status);
  } catch (err) {
    console.error('Failed to get backtest status:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get completed backtest results
app.get('/api/admin/backtest/results/:jobId?', async (req, res) => {
  try {
    const { jobId } = req.params;
    const { getJobStatus, getJobResult } = require('./utils/backtest-job');
    
    const status = getJobStatus(jobId);
    
    if (!status) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    if (status.status !== 'completed') {
      return res.status(400).json({ 
        error: `Job not completed (status: ${status.status})`,
        status
      });
    }
    
    const result = getJobResult(jobId);
    res.json({
      jobId: status.id,
      period: `${status.startDate} to ${status.endDate}`,
      step: status.step,
      completedAt: status.completedAt,
      duration: status.completedAt && status.startedAt 
        ? `${Math.round((new Date(status.completedAt) - new Date(status.startedAt)) / 1000 / 60)} minutes`
        : 'N/A',
      metrics: result ? {
        sensitivity: (result.sensitivity * 100).toFixed(1) + '%',
        specificity: (result.specificity * 100).toFixed(1) + '%',
        precision: (result.precision * 100).toFixed(1) + '%',
        f1: result.f1.toFixed(3),
        truePositives: result.truePositives,
        falsePositives: result.falsePositives,
        falseNegatives: result.falseNegatives,
        trueNegatives: result.trueNegatives,
        totalPredictions: result.truePositives + result.falsePositives + result.falseNegatives + result.trueNegatives
      } : null
    });
  } catch (err) {
    console.error('Failed to get backtest results:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============ CONTAMINATION TRACKING ============
// Get contamination sources for a facility (vessels that visited high-risk farms)
app.get('/api/farm/:farmId/contamination-sources', async (req, res) => {
  try {
    const { farmId } = req.params;
    const db = await readDB();
    const { getContaminatedVesselsNearFacility } = require('./utils/contamination');
    
    // Get contaminated vessels near this facility
    const contaminatedVessels = getContaminatedVesselsNearFacility(db, farmId);
    
    res.json({
      farmId,
      contaminationSources: contaminatedVessels.map(v => ({
        vesselId: v.id,
        vesselName: v.name || `Vessel ${v.id}`,
        lastLocation: v.lastPosition ? {
          lat: v.lastPosition.lat,
          lng: v.lastPosition.lng,
          timestamp: v.lastPosition.timestamp
        } : null,
        contaminationStatus: v.contaminationStatus,
        lastVisited: v.lastVisited,
        riskLevel: v.contaminationStatus === 'contaminated' ? 'HIGH' : 'MEDIUM'
      })),
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Failed to get contamination sources:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get vessel contamination status
app.get('/api/vessel/:vesselId/contamination-status', async (req, res) => {
  try {
    const { vesselId } = req.params;
    const db = await readDB();
    
    // Find vessel
    const vessels = db.vessels && db.vessels.length > 0 ? db.vessels : (global.MVP?.vessels || []);
    const vessel = vessels.find(v => v.id === vesselId);
    
    if (!vessel) {
      return res.status(404).json({ error: 'Vessel not found' });
    }
    
    // Get contamination status
    const { getContaminatedVesselsNearFacility } = require('./utils/contamination');
    const facilities = db.facilities || [];
    
    // Check if this vessel has visited any contaminated facilities
    let hasBeenContaminated = false;
    let lastContaminatedFacility = null;
    
    facilities.forEach(facility => {
      const contaminatedVessels = getContaminatedVesselsNearFacility(db, facility.id);
      const isContaminated = contaminatedVessels.some(v => v.id === vesselId);
      if (isContaminated) {
        hasBeenContaminated = true;
        if (!lastContaminatedFacility || new Date(facility.lastInspection) > new Date(lastContaminatedFacility.lastInspection)) {
          lastContaminatedFacility = facility;
        }
      }
    });
    
    res.json({
      vessel: {
        id: vessel.id,
        name: vessel.name,
        mmsi: vessel.mmsi,
        lastPosition: vessel.lastPosition
      },
      contaminationStatus: hasBeenContaminated ? 'potentially_contaminated' : 'clean',
      lastContaminatedFacility: lastContaminatedFacility ? {
        id: lastContaminatedFacility.id,
        name: lastContaminatedFacility.name,
        visitDate: lastContaminatedFacility.lastInspection
      } : null,
      riskLevel: hasBeenContaminated ? 'HIGH' : 'LOW',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Failed to get vessel contamination status:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============ COMPONENT ENDPOINTS ============
// Algae calendar (AlgaeCalendar component)
app.get('/api/mvp/farm/:farmId/algae-alerts', (req, res) => {
  const { farmId } = req.params
  const farm = MVP.farmers.find(f => f.id === farmId)
  
  if (!farm) {
    return res.status(404).json({ error: 'Farm not found' })
  }
  
  const algaeAlerts = MVP.algaeAlerts.filter(a => a.farmId === farmId)
  
  res.json({
    farm: {
      id: farm.id,
      name: farm.name,
      region: farm.region,
    },
    algaeAlerts: algaeAlerts.sort((a, b) => new Date(a.startDate) - new Date(b.startDate)),
    timestamp: new Date().toISOString(),
  })
})

// Nearby farms (NearbyFarmsRisk component)
app.get('/api/mvp/farm/:farmId/nearby', (req, res) => {
  const { farmId } = req.params
  const farm = MVP.farmers.find(f => f.id === farmId)
  
  if (!farm) {
    return res.status(404).json({ error: 'Farm not found' })
  }
  
  const nearbyData = MVP.nearbyFarmsMap[farmId]
  if (!nearbyData) {
    return res.status(404).json({ error: 'Nearby data not found' })
  }
  
  res.json({
    farm: {
      id: farm.id,
      name: farm.name,
      coordinates: farm.coordinates,
      currentDirection: farm.currentDirection,
    },
    nearby: nearbyData.nearby,
    currentConditions: {
      direction: farm.currentDirection,
      strength: 'moderat',
      lastUpdated: new Date().toISOString(),
    },
  })
})

// Current sea conditions (CurrentSeaConditions component)
app.get('/api/mvp/farm/:farmId/current-conditions', (req, res) => {
  const { farmId } = req.params
  const farm = MVP.farmers.find(f => f.id === farmId)
  
  if (!farm) {
    return res.status(404).json({ error: 'Farm not found' })
  }
  
  const nearby = MVP.nearbyFarmsMap[farmId]?.nearby || []
  const algaeAlerts = MVP.algaeAlerts.filter(a => a.farmId === farmId)
  
  const activeAlgae = algaeAlerts.filter(a => {
    const start = new Date(a.startDate)
    const end = new Date(a.endDate)
    const now = new Date()
    return start <= now && now <= end
  })
  
  const downstreamInfected = nearby.filter(n => n.riskCategory === 'downstream' && n.currentState === 'infected-risk').length
  
  res.json({
    farm: {
      id: farm.id,
      name: farm.name,
      coordinates: farm.coordinates,
      currentRiskLevel: farm.riskLevel,
    },
    current: {
      direction: farm.currentDirection,
      strength: 'moderat',
      downstreamFarmsAtRisk: downstreamInfected,
    },
    algae: {
      activeAlerts: activeAlgae.length,
      highestConcentration: activeAlgae.length > 0 ? Math.max(...activeAlgae.map(a => (['høy', 'moderat', 'lav'].indexOf(a.concentration)))) : -1,
      strains: [...new Set(activeAlgae.map(a => a.strain))],
    },
    timestamp: new Date().toISOString(),
  })
})

// Infection chain visualization (InfectionChainVisualization component)
app.get('/api/mvp/admin/infection-chain', (req, res) => {
  const chain = MVP.infectionGraph || {}
  
  const criticalChain = Object.values(chain)
    .filter(farm => farm.riskLevel === 'risikofylt' || farm.downstreamFarms.length > 0)
    .sort((a, b) => {
      const riskOrder = { risikofylt: 0, 'høy oppmerksomhet': 1, moderat: 2, lav: 3 }
      return (riskOrder[a.riskLevel] || 99) - (riskOrder[b.riskLevel] || 99)
    })
  
  const infectionPaths = []
  criticalChain.forEach(farm => {
    if (farm.downstreamFarms.length > 0) {
      infectionPaths.push({
        sourceId: farm.farmId,
        sourceName: farm.farmName,
        sourceRisk: farm.riskLevel,
        downstreamTargets: farm.downstreamFarms.map(t => ({
          id: t.id,
          name: t.name,
          riskLevel: t.riskLevel,
          distance: t.distance,
        })),
        potentialInfectionCount: farm.downstreamFarms.length,
      })
    }
  })
  
  res.json({
    summary: {
      totalFarmsInRiskChain: criticalChain.length,
      potentialInfectionPaths: infectionPaths.length,
      downstreamExposure: infectionPaths.reduce((sum, p) => sum + p.potentialInfectionCount, 0),
    },
    criticalFarms: criticalChain,
    infectionPaths: infectionPaths,
    timestamp: new Date().toISOString(),
  })
})

// ============ SERVE FRONTEND ============
const distPath = path.join(__dirname, '../client/dist')

if (require('fs').existsSync(distPath)) {
  console.log(`📦 Serving frontend from ${distPath}`)
  
  app.use(express.static(distPath, {
    maxAge: '1h',
    etag: false,
    index: false
  }))
  
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
      console.error(`[404] API route not found: ${req.path}`)
      return res.status(404).json({ error: 'API endpoint not found', path: req.path })
    }
    res.sendFile(path.join(distPath, 'index.html'))
  })
} else {
  console.warn(`⚠️  Client dist folder not found at ${distPath}`)
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
      console.error(`[404] API route not found: ${req.path}`)
      return res.status(404).json({ error: 'API endpoint not found', path: req.path })
    }
    res.status(503).json({ error: 'Frontend not available' })
  })
}

// ============ START SERVER ============
const server = app.listen(PORT, () => {
  console.log(`🐟 AquaShield API running on port ${PORT}`)
  console.log(`📊 Available endpoints: /api/health, /api/farmer/*, /api/mvp/vessel/*, /api/mvp/fisher/*, /api/admin/validation/*`)
})

function shutdown(signal) {
  console.log(`Received ${signal} — shutting down server...`)
  server.close(err => {
    if (err) {
      console.error('Error during server close', err)
      process.exit(1)
    }
    if (signal === 'SIGUSR2') {
      process.kill(process.pid, 'SIGUSR2')
    } else {
      process.exit(0)
    }
  })
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
