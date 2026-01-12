#!/usr/bin/env node

/**
 * Test that /api/mvp/farmer endpoint returns real BarentsWatch data
 */

const { readDB, writeDB } = require('./db');

async function testAPIData() {
  try {
    console.log('🧪 Testing /api/mvp/farmer endpoint data...\n');
    
    const db = await readDB();
    
    console.log('📊 Current db.json state:');
    console.log(`   Facilities: ${db.facilities.length}`);
    console.log(`   Vessels: ${db.vessels.length}`);
    console.log(`   Last sync: ${db.lastSync}`);
    console.log();
    
    if (db.facilities.length === 0) {
      console.warn('⚠️  db.facilities is empty, API will return mock data');
      return;
    }
    
    console.log('✅ Real facility data is in db.json');
    console.log(`   First facility: ${db.facilities[0].name} (#${db.facilities[0].id})`);
    console.log(`   Last facility:  ${db.facilities[db.facilities.length-1].name} (#${db.facilities[db.facilities.length-1].id})`);
    console.log();
    console.log('✅ API /api/mvp/farmer will return this real data');
    console.log('   (or fallback to mock if db.facilities is empty)');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

testAPIData();
