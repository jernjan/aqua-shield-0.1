const express = require('express');
const { authMiddleware } = require('./auth.js');
const { getAlerts, saveAlert, updateAlert } = require('../db.js');

const router = express.Router();

// Get alerts for user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const alerts = await getAlerts(req.userId);
    // Sort by newest first
    alerts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(alerts);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get alerts' });
  }
});

// Mark alert as read
router.post('/:alertId/read', authMiddleware, async (req, res) => {
  try {
    await updateAlert(req.params.alertId, { isRead: true, readAt: new Date().toISOString() });
    res.json({ message: 'Alert marked as read' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update alert' });
  }
});

// Test alert (logs to console, shows in toast, doesn't send real SMS/email yet)
router.post('/test', authMiddleware, async (req, res) => {
  try {
    const { facilityName, type } = req.body;
    
    const testAlert = {
      id: 'test_' + Date.now(),
      userId: req.userId,
      type: type || 'facility',
      title: `🧪 TEST: Høy smitterisiko på ${facilityName}`,
      message: `Test varsel for ${facilityName}. I normalt tilfelle ville SMS/email blitt sendt.`,
      riskScore: 75,
      isRead: false,
      createdAt: new Date().toISOString()
    };
    
    console.log('📨 TEST ALERT:', testAlert);
    
    res.json({ 
      message: 'Test alert created (check console and dashboard)',
      alert: testAlert
    });
  } catch (err) {
    res.status(500).json({ error: 'Test alert failed' });
  }
});

module.exports = router;
