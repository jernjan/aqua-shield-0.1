require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { readDB, writeDB } = require('../db.js');
const { getAllFacilities } = require('../utils/barentswatch.js');
const { getAllVessels } = require('../utils/ais.js');

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
    const allFacilities = await getAllFacilities();
    
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
