#!/usr/bin/env node

/**
 * Test complete sync of real BarentsWatch data
 * Usage: node test-sync.js
 */

require('dotenv').config();
const { syncFromBarentsWatch } = require('./cron/sync-barentswatch');

async function main() {
  console.log('🧪 Testing complete BarentsWatch sync...\n');
  
  try {
    const result = await syncFromBarentsWatch();
    
    console.log('\n📊 Sync Result:');
    console.log(JSON.stringify(result, null, 2));
    
    if (result.success) {
      console.log('\n✅ Sync completed successfully!');
      process.exit(0);
    } else {
      console.log('\n❌ Sync failed');
      process.exit(1);
    }
  } catch (err) {
    console.error('\n❌ Error:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

main();
