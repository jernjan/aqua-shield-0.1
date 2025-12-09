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
