const axios = require('axios');

let cachedToken = null;
let tokenExpireTime = null;

/**
 * Get OAuth2 access token from BarentsWatch
 * Tokens are cached for 50 minutes (expire in 60 min)
 */
async function getBarentsWatchToken() {
  // Return cached token if still valid
  if (cachedToken && tokenExpireTime && Date.now() < tokenExpireTime) {
    return cachedToken;
  }

  try {
    let clientId = process.env.BARENTSWATCH_CLIENT_ID;
    let clientSecret = process.env.BARENTSWATCH_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.warn('⚠️ BarentsWatch credentials not configured in .env');
      return null;
    }

    // Log for debugging (first call only)
    if (!cachedToken) {
      console.log('🔐 Requesting OAuth2 token from BarentsWatch...');
      console.log(`   Client ID length: ${clientId.length}`);
      console.log(`   Secret length: ${clientSecret.length}`);
      console.log(`   Secret preview: ${clientSecret.substring(0, 5)}...${clientSecret.substring(clientSecret.length - 5)}`);
    }

    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
    // Note: scope parameter causes invalid_client error, omit it

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

    cachedToken = response.data.access_token;
    // Cache for 50 minutes (token expires in 60 min)
    tokenExpireTime = Date.now() + (50 * 60 * 1000);

    console.log('✅ OAuth2 token acquired (valid for 50 min)');
    return cachedToken;
  } catch (err) {
    const errorMsg = err.response?.data?.error || err.message;
    const errorDesc = err.response?.data?.error_description || '';
    console.error('❌ Failed to get OAuth2 token:', errorMsg);
    if (errorDesc) console.error('   Details:', errorDesc);
    return null;
  }
}

module.exports = { getBarentsWatchToken };

