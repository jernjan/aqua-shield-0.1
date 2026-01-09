require('dotenv').config()
const express = require('express')
const cors = require('cors')
const { getAlerts, addAlert } = require('./storage')
const { runNightlyAnalysis } = require('./cron/nightly')
const mvpData = require('./mvp-data')

// Initialize MVP data on startup
const MVP = mvpData.init()

const app = express()
const PORT = process.env.PORT || 3001
const RENDER_HEALTH_PORT = process.env.RENDER_HEALTH_PORT || 10000

app.use(cors())
app.use(express.json())

// Simple alerts endpoints
app.get('/api/alerts', async (req, res) => {
  try {
    const alerts = await getAlerts()
    res.json(alerts)
  } catch (err) {
    console.error('GET /api/alerts error', err)
    res.status(500).json({ ok: false, error: err.message })
  }
})

app.post('/api/alerts/test', async (req, res) => {
  try {
    const { facilityName } = req.body || {}
    const a = await addAlert({
      title: `Test-varsel: ${facilityName || 'Demo Anlegg'}`,
      message: 'Dette er et test-varsel generert av serveren',
      riskLevel: 'varsel'
    })
    res.json({ ok: true, alert: a })
  } catch (err) {
    console.error('POST /api/alerts/test error', err)
    res.status(500).json({ ok: false, error: err.message })
  }
})

app.post('/api/admin/run-cron', async (req, res) => {
  try {
    const result = await runNightlyAnalysis()
    res.json({ ok: true, result })
  } catch (err) {
    console.error(err)
    res.status(500).json({ ok: false, error: err.message })
  }
})

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// ============ MVP ENDPOINTS ============

// Gruppe 1: Farmers (Anlegg)
app.get('/api/mvp/farmer/:farmId?', (req, res) => {
  const { farmId } = req.params
  if (farmId) {
    const farm = MVP.farmers.find(f => f.id === farmId)
    if (!farm) return res.status(404).json({ error: 'Farm not found' })
    const alerts = MVP.alerts.filter(a => a.farmId === farmId)
    res.json({ farm, alerts })
  } else {
    // List all farms (paginated if needed)
    res.json({ farms: MVP.farmers, alertCount: MVP.alerts.length })
  }
})

// Gruppe 2: Vessels (Brønnbåter)
app.get('/api/mvp/vessel/:vesselId?', (req, res) => {
  const { vesselId } = req.params
  if (vesselId) {
    const vessel = MVP.vessels.find(v => v.id === vesselId)
    if (!vessel) return res.status(404).json({ error: 'Vessel not found' })
    res.json({ vessel })
  } else {
    res.json({ vessels: MVP.vessels })
  }
})

// Gruppe 3: Admin/Regulators (Statistikk og oversight)
app.get('/api/mvp/admin/stats', (req, res) => {
  res.json(MVP.adminStats)
})

app.get('/api/mvp/admin/alerts', (req, res) => {
  res.json({ alerts: MVP.alerts })
})

// Gruppe 4: Public (Anonymous regional data)
app.get('/api/mvp/public', (req, res) => {
  res.json(MVP.publicData)
})

// ============ END MVP ENDPOINTS ============

// Start server and provide graceful shutdown handlers so nodemon restarts don't
// leave ports bound (prevents EADDRINUSE loops when files change rapidly).
const server = app.listen(PORT, () => {
  console.log(`🐟 AquaShield API running on port ${PORT}`)
})

// If Render (or other host) expects the internal health check on port 10000,
// also bind the same app to that port so health checks succeed. This keeps
// local development behaviour unchanged while preventing health-check timeouts
// on Render where the platform probes :10000 by default.
let healthServer
if (Number(RENDER_HEALTH_PORT) !== Number(PORT)) {
  try {
    healthServer = app.listen(RENDER_HEALTH_PORT, () => {
      console.log(`🔎 Health endpoint also listening on port ${RENDER_HEALTH_PORT}`)
    })
  } catch (err) {
    console.warn('Could not bind health port', RENDER_HEALTH_PORT, err && err.message)
  }
}

function shutdown(signal) {
  console.log(`Received ${signal} — shutting down server...`)
  server.close(err => {
    if (err) {
      console.error('Error during server close', err)
      process.exit(1)
    }
    if (healthServer) {
      healthServer.close(() => {
        // Allow nodemon to restart with SIGUSR2
        if (signal === 'SIGUSR2') {
          process.kill(process.pid, 'SIGUSR2')
        } else {
          process.exit(0)
        }
      })
    } else {
      if (signal === 'SIGUSR2') {
        process.kill(process.pid, 'SIGUSR2')
      } else {
        process.exit(0)
      }
    }
  })
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.once('SIGUSR2', () => shutdown('SIGUSR2'))
