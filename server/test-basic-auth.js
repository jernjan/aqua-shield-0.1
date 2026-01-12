#!/usr/bin/env node

/**
 * Test OAuth2 with Basic Auth header
 */

require('dotenv').config();
const axios = require('axios');

async function testBasicAuth() {
  try {
    const clientId = 'janinge88@hotmail.com:janinge88@hotmail.com';
    const clientSecret = 'cXvin3M3#jqf7GA';
    
    // Create Basic Auth header: base64(clientId:clientSecret)
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    
    console.log('🧪 Testing OAuth2 with Basic Auth header...');
    console.log(`   Credentials (Base64): ${credentials.substring(0, 30)}...`);

    const response = await axios.post(
      'https://id.barentswatch.no/connect/token',
      'grant_type=client_credentials&scope=api',
      {
        headers: {
          'Authorization': `Basic ${credentials}`,
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
    return false;
  }
}

testBasicAuth();
