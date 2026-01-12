#!/usr/bin/env node

/**
 * Test AIS Live API with proper scope
 */

require('dotenv').config();
const axios = require('axios');

async function testAIS() {
  try {
    console.log('🧪 Testing AIS Live API...\n');
    
    // Get token with 'ais' scope
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_id', process.env.BARENTSWATCH_CLIENT_ID);
    params.append('client_secret', process.env.BARENTSWATCH_CLIENT_SECRET);
    params.append('scope', 'ais');
    
    console.log('🔐 Requesting OAuth2 token with scope=ais...');
    
    const tokenResponse = await axios.post(
      'https://id.barentswatch.no/connect/token',
      params,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 10000
      }
    );
    
    const token = tokenResponse.data.access_token;
    console.log('✅ Token acquired');
    
    // Test Live AIS endpoint
    console.log('\n📡 Fetching live vessel data...');
    
    const aisResponse = await axios.get(
      'https://live.ais.barentswatch.no/v1/latest/combined',
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        },
        timeout: 10000
      }
    );
    
    const vessels = Array.isArray(aisResponse.data) ? aisResponse.data : [];
    
    console.log(`✅ Got ${vessels.length} vessels`);
    
    if (vessels.length > 0) {
      console.log('\n📊 Sample vessels:');
      vessels.slice(0, 5).forEach(v => {
        console.log(`  - ${v.name || 'Unknown'} (MMSI: ${v.mmsi})`);
        console.log(`    Type: ${v.shipType} | Speed: ${v.speedOverGround} knots | Pos: ${v.latitude}, ${v.longitude}`);
      });
    }
    
  } catch (err) {
    const errorMsg = err.response?.data?.error || err.message;
    const errorDesc = err.response?.data?.error_description || '';
    console.log('❌ Error:', errorMsg);
    if (errorDesc) console.log('Details:', errorDesc);
    if (err.response?.status) console.log('Status:', err.response.status);
  }
}

testAIS();
