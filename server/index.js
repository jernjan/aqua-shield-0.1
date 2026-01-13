// AquaShield MVP 0.1 - Simplified Backend
// Only endpoints that are actually used by frontend
require('dotenv').config()
const express = require('express')
const cors = require('cors')
const path = require('path')
const { readDB, writeDB } = require('./db')
const mvpData = require('./mvp-data')

// Initialize MVP data
const MVP = mvpData.init()

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

// ============ HEALTH CHECK ============
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// ============ FARMER DASHBOARD ============
// Get all facilities with risk forecast (FarmerDashboard)
app.get('/api/farmer/my-facilities', async (req, res) => {
  try {
    const { assessAllRisks } = require('./utils/risk')
    const { forecast7Day, shouldSendAlert } = require('./utils/forecast')
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
    
    // Enrich with forecast data
    const facilitiesWithForecast = risks.risky.map(f => {
      const forecast = forecast7Day(f, [])
      return {
        ...f,
        forecast: forecast,
        shouldAlert: shouldSendAlert(f),
        riskCategory: f.ownRisk >= 85 ? 'CRITICAL' : f.ownRisk >= 75 ? 'HIGH' : 'MEDIUM'
      }
    })
    
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

// ============ VESSEL DASHBOARD ============
// Get all vessels (VesselDashboard)
app.get('/api/mvp/vessel/:vesselId?', async (req, res) => {
  try {
    const { vesselId } = req.params
    
    if (!MVP || !MVP.vessels) {
      return res.status(500).json({ error: 'MVP data not initialized' })
    }
    
    if (vesselId) {
      const vessel = MVP.vessels.find(v => v.id === vesselId)
      if (!vessel) return res.status(404).json({ error: 'Vessel not found' })
      res.json({ vessel, tasks: [], taskCount: 0 })
    } else {
      res.json({ vessels: MVP.vessels, stats: { total: MVP.vessels.length }, taskCount: 0 })
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

// ============ ADMIN RISK ASSESSMENT ============
// Admin: Risk Assessment Dashboard (AdminMVP uses this)
// Return MVP mock data for simplicity
app.get('/api/admin/risks', (req, res) => {
  try {
    // Get risky facilities from MVP data
    const risky = MVP.farmers.filter(f => f.riskScore > 60)
    const safe = MVP.farmers.filter(f => f.riskScore <= 60)
    const critical = risky.filter(f => f.riskScore > 80).length
    const high = risky.filter(f => f.riskScore > 60 && f.riskScore <= 80).length
    
    res.json({
      risky: risky,
      safe: safe,
      summary: {
        total: MVP.farmers.length,
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
