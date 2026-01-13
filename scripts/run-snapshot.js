/**
 * Test script to create first snapshot
 * Run: node scripts/run-snapshot.js
 */

const { readDB, writeDB } = require('../server/db');
const snapshot = require('../server/utils/snapshot');

async function runSnapshot() {
  console.log('\n🎬 Starting snapshot creation...\n');
  
  try {
    const db = await readDB();
    console.log(`📦 DB loaded. Current snapshots: ${(db.snapshots || []).length}`);
    
    const result = await snapshot.createSnapshot(db);
    
    console.log('\n✅ Snapshot created successfully!\n');
    console.log(`📊 Results:`);
    console.log(`   Snapshot ID: ${result.snapshot_id}`);
    console.log(`   Validation Date: ${result.validation_date}`);
    console.log(`   Total Forecasts: ${result.forecast_count}`);
    console.log(`\n📈 Alerts by Scenario:`);
    console.log(`   Scenario 1 (Baseline 25%): ${result.stats[1].alerts}/${result.stats[1].count} alerts`);
    console.log(`   Scenario 2 (Standard 30%): ${result.stats[2].alerts}/${result.stats[2].count} alerts`);
    console.log(`   Scenario 3 (Vessel 35%): ${result.stats[3].alerts}/${result.stats[3].count} alerts`);
    console.log(`   Scenario 4 (Full 40%): ${result.stats[4].alerts}/${result.stats[4].count} alerts`);
    
    // Save to DB
    await writeDB(db);
    console.log(`\n💾 Snapshot saved to database`);
    console.log(`\n⏳ Next step: Wait until ${result.validation_date}, then run validation`);
    console.log(`   Command: curl https://aquashield.render.com/api/admin/snapshot/${result.snapshot_id}/validate\n`);
    
  } catch (err) {
    console.error('❌ Error creating snapshot:', err.message);
    process.exit(1);
  }
}

runSnapshot();
