#!/usr/bin/env node

/**
 * Test OAuth2 authentication with BarentsWatch
 * Usage: node test-oauth.js
 */

require('dotenv').config();

const { getBarentsWatchToken } = require('./utils/auth');

async function testOAuth() {
  console.log('🧪 Testing BarentsWatch OAuth2...\n');
  
  console.log('📋 Configuration:');
  console.log(`   Client ID: ${process.env.BARENTSWATCH_CLIENT_ID ? '✅ Set' : '❌ NOT SET'}`);
  console.log(`   Client Secret: ${process.env.BARENTSWATCH_CLIENT_SECRET ? '✅ Set' : '❌ NOT SET'}`);
  console.log();
  
  if (!process.env.BARENTSWATCH_CLIENT_ID || !process.env.BARENTSWATCH_CLIENT_SECRET) {
    console.error('❌ ERROR: Missing credentials in .env file');
    console.error('   Please ensure .env contains:');
    console.error('   - BARENTSWATCH_CLIENT_ID');
    console.error('   - BARENTSWATCH_CLIENT_SECRET');
    process.exit(1);
  }
  
  try {
    console.log('🔐 Requesting OAuth2 token...');
    const token = await getBarentsWatchToken();
    
    if (token) {
      console.log('✅ Token acquired!');
      console.log(`   Token: ${token.substring(0, 20)}...`);
      console.log(`   Length: ${token.length} characters`);
      console.log('\n✅ OAuth2 configuration is working!');
      process.exit(0);
    } else {
      console.error('❌ Failed to acquire token (returned null)');
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

testOAuth();
