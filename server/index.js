const express = require('express')
const bodyParser = require('body-parser')
const { getAlerts, addAlert, clearAlerts } = require('./storage')
const { runNightlyAnalysis } = require('./cron/nightly')

const app = express()
app.use(bodyParser.json())

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
    res.status(500).json({ ok: false, error: err.message })
  }
})

const port = process.env.PORT || 4000
app.listen(port, () => console.log(`Server listening on ${port}`))
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const authRoutes = require('./routes/auth.js');
const userRoutes = require('./routes/user.js');
const alertRoutes = require('./routes/alerts.js');
const { scheduleCronJob } = require('./cron/nightly.js');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/alerts', alertRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`🐟 AquaShield API running on port ${PORT}`);
});

// Schedule nightly cron job (03:00 UTC+1)
scheduleCronJob();
