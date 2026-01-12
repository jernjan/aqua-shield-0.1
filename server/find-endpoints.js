#!/usr/bin/env node

/**
 * Test different BarentsWatch endpoints to find the correct ones
 */

require('dotenv').config();
const axios = require('axios');
const { getBarentsWatchToken } = require('./utils/auth');

async function testEndpoint(endpoint) {
  try {
    const token = await getBarentsWatchToken();
    
    console.log(`\n🧪 Testing: ${endpoint}`);
    
    const response = await axios.get(endpoint, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      },
      timeout: 10000
    });
    
    console.log(`   ✅ Status: ${response.status}`);
    
    const data = Array.isArray(response.data) ? response.data : (response.data?.features || response.data?.items || []);
    console.log(`   📊 Data type: ${typeof response.data}`);
    console.log(`   📝 Count: ${Array.isArray(data) ? data.length : 'N/A'}`);
    console.log(`   🔍 Sample: ${JSON.stringify(data[0]).substring(0, 100)}...`);
    
    return true;
  } catch (err) {
    console.log(`   ❌ Status: ${err.response?.status || err.code}`);
    console.log(`   📝 Message: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log('🔍 Searching for correct BarentsWatch endpoints...\n');
  
  const endpoints = [
    // Fish Health / Lice endpoints
    'https://www.barentswatch.no/bwapi/v1/fishhealth/lice',
    'https://www.barentswatch.no/bwapi/v1/fishhealth/site',
    'https://www.barentswatch.no/bwapi/v1/geodata/fishhealth/locality',
    'https://www.barentswatch.no/api/v1/sites',
    'https://www.barentswatch.no/api/v1/fishhealth/sites',
    
    // Facilities / Aquaculture endpoints
    'https://www.barentswatch.no/bwapi/v1/aquaculture/sites',
    'https://www.barentswatch.no/bwapi/v1/aquaculture/facilities',
    'https://www.barentswatch.no/bwapi/v1/geodata/aquaculture',
    
    // AIS / Vessel endpoints
    'https://www.barentswatch.no/bwapi/v1/ais',
    'https://www.barentswatch.no/bwapi/v1/ais/vessels',
    'https://www.barentswatch.no/bwapi/v1/latest/ais',
  ];
  
  for (const endpoint of endpoints) {
    await testEndpoint(endpoint);
  }
}

main();
