require('dotenv').config()
const express = require('express')
const cors = require('cors')
const { getAlerts, addAlert } = require('./storage')
const { runNightlyAnalysis } = require('./cron/nightly')

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

// Simple alerts endpoints
app.get('/api/alerts', (req, res) => {
  const alerts = getAlerts()
  res.json(alerts)
})

app.post('/api/alerts/test', (req, res) => {
  const { facilityName } = req.body || {}
  const a = addAlert({
    title: `Test-varsel: ${facilityName || 'Demo Anlegg'}`,
    message: 'Dette er et test-varsel generert av serveren',
    riskLevel: 'varsel'
  })
  res.json({ ok: true, alert: a })
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

app.listen(PORT, () => {
  console.log(`🐟 AquaShield API running on port ${PORT}`)
})
