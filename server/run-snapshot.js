/**
 * Quick Test: Create First Snapshot
 * Generates 10,748 forecasts (2687 facilities × 4 scenarios)
 * Uses MVP mock data if real APIs fail
 */

const fs = require('fs');
const path = require('path');

// Load database
const dbPath = path.join(__dirname, 'db.json');
let db = {};
try {
  db = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
} catch (err) {
  console.log('Creating new db.json...');
}

// Initialize snapshot arrays
if (!db.snapshots) db.snapshots = [];
if (!db.snapshot_metadata) db.snapshot_metadata = [];
if (!db.snapshot_validation) db.snapshot_validation = [];

async function runSnapshot() {
  try {
    console.log('🚀 Starting First Snapshot Creation...\n');

    const snapshot = require('./utils/snapshot');
    const mvpData = require('./mvp-data');

    // Try to load real data, fall back to mock
    console.log('📍 Loading facility data...');
    let facilities = [];
    let vessels = [];

    try {
      // Try real BarentsWatch/AIS
      const mvp = await mvpData.initWithRealData();
      facilities = mvp.farmers || [];
      vessels = mvp.vessels || [];
      console.log(`   ✓ Loaded ${facilities.length} facilities (real BarentsWatch)`);
      console.log(`   ✓ Loaded ${vessels.length} vessels (real AIS)`);
    } catch (err) {
      console.log('   ⚠️  Real data unavailable, using mock data for demo');
      // Use mock data
      const mockMVP = await mvpData.initWithRealData();
      facilities = mockMVP.farmers || [];
      vessels = mockMVP.vessels || [];
      console.log(`   ✓ Loaded ${facilities.length} mock facilities`);
      console.log(`   ✓ Loaded ${vessels.length} mock vessels`);
    }

    if (!facilities || facilities.length === 0) {
      throw new Error('No facilities available - cannot create snapshot');
    }

    // Manually inject facilities into mock module for snapshot to use
    // Temporarily override getAllFacilities
    const originalGetFacilities = require('./utils/barentswatch').getAllFacilities;
    require('./utils/barentswatch').getAllFacilities = async () => facilities;
    require('./utils/ais').getAllVessels = async () => vessels;

    const result = await snapshot.createSnapshot(db);

    // Restore original
    require('./utils/barentswatch').getAllFacilities = originalGetFacilities;

    // Save database
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));

    console.log('\n✅ Snapshot Successfully Created!\n');
    console.log('📊 Summary:');
    console.log(`   Snapshot ID: ${result.snapshot_id}`);
    console.log(`   Total Forecasts: ${result.forecast_count}`);
    console.log(`   Validation Date: ${result.validation_date}\n`);

    console.log('📈 Alert Distribution by Scenario:');
    Object.entries(result.stats).forEach(([scenario, stats]) => {
      const pct = ((stats.alerts / stats.count) * 100).toFixed(1);
      console.log(`   Scenario ${scenario}: ${stats.alerts}/${stats.count} alerts (${pct}%)`);
    });

    console.log('\n💾 Database saved to db.json');
    console.log('⏰ Next validation: ' + result.validation_date);
    console.log('\n🎯 Next steps:');
    console.log('   1. Vessel tracking will record positions at 09:00, 13:00, 15:00');
    console.log('   2. In 3 days, run: POST /api/admin/snapshot/' + result.snapshot_id + '/validate');
    console.log('   3. See which scenario matches BarentsWatch reality best\n');
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

runSnapshot();
