require('dotenv').config()
const express = require('express')
const cors = require('cors')
const { getAlerts, addAlert } = require('./storage')
const { runNightlyAnalysis } = require('./cron/nightly')
const mvpData = require('./mvp-data')
const logger = require('./datalogger')
const { startAISPolling } = require('./ais-poller')
const barentswatch = require('./utils/barentswatch')

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
  const { userId } = req.query
  if (farmId) {
    const farm = MVP.farmers.find(f => f.id === farmId)
    if (!farm) return res.status(404).json({ error: 'Farm not found' })
    const alerts = MVP.alerts.filter(a => a.farmId === farmId)
    res.json({ farm, alerts, totalAlerts: alerts.length })
  } else {
    // Optional auth-based filtering by userId
    const farms = userId ? MVP.farmers.filter(f => f.userId === userId) : MVP.farmers
    const alerts = userId ? MVP.alerts.filter(a => a.userId === userId) : MVP.alerts
    const stats = {
      total: farms.length,
      risikofylt: farms.filter(f => f.riskScore > 60).length,
      hoyOppmerksomhet: farms.filter(f => f.riskScore > 40 && f.riskScore <= 60).length,
      unreadAlerts: alerts.filter(a => !a.isRead).length,
    }
    res.json({ farms, stats, alertCount: alerts.length })
  }
})

// Gruppe 2: Vessels (Brønnbåter)
app.get('/api/mvp/vessel/:vesselId?', (req, res) => {
  const { vesselId } = req.params
  const { userId } = req.query
  if (vesselId) {
    const vessel = MVP.vessels.find(v => v.id === vesselId)
    if (!vessel) return res.status(404).json({ error: 'Vessel not found' })
    const tasks = MVP.tasks.filter(t => t.vesselId === vesselId)
    res.json({ vessel, tasks, taskCount: tasks.length })
  } else {
    const vessels = userId ? MVP.vessels.filter(v => v.userId === userId) : MVP.vessels
    const stats = {
      total: vessels.length,
      withExpiredCerts: vessels.filter(v => 
        v.certificates.some(c => new Date(c.expires) < new Date())
      ).length,
    }
    res.json({ vessels, stats })
  }
})

// Vessel tasks APIs
app.get('/api/mvp/vessel/:vesselId/tasks', (req, res) => {
  const { vesselId } = req.params
  const vessel = MVP.vessels.find(v => v.id === vesselId)
  if (!vessel) return res.status(404).json({ error: 'Vessel not found' })
  const tasks = MVP.tasks.filter(t => t.vesselId === vesselId)
  res.json({ vesselId, tasks })
})

app.post('/api/mvp/vessel/:vesselId/task', (req, res) => {
  const { vesselId } = req.params
  const vessel = MVP.vessels.find(v => v.id === vesselId)
  if (!vessel) return res.status(404).json({ error: 'Vessel not found' })
  const { type, name, dueDate, duration, chemicals, notes } = req.body || {}
  const id = `task_${Date.now()}`
  const task = {
    id,
    vesselId,
    userId: vessel.userId,
    type: type || 'vedlikehold',
    name: name || 'Planlagt vedlikehold',
    status: 'planned',
    dueDate: dueDate || new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
    daysUntil: Math.floor((new Date(dueDate || Date.now() + 7 * 24 * 3600 * 1000) - new Date()) / (24 * 3600 * 1000)),
    duration: duration || 2,
    chemicals: chemicals || [],
    notes: notes || `Opprettet for ${vessel.name}`,
    createdDate: new Date().toISOString(),
    completedDate: null,
  }
  MVP.tasks.push(task)
  res.json({ ok: true, task })
})

// Update a vessel task (status, dates, notes)
app.patch('/api/mvp/vessel/:vesselId/task/:taskId', (req, res) => {
  const { vesselId, taskId } = req.params
  const vessel = MVP.vessels.find(v => v.id === vesselId)
  if (!vessel) return res.status(404).json({ error: 'Vessel not found' })
  const task = MVP.tasks.find(t => t.id === taskId && t.vesselId === vesselId)
  if (!task) return res.status(404).json({ error: 'Task not found' })
  const { status, dueDate, duration, chemicals, notes } = req.body || {}
  if (status) {
    task.status = status
    if (status === 'fullført') {
      task.completedDate = new Date().toISOString()
    } else {
      task.completedDate = null
    }
  }
  if (dueDate) task.dueDate = dueDate
  if (typeof duration === 'number') task.duration = duration
  if (Array.isArray(chemicals)) task.chemicals = chemicals
  if (typeof notes === 'string') task.notes = notes
  res.json({ ok: true, task })
})

// Disinfection APIs
app.get('/api/mvp/vessel/:vesselId/disinfections', (req, res) => {
  const { vesselId } = req.params
  const vessel = MVP.vessels.find(v => v.id === vesselId)
  if (!vessel) return res.status(404).json({ error: 'Vessel not found' })
  const disinfections = MVP.disinfections.filter(d => d.vesselId === vesselId)
  res.json({ vesselId, disinfections })
})

app.post('/api/mvp/vessel/:vesselId/disinfection', (req, res) => {
  const { vesselId } = req.params
  const vessel = MVP.vessels.find(v => v.id === vesselId)
  if (!vessel) return res.status(404).json({ error: 'Vessel not found' })
  const { date, chemical, operator, comment, reportedBy } = req.body || {}
  if (!date || !chemical || !operator) {
    return res.status(400).json({ error: 'Missing required fields: date, chemical, operator' })
  }
  const id = `disinfect_${Date.now()}`
  const disinfection = {
    id,
    vesselId,
    userId: vessel.userId,
    date,
    chemical,
    operator,
    comment: comment || '',
    reportedBy: reportedBy || 'unknown',
    reportedAt: new Date().toISOString(),
  }
  MVP.disinfections.push(disinfection)
  res.json({ ok: true, disinfection })
})

// Gruppe 3: Admin/Regulators (Statistikk og oversight)
app.get('/api/mvp/admin/stats', (req, res) => {
  res.json(MVP.adminStats)
})

app.get('/api/mvp/admin/alerts', (req, res) => {
  res.json({ alerts: MVP.adminStats.topAlerts })
})

// Admin: vessels overview and per-vessel tasks
app.get('/api/mvp/admin/vessels', (req, res) => {
  const vessels = MVP.vessels
  const metrics = {
    total: vessels.length,
    expiredCerts: vessels.filter(v => v.certificates.some(c => new Date(c.expires) < new Date())).length,
    recentPositions24h: vessels.filter(v => (Date.now() - new Date(v.lastPosition.timestamp)) / (3600*1000) <= 24).length,
    riskZones: {
      high: vessels.reduce((sum, v) => sum + v.riskZonesEntered.filter(z => z.riskLevel === 'høy oppmerksomhet').length, 0),
      moderate: vessels.reduce((sum, v) => sum + v.riskZonesEntered.filter(z => z.riskLevel === 'moderat').length, 0),
      low: vessels.reduce((sum, v) => sum + v.riskZonesEntered.filter(z => z.riskLevel === 'lav').length, 0),
    },
  }
  res.json({ vessels, metrics })
})

app.get('/api/mvp/admin/vessel/:vesselId', (req, res) => {
  const { vesselId } = req.params
  const vessel = MVP.vessels.find(v => v.id === vesselId)
  if (!vessel) return res.status(404).json({ error: 'Vessel not found' })
  const tasks = MVP.tasks.filter(t => t.vesselId === vesselId)
  res.json({ vessel, tasks, taskCount: tasks.length })
})

// Gruppe 4: Public (Anonymous regional data)
app.get('/api/mvp/public', (req, res) => {
  res.json(MVP.publicData)
})

// Public: aggregated vessel metrics (anonymous)
app.get('/api/mvp/public/vessels', (req, res) => {
  const vessels = MVP.vessels
  const metrics = {
    total: vessels.length,
    expiredCerts: vessels.filter(v => v.certificates.some(c => new Date(c.expires) < new Date())).length,
    recentPositions24h: vessels.filter(v => (Date.now() - new Date(v.lastPosition.timestamp)) / (3600*1000) <= 24).length,
    riskZones: {
      high: vessels.reduce((sum, v) => sum + v.riskZonesEntered.filter(z => z.riskLevel === 'høy oppmerksomhet').length, 0),
      moderate: vessels.reduce((sum, v) => sum + v.riskZonesEntered.filter(z => z.riskLevel === 'moderat').length, 0),
      low: vessels.reduce((sum, v) => sum + v.riskZonesEntered.filter(z => z.riskLevel === 'lav').length, 0),
    },
    timestamp: new Date().toISOString(),
  }
  res.json(metrics)
})

// ============ FARM OCEAN CURRENT & ALGAE ENDPOINTS ============

// GET /api/mvp/farm/:farmId/nearby - Nærliggende anlegg sortert etter strøm-smitterisiko
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
      direction: farm.currentDirection, // e.g., 'vestlig' (westerly)
      strength: 'moderat', // placeholder
      lastUpdated: new Date().toISOString(),
    },
  })
})

// GET /api/mvp/farm/:farmId/algae-alerts - Alge-varsler for anlegg
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

// GET /api/mvp/farm/:farmId/current-conditions - Nåværende strøm- og alge-forhold
app.get('/api/mvp/farm/:farmId/current-conditions', (req, res) => {
  const { farmId } = req.params
  const farm = MVP.farmers.find(f => f.id === farmId)
  
  if (!farm) {
    return res.status(404).json({ error: 'Farm not found' })
  }
  
  const nearby = MVP.nearbyFarmsMap[farmId]?.nearby || []
  const algaeAlerts = MVP.algaeAlerts.filter(a => a.farmId === farmId)
  
  // Get active algae alerts (current)
  const activeAlgae = algaeAlerts.filter(a => {
    const start = new Date(a.startDate)
    const end = new Date(a.endDate)
    const now = new Date()
    return start <= now && now <= end
  })
  
  // Count infected downstream neighbors
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

// GET /api/mvp/farm/:farmId/visiting-vessels - Báter som har vært på anlegget
app.get('/api/mvp/farm/:farmId/visiting-vessels', (req, res) => {
  const { farmId } = req.params
  const farm = MVP.farmers.find(f => f.id === farmId)
  if (!farm) return res.status(404).json({ error: 'Farm not found' })
  
  // Find vessels that have been close to this farm (within 5km radius)
  const visitingVessels = MVP.vessels.filter(vessel => {
    const distance = Math.sqrt(
      Math.pow(vessel.lastPosition.lat - farm.coordinates.lat, 2) +
      Math.pow(vessel.lastPosition.lng - farm.coordinates.lng, 2)
    ) * 111; // Rough km conversion
    return distance < 5; // Within 5km
  }).map(vessel => {
    // Get disinfections for this vessel
    const disinfections = MVP.disinfections.filter(d => d.vesselId === vessel.id);
    const lastDisinfection = disinfections.length > 0 ? disinfections[0] : null;
    
    return {
      id: vessel.id,
      name: vessel.name,
      mmsi: vessel.mmsi,
      owner: vessel.owner,
      lastPosition: vessel.lastPosition,
      disinfectionReported: disinfections.length > 0,
      lastDisinfection: lastDisinfection,
      allDisinfections: disinfections,
      verified: false, // Farmer can mark as verified
    };
  });
  
  res.json({ farmId, farm: farm.name, visitingVessels, timestamp: new Date().toISOString() })
})

// GET /api/mvp/admin/quarantine-recommendations - Auto-quarantine triggers
app.get('/api/mvp/admin/quarantine-recommendations', (req, res) => {
  const recommendations = [];
  const DAYS_THRESHOLD = 7; // Quarantine if disinfection older than 7 days
  
  // Check each farm for non-compliant visiting vessels
  MVP.farmers.forEach(farm => {
    const visitingVessels = MVP.vessels.filter(vessel => {
      const distance = Math.sqrt(
        Math.pow(vessel.lastPosition.lat - farm.coordinates.lat, 2) +
        Math.pow(vessel.lastPosition.lng - farm.coordinates.lng, 2)
      ) * 111;
      return distance < 5;
    });
    
    visitingVessels.forEach(vessel => {
      const disinfections = MVP.disinfections.filter(d => d.vesselId === vessel.id);
      const lastDisinfection = disinfections.length > 0 ? disinfections[0] : null;
      
      // Recommendation if no disinfection or older than threshold
      let status = 'compliant';
      let daysAgo = null;
      
      if (!lastDisinfection) {
        status = 'critical';
        daysAgo = null;
      } else {
        daysAgo = Math.floor((Date.now() - new Date(lastDisinfection.date)) / (24 * 3600 * 1000));
        if (daysAgo > DAYS_THRESHOLD) {
          status = 'outdated';
        }
      }
      
      if (status !== 'compliant') {
        // Check if quarantine already exists
        const existingQuarantine = MVP.quarantines.find(q => 
          q.farmId === farm.id && q.vesselId === vessel.id && q.status === 'active'
        );
        
        recommendations.push({
          id: existingQuarantine?.id || `qrec_${farm.id}_${vessel.id}`,
          farmId: farm.id,
          farmName: farm.name,
          vesselId: vessel.id,
          vesselName: vessel.name,
          vesselMmsi: vessel.mmsi,
          status: status, // 'critical', 'outdated', 'compliant'
          daysAgo: daysAgo,
          lastDisinfection: lastDisinfection,
          severity: status === 'critical' ? 'høy' : 'moderat',
          action: status === 'critical' ? 'Bruk karantene' : 'Kjør desinfeksjon',
          isActive: !!existingQuarantine,
          createdAt: existingQuarantine?.createdAt || new Date().toISOString(),
        });
      }
    });
  });
  
  res.json({ 
    recommendations,
    total: recommendations.length,
    critical: recommendations.filter(r => r.status === 'critical').length,
    outdated: recommendations.filter(r => r.status === 'outdated').length,
    timestamp: new Date().toISOString()
  });
})

// POST /api/mvp/admin/quarantine-trigger - Manually trigger quarantine for a farm/vessel
app.post('/api/mvp/admin/quarantine-trigger', (req, res) => {
  const { farmId, vesselId, reason, durationDays } = req.body;
  
  const farm = MVP.farmers.find(f => f.id === farmId);
  const vessel = MVP.vessels.find(v => v.id === vesselId);
  
  if (!farm || !vessel) {
    return res.status(404).json({ error: 'Farm or vessel not found' });
  }
  
  const quarantine = {
    id: `quarantine_${Date.now()}`,
    farmId,
    farmName: farm.name,
    vesselId,
    vesselName: vessel.name,
    vesselMmsi: vessel.mmsi,
    status: 'active',
    reason: reason || 'Automatisk karantene - manglende desinfeksjon',
    startDate: new Date().toISOString(),
    dueDate: new Date(Date.now() + (durationDays || 7) * 24 * 3600 * 1000).toISOString(),
    durationDays: durationDays || 7,
    createdAt: new Date().toISOString(),
    createdBy: 'admin',
  };
  
  MVP.quarantines.push(quarantine);
  res.json({ ok: true, quarantine });
});

// GET /api/mvp/admin/quarantines - Get active quarantines
app.get('/api/mvp/admin/quarantines', (req, res) => {
  const activeQuarantines = MVP.quarantines.filter(q => q.status === 'active');
  
  res.json({ 
    quarantines: activeQuarantines,
    total: activeQuarantines.length,
    timestamp: new Date().toISOString()
  });
});

// GET /api/mvp/farm/:farmId/disease-risks - Disease risk based on boat traffic & currents
app.get('/api/mvp/farm/:farmId/disease-risks', (req, res) => {
  const { farmId } = req.params;
  const farm = MVP.farmers.find(f => f.id === farmId);
  if (!farm) return res.status(404).json({ error: 'Farm not found' });

  const risks = [];

  // Disease database with incubation times and treatments
  const diseaseDb = [
    {
      name: 'Infeksiøs lakseanemi (ILA)',
      incubationDays: [7, 14], // Min/Max days
      treatments: ['Vaksinasjon av smolter', 'Isolering av syke fisk', 'Reduksjon av tetthet', 'Bedre vannkvalitet'],
      fatality: 'høy'
    },
    {
      name: 'Pancreas Disease (PD)',
      incubationDays: [5, 10],
      treatments: ['Antiviral medisin', 'Fôr med immunstimulanter', 'Karantene av nye smolter', 'Observasjon'],
      fatality: 'moderat'
    },
    {
      name: 'Hjerte- og skjelettmuskelinflammasjon (HSMB)',
      incubationDays: [10, 20],
      treatments: ['Probiotikabehandling', 'Optimal vannkvalitet', 'Redusert stressfaktorer', 'Laksekillverkurs-forbud'],
      fatality: 'lav'
    },
    {
      name: 'Gyrodactylus salaris',
      incubationDays: [3, 7],
      treatments: ['Ferskvannsspyling', 'Parasittbekjempelse', 'Mekanisk fjerning', 'Karantene'],
      fatality: 'høy'
    }
  ];

  // Check 1: Boat traffic from potentially infected farms
  const nearbyFarms = MVP.farmers.filter(f => {
    if (f.id === farm.id) return false;
    const distance = Math.sqrt(
      Math.pow(f.coordinates.lat - farm.coordinates.lat, 2) +
      Math.pow(f.coordinates.lng - farm.coordinates.lng, 2)
    ) * 111; // km
    return distance < 20; // Within 20km
  });

  // Check boats from these farms visiting our farm
  nearbyFarms.forEach(upstreamFarm => {
    if (upstreamFarm.riskScore > 50) { // If nearby farm has higher risk
      const boatsFromThatFarm = MVP.vessels.filter(v => {
        // Simulated: assume boats visit farms in their region
        return v.homePort?.includes(upstreamFarm.region) || Math.random() > 0.7;
      });

      boatsFromThatFarm.slice(0, 2).forEach(boat => {
        const disease = diseaseDb[Math.floor(Math.random() * diseaseDb.length)];
        const incubationDays = disease.incubationDays[0] + Math.floor(Math.random() * (disease.incubationDays[1] - disease.incubationDays[0]));

        risks.push({
          id: `risk_boat_${upstreamFarm.id}_${boat.id}`,
          disease: disease.name,
          source: `Båt ${boat.name} fra risikabelt anlegg (${upstreamFarm.name})`,
          sourceType: 'boat_traffic',
          riskScore: 65 + Math.floor(Math.random() * 20), // 65-85
          severity: 'høy',
          manifestationDaysMin: incubationDays - 2,
          manifestationDaysMax: incubationDays + 3,
          manifestationDay: new Date(Date.now() + incubationDays * 24 * 3600 * 1000).toISOString(),
          treatments: disease.treatments,
          fatality: disease.fatality,
          recommendedActions: [
            '⚠️ Øk overvåking av fiskehelse',
            '💉 Forbered vaksinasjon av nye smolter',
            '🧪 Daglig prøvetaking og observasjon',
            '🚢 Fortsett desinfeksjonskontroll av båter',
            ...disease.treatments.map(t => `✓ ${t}`)
          ]
        });
      });
    }
  });

  // Check 2: Havstrøm risk - are we downstream of infected areas?
  if (farm.downstreamRisk === 'nedstrøms') {
    // This farm is downstream - check for infections upstreamfarm
    const upstreamInfections = MVP.farmers.filter(f => {
      if (f.downstreamRisk !== 'oppstrøms') return false;
      const distance = Math.sqrt(
        Math.pow(f.coordinates.lat - farm.coordinates.lat, 2) +
        Math.pow(f.coordinates.lng - farm.coordinates.lng, 2)
      ) * 111;
      return distance < 15 && f.riskScore > 55; // Upstream + high risk
    });

    upstreamInfections.forEach(upFarm => {
      const disease = diseaseDb[Math.floor(Math.random() * diseaseDb.length)];
      risks.push({
        id: `risk_current_${upFarm.id}`,
        disease: disease.name,
        source: `Havstrøm fra ${upFarm.name} (upstream)`,
        sourceType: 'ocean_current',
        riskScore: 40 + Math.floor(Math.random() * 25), // 40-65
        severity: 'moderat',
        manifestationDaysMin: 10,
        manifestationDaysMax: 20,
        manifestationDay: new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString(),
        treatments: disease.treatments,
        fatality: disease.fatality,
        recommendedActions: [
          '🌊 Øk overvåking av vannkvalitet',
          '🧬 Genetisk testing av vill fiskebestand',
          '📊 Regional situasjonsanalyse',
          '🚫 Vurder sesongmessig drift',
          ...disease.treatments.map(t => `✓ ${t}`)
        ]
      });
    });
  }

  // Sort by risk score descending
  risks.sort((a, b) => b.riskScore - a.riskScore);

  res.json({
    farmId,
    farmName: farm.name,
    risks,
    summary: {
      totalRisks: risks.length,
      highRisk: risks.filter(r => r.severity === 'høy').length,
      moderateRisk: risks.filter(r => r.severity === 'moderat').length
    },
    timestamp: new Date().toISOString()
  });
});


// GET /api/mvp/admin/infection-chain - Smitte-kjede visualisering for Admin
app.get('/api/mvp/admin/infection-chain', (req, res) => {
  const chain = MVP.infectionGraph || {}
  
  // Find all farms that are at risk or could spread infection
  const criticalChain = Object.values(chain)
    .filter(farm => farm.riskLevel === 'risikofylt' || farm.downstreamFarms.length > 0)
    .sort((a, b) => {
      // Sort by risk level and downstream exposure
      const riskOrder = { risikofylt: 0, 'høy oppmerksomhet': 1, moderat: 2, lav: 3 }
      return (riskOrder[a.riskLevel] || 99) - (riskOrder[b.riskLevel] || 99)
    })
  
  // Build infection paths
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

// ============ END MVP ENDPOINTS ============

// ============ DATA LOGGING ENDPOINTS ============

// POST /api/datalog/alert - Log an alert with context
app.post('/api/datalog/alert', async (req, res) => {
  try {
    const data = req.body
    const alert = await logger.logAlert({
      facility_id: data.facility_id,
      disease_type: data.disease_type,
      severity: data.severity,
      region: data.region,
      title: data.title,
      risk_score: data.risk_score,
      vessel_traffic_nearby: data.vessel_traffic_nearby,
      environmental_data: data.environmental_data,
      notes: data.notes
    })
    res.json({ ok: true, alert })
  } catch (err) {
    console.error('POST /api/datalog/alert error:', err)
    res.status(500).json({ ok: false, error: err.message })
  }
})

// GET /api/datalog/alerts - Get alert history
app.get('/api/datalog/alerts', async (req, res) => {
  try {
    const { facility_id, disease_type, days } = req.query
    const alerts = await logger.getAlertsHistory({
      facility_id,
      disease_type,
      days: days ? parseInt(days) : null
    })
    res.json({ ok: true, alerts, count: alerts.length })
  } catch (err) {
    console.error('GET /api/datalog/alerts error:', err)
    res.status(500).json({ ok: false, error: err.message })
  }
})

// POST /api/datalog/vessel-position - Log vessel position
app.post('/api/datalog/vessel-position', async (req, res) => {
  try {
    const data = req.body
    const movement = await logger.logVesselPosition({
      mmsi: data.mmsi,
      vessel_name: data.vessel_name,
      lat: data.lat,
      lon: data.lon,
      nearest_facility: data.nearest_facility,
      distance_km: data.distance_km,
      heading: data.heading,
      speed_knots: data.speed_knots
    })
    res.json({ ok: true, movement })
  } catch (err) {
    console.error('POST /api/datalog/vessel-position error:', err)
    res.status(500).json({ ok: false, error: err.message })
  }
})

// GET /api/datalog/vessel-movements - Get vessel movement history
app.get('/api/datalog/vessel-movements', async (req, res) => {
  try {
    const { mmsi, facility_id, days } = req.query
    const movements = await logger.getVesselMovements({
      mmsi,
      facility_id,
      days: days ? parseInt(days) : null
    })
    res.json({ ok: true, movements, count: movements.length })
  } catch (err) {
    console.error('GET /api/datalog/vessel-movements error:', err)
    res.status(500).json({ ok: false, error: err.message })
  }
})

// ============================================================================
// BarentsWatch Fishhealth API Integration - REAL OUTBREAK DATA
// ============================================================================

// GET /api/barentswatch/outbreaks - Get real disease outbreaks from Fishhealth API
app.get('/api/barentswatch/outbreaks', async (req, res) => {
  try {
    const { weeks } = req.query
    console.log('📊 Fetching outbreak data from BarentsWatch Fishhealth API...')
    
    const outbreaks = await barentswatch.getOutbreakHistory(weeks ? parseInt(weeks) : 52)
    
    res.json({
      ok: true,
      outbreaks,
      count: outbreaks.length,
      source: 'BarentsWatch Fishhealth API',
      timestamp: new Date().toISOString()
    })
  } catch (err) {
    console.error('❌ GET /api/barentswatch/outbreaks error:', err.message)
    res.status(500).json({
      ok: false,
      error: err.message,
      message: 'Failed to fetch outbreak data from BarentsWatch API'
    })
  }
})

// GET /api/barentswatch/facility/:facilityNo/lice - Get sea lice data for facility
app.get('/api/barentswatch/facility/:facilityNo/lice', async (req, res) => {
  try {
    const { facilityNo } = req.params
    console.log(`🦐 Fetching lice data for facility ${facilityNo}...`)
    
    const liceData = await barentswatch.getFacilityLiceData(facilityNo)
    
    if (!liceData) {
      return res.status(404).json({
        ok: false,
        error: 'Facility not found or no lice data available'
      })
    }
    
    res.json({
      ok: true,
      liceData,
      source: 'BarentsWatch Fishhealth API',
      timestamp: new Date().toISOString()
    })
  } catch (err) {
    console.error(`❌ GET /api/barentswatch/facility/:facilityNo/lice error:`, err.message)
    res.status(500).json({
      ok: false,
      error: err.message,
      message: 'Failed to fetch lice data from BarentsWatch API'
    })
  }
})

// GET /api/barentswatch/stats - Get statistics about outbreaks
app.get('/api/barentswatch/stats', async (req, res) => {
  try {
    const { weeks } = req.query
    const outbreaks = await barentswatch.getOutbreakHistory(weeks ? parseInt(weeks) : 52)
    
    // Calculate statistics
    const stats = {
      total: outbreaks.length,
      byDisease: {},
      bySeverity: {
        'kritisk': 0,
        'høy': 0,
        'moderat': 0,
        'lav': 0
      },
      activeCount: 0,
      dataCollectionPeriod: `${weeks || 52} weeks`,
      timestamp: new Date().toISOString()
    }
    
    outbreaks.forEach(outbreak => {
      // Count by disease
      const disease = outbreak.diseaseName || outbreak.diseaseCode
      stats.byDisease[disease] = (stats.byDisease[disease] || 0) + 1
      
      // Count by severity
      if (stats.bySeverity[outbreak.severity] !== undefined) {
        stats.bySeverity[outbreak.severity]++
      }
      
      // Count active outbreaks
      if (outbreak.status === 'active') {
        stats.activeCount++
      }
    })
    
    res.json({
      ok: true,
      stats,
      source: 'BarentsWatch Fishhealth API'
    })
  } catch (err) {
    console.error('❌ GET /api/barentswatch/stats error:', err.message)
    res.status(500).json({
      ok: false,
      error: err.message
    })
  }
})


// PATCH /api/datalog/alert/:alertId/outbreak - Mark alert as confirmed/false positive
app.patch('/api/datalog/alert/:alertId/outbreak', async (req, res) => {
  try {
    const { alertId } = req.params
    const { confirmed, notes } = req.body
    const alert = await logger.updateAlertOutbreak(alertId, confirmed, notes)
    if (!alert) {
      return res.status(404).json({ ok: false, error: 'Alert not found' })
    }
    res.json({ ok: true, alert })
  } catch (err) {
    console.error('PATCH /api/datalog/alert/:alertId/outbreak error:', err)
    res.status(500).json({ ok: false, error: err.message })
  }
})

// GET /api/datalog/stats - Get datalogger statistics
app.get('/api/datalog/stats', async (req, res) => {
  try {
    const stats = await logger.getStats()
    res.json({ ok: true, stats })
  } catch (err) {
    console.error('GET /api/datalog/stats error:', err)
    res.status(500).json({ ok: false, error: err.message })
  }
})

// GET /api/datalog/export - Export training data for ML
app.get('/api/datalog/export', async (req, res) => {
  try {
    const { days } = req.query
    const exportData = await logger.exportTrainingData({
      days: days ? parseInt(days) : null
    })
    res.json({ ok: true, data: exportData })
  } catch (err) {
    console.error('GET /api/datalog/export error:', err)
    res.status(500).json({ ok: false, error: err.message })
  }
})

// ============ END DATA LOGGING ENDPOINTS ============
// leave ports bound (prevents EADDRINUSE loops when files change rapidly).
const server = app.listen(PORT, () => {
  console.log(`🐟 AquaShield API running on port ${PORT}`)
  // Start AIS polling for data logging
  // MVP: 1440 minutes (24 hours) = once daily to save CPU/memory
  // Phase 2: Change to 5 minutes for real-time production vessel tracking
  startAISPolling(1440)
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
