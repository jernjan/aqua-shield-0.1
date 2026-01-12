#!/usr/bin/env node

/**
 * Test OAuth2 without scope parameter
 */

require('dotenv').config();
const axios = require('axios');

async function testNoScope() {
  try {
    const clientId = 'janinge88@hotmail.com:janinge88@hotmail.com';
    const clientSecret = 'cXvin3M3#jqf7GA';

    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
    // NO scope parameter

    console.log('🧪 Testing OAuth2 without scope parameter...');

    const response = await axios.post(
      'https://id.barentswatch.no/connect/token',
      params,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 10000
      }
    );

    console.log('✅ SUCCESS!');
    console.log(`   Token: ${response.data.access_token.substring(0, 30)}...`);
    console.log(`   Expires in: ${response.data.expires_in} seconds`);
    return true;
  } catch (err) {
    const errorMsg = err.response?.data?.error || err.message;
    const errorDesc = err.response?.data?.error_description || '';
    console.log(`❌ Failed: ${errorMsg}`);
    if (errorDesc) console.log(`   Details: ${errorDesc}`);
    
    // Try to get full response for debugging
    if (err.response?.data) {
      console.log(`   Full response:`, JSON.stringify(err.response.data, null, 2));
    }
    return false;
  }
}

testNoScope();
