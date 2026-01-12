require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { readDB, writeDB } = require('../db.js');
const { getAllFacilities } = require('../utils/barentswatch.js');
const { getAllVessels } = require('../utils/ais.js');

/**
 * Add test data to some facilities for risk assessment demo
 * Simulates actual risk scenarios
 */
function addTestRiskData(facilities) {
  if (!facilities || facilities.length < 10) return facilities;

  // Get 5 random facilities to be "at risk"
  const indices = [0, 1, 2, 3, 4].map(i => Math.floor(Math.random() * facilities.length));
  
  // Facility 0: HIGH lice load (near 70°N, Nordland region)
  if (facilities[indices[0]]) {
    facilities[indices[0]].liceCount = 15;
    facilities[indices[0]].diseaseStatus = 'infected';
  }
  
  // Facility 1: MEDIUM risk
  if (facilities[indices[1]]) {
    facilities[indices[1]].liceCount = 8;
    facilities[indices[1]].diseaseStatus = 'suspect';
  }
  
  // Facility 2: CRITICAL (highest lice + disease)
  if (facilities[indices[2]]) {
    facilities[indices[2]].liceCount = 25;
    facilities[indices[2]].diseaseStatus = 'infected';
  }
  
  // Facility 3: MEDIUM lice
  if (facilities[indices[3]]) {
    facilities[indices[3]].liceCount = 12;
  }
  
  // Facility 4: Low but still at risk
  if (facilities[indices[4]]) {
    facilities[indices[4]].liceCount = 6;
    facilities[indices[4]].diseaseStatus = 'suspect';
  }
  
  console.log('ℹ️  Added test risk data to 5 facilities for demo');
  return facilities;
}

/**
 * Sync all real data from BarentsWatch API and store in db.json
 * Run manually or weekly via scheduled job
 */
async function syncFromBarentsWatch() {
  try {
    console.log('🔄 Starting BarentsWatch data sync...');
    const db = await readDB();
    
    // Fetch all real facilities from BarentsWatch
    console.log('📡 Fetching facilities from BarentsWatch...');
    let allFacilities = await getAllFacilities();
    
    // ADD TEST DATA FOR DEMO (remove in production)
    allFacilities = addTestRiskData(allFacilities);
    
    // Fetch all vessel positions
    console.log('📡 Fetching vessels from BarentsWatch...');
    const allVessels = await getAllVessels();
    
    // Store in db
    db.facilities = allFacilities;
    db.vessels = allVessels;
    db.lastSync = new Date().toISOString();
    
    await writeDB(db);
    
    console.log(`✅ Sync complete!`);
    console.log(`   - ${allFacilities.length} facilities stored`);
    console.log(`   - ${allVessels.length} vessels stored`);
    console.log(`   - Last sync: ${db.lastSync}`);
    
    return { success: true, facilities: allFacilities.length, vessels: allVessels.length };
  } catch (err) {
    console.error('❌ Sync failed:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = { syncFromBarentsWatch };
