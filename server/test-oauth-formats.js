#!/usr/bin/env node

/**
 * Test different OAuth2 credential formats
 * Usage: node test-oauth-formats.js
 */

require('dotenv').config();
const axios = require('axios');

async function testOAuthFormat(clientId, clientSecret, description) {
  try {
    console.log(`\n🧪 Testing: ${description}`);
    console.log(`   Client ID: ${clientId}`);

    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
    params.append('scope', 'api');

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

    console.log(`   ✅ SUCCESS!`);
    console.log(`   Token: ${response.data.access_token.substring(0, 30)}...`);
    return true;
  } catch (err) {
    const errorMsg = err.response?.data?.error || err.message;
    console.log(`   ❌ Failed: ${errorMsg}`);
    return false;
  }
}

async function main() {
  const secret = process.env.BARENTSWATCH_CLIENT_SECRET;
  const email = 'janinge88@hotmail.com';
  
  console.log('🔍 Testing multiple OAuth2 credential formats...');
  console.log(`   Using secret: ${secret?.substring(0, 10)}...`);
  
  // Try different formats
  await testOAuthFormat(
    'janinge88@hotmail.com:janinge88@hotmail.com',
    secret,
    'Email:Email format'
  );
  
  await testOAuthFormat(
    'janinge88@hotmail.com',
    secret,
    'Just email format'
  );
  
  await testOAuthFormat(
    'janinge88',
    secret,
    'Just username format'
  );
}

main();
