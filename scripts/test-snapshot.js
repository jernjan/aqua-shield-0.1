/**
 * Quick test snapshot - 100 facilities for speed testing
 * Run: node scripts/test-snapshot.js
 */

const { readDB, writeDB } = require('../server/db');
const snapshot = require('../server/utils/snapshot');

async function testSnapshot() {
  console.log('\n🎬 Starting QUICK TEST snapshot (100 facilities)...\n');
  
  try {
    const db = await readDB();
    
    // Temporarily reduce for testing
    const originalCreateSnapshot = snapshot.createSnapshot;
    
    // Create test version with only 100 facilities
    const startTime = Date.now();
    
    const snapshotId = `test_${new Date().toISOString().split('T')[0]}_${Date.now()}`;
    const now = new Date();
    const validationDate = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    
    const { generateMockFacilities, generateMockVessels } = require('../server/utils/mock-data');
    const facilities = generateMockFacilities(100); // Only 100 for testing
    const vessels = generateMockVessels(4066);
    
    if (!db.snapshots) db.snapshots = [];
    if (!db.snapshot_metadata) db.snapshot_metadata = [];
    
    const SCENARIOS = snapshot.SCENARIOS;
    
    console.log(`📊 Generating 100 × 4 = 400 forecasts...`);
    
    let forecastCount = 0;
    const scenarioStats = { 1: { count: 0, alerts: 0 }, 2: { count: 0, alerts: 0 }, 3: { count: 0, alerts: 0 }, 4: { count: 0, alerts: 0 } };
    
    for (const facility of facilities) {
      for (let scenarioId = 1; scenarioId <= 4; scenarioId++) {
        const scenario = SCENARIOS[scenarioId];
        let riskScore = 0;
        
        const liceCount = facility.liceCount || 0;
        if (liceCount > 20) riskScore = 100;
        else if (liceCount > 10) riskScore = 60;
        else if (liceCount > 5) riskScore = 30;
        else if (liceCount > 0) riskScore = 10;
        
        if (facility.diseaseStatus === 'infected') riskScore = Math.min(100, riskScore + 50);
        else if (facility.diseaseStatus === 'suspect') riskScore = Math.min(100, riskScore + 25);
        
        if (scenario.useVessels && scenarioId >= 3) {
          riskScore = Math.min(100, riskScore + 3);
        }
        
        const shouldAlert = riskScore >= scenario.threshold * 100;
        
        const forecast = {
          snapshot_id: snapshotId,
          scenario: scenarioId,
          scenario_name: scenario.name,
          facility_id: facility.id,
          facility_name: facility.name,
          lat: facility.lat,
          lng: facility.lng,
          risk_score: Math.round(riskScore),
          threshold: Math.round(scenario.threshold * 100),
          alert: shouldAlert,
          created_at: now.toISOString(),
          validation_date: validationDate.toISOString(),
          validated: false,
          result: null
        };
        
        db.snapshots.push(forecast);
        forecastCount++;
        scenarioStats[scenarioId].count++;
        if (shouldAlert) scenarioStats[scenarioId].alerts++;
      }
    }
    
    const elapsed = Date.now() - startTime;
    
    db.snapshot_metadata.push({
      snapshot_id: snapshotId,
      created_at: now.toISOString(),
      validation_date: validationDate.toISOString(),
      facility_count: 100,
      vessel_count: vessels.length,
      total_forecasts: forecastCount,
      status: 'pending_validation',
      test_mode: true
    });
    
    await writeDB(db);
    
    console.log('\n✅ TEST SNAPSHOT created successfully!\n');
    console.log(`⏱️  Time elapsed: ${elapsed}ms (${(elapsed/1000).toFixed(2)}s)`);
    console.log(`📊 Results:`);
    console.log(`   Snapshot ID: ${snapshotId}`);
    console.log(`   Facilities: 100 (test size)`);
    console.log(`   Total Forecasts: ${forecastCount}`);
    console.log(`\n📈 Alerts by Scenario:`);
    console.log(`   Scenario 1 (Baseline 25%): ${scenarioStats[1].alerts}/${scenarioStats[1].count} alerts`);
    console.log(`   Scenario 2 (Standard 30%): ${scenarioStats[2].alerts}/${scenarioStats[2].count} alerts`);
    console.log(`   Scenario 3 (Vessel 35%): ${scenarioStats[3].alerts}/${scenarioStats[3].count} alerts`);
    console.log(`   Scenario 4 (Full 40%): ${scenarioStats[4].alerts}/${scenarioStats[4].count} alerts`);
    console.log(`\n⏳ To scale to 2687 facilities (~27x), estimated time: ${(elapsed * 27 / 1000).toFixed(1)}s`);
    console.log(`\n💡 Next: If this is fast enough, run: node scripts/run-snapshot.js\n`);
    
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

testSnapshot();
