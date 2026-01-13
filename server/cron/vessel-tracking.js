/**
 * Vessel Tracking Cron Jobs
 * Executes 3x daily: 09:00, 13:00, 15:00 (Europe/Oslo timezone)
 */

const cron = require('node-cron');
const { readDB, writeDB } = require('../db');
const { recordVesselPositions } = require('./vessel-tracking');

// Store cron job references for cleanup
const cronJobs = [];

/**
 * Initialize vessel tracking cron jobs
 */
function initializeVesselTrackingCrons() {
  console.log('🔔 Initializing vessel tracking cron jobs...');

  // 09:00 - Morning snapshot
  const job1 = cron.schedule('0 9 * * *', async () => {
    console.log('📍 [09:00] Recording morning vessel positions...');
    try {
      const db = await readDB();
      const result = await recordVesselPositions(db);
      await writeDB(db);
      console.log(`   ✓ ${result.visits_recorded} visits recorded`);
    } catch (err) {
      console.error('   ❌ Error:', err.message);
    }
  }, { timezone: 'Europe/Oslo' });

  // 13:00 - Afternoon snapshot
  const job2 = cron.schedule('0 13 * * *', async () => {
    console.log('📍 [13:00] Recording afternoon vessel positions...');
    try {
      const db = await readDB();
      const result = await recordVesselPositions(db);
      await writeDB(db);
      console.log(`   ✓ ${result.visits_recorded} visits recorded`);
    } catch (err) {
      console.error('   ❌ Error:', err.message);
    }
  }, { timezone: 'Europe/Oslo' });

  // 15:00 - Late afternoon snapshot
  const job3 = cron.schedule('0 15 * * *', async () => {
    console.log('📍 [15:00] Recording late afternoon vessel positions...');
    try {
      const db = await readDB();
      const result = await recordVesselPositions(db);
      await writeDB(db);
      console.log(`   ✓ ${result.visits_recorded} visits recorded`);
    } catch (err) {
      console.error('   ❌ Error:', err.message);
    }
  }, { timezone: 'Europe/Oslo' });

  cronJobs.push(job1, job2, job3);
  console.log('✓ Vessel tracking cron jobs initialized (09:00, 13:00, 15:00)');
}

/**
 * Stop all cron jobs
 */
function stopVesselTrackingCrons() {
  console.log('⏹️  Stopping vessel tracking cron jobs...');
  cronJobs.forEach(job => job.stop());
  console.log('✓ All cron jobs stopped');
}

module.exports = {
  initializeVesselTrackingCrons,
  stopVesselTrackingCrons
};
