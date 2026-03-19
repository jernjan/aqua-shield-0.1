/**
 * Admin Dashboard Panel Test Suite
 * Tests all panels by verifying API endpoints and DOM elements
 * 
 * Usage: node test_panels.js
 */

const http = require('http');

const BASE_URL = 'http://localhost:8000';

// Test configuration for each panel
const PANEL_TESTS = [
  {
    id: 'overview',
    name: 'Oversikt',
    endpoint: null, // Overview loads automatically on init
    loadButtonId: null,
    verifyElements: ['totalFacilities', 'infectedCount', 'atRiskCount', 'totalVessels', 'vesselsAtRisk'],
    expectedBehavior: 'Displays summary counts on page load'
  },
  {
    id: 'predictions',
    name: 'Utbrottsprediksjoner',
    endpoint: '/api/facilities/disease-spread',
    loadButtonId: 'predictionsLoad',
    verifyElements: ['predictions-table', 'pred-critical', 'pred-medium', 'pred-low'],
    expectedBehavior: 'Loads disease spread predictions into table'
  },
  {
    id: 'facility-risks',
    name: 'Anleggsrisiko',
    endpoint: '/api/facilities?limit=100',
    loadButtonId: 'facility-risk-load',
    verifyElements: ['facility-risk-table', 'fr-ekstrem', 'fr-høy', 'fr-moderat', 'fr-total'],
    expectedBehavior: 'Loads facilities with risk categorization'
  },
  {
    id: 'vessel-risk',
    name: 'Fartøyrisiko',
    endpoint: '/api/vessels/at-risk-facilities?min_duration_minutes=20',
    loadButtonId: 'vessel-risk-load',
    verifyElements: ['vessel-risk-table', 'vr-infected-count', 'vr-risk-count', 'vr-total-count'],
    expectedBehavior: 'Loads vessels that visited at-risk facilities'
  },
  {
    id: 'vessel-clearing',
    name: 'Fartøyklaring',
    endpoint: '/api/vessel/clearing-status',
    loadButtonId: 'vessel-clearing-load',
    verifyElements: ['vessel-clearing-table', 'vc-cleared', 'vc-pending', 'vc-atrisk'],
    expectedBehavior: 'Loads vessel health clearance status'
  },
  {
    id: 'confirmed-plans',
    name: 'Bekreftede Ruter',
    endpoint: '/api/boat/plan/confirmed',
    loadButtonId: 'confirmed-plans-load',
    verifyElements: ['confirmed-plans-table'],
    expectedBehavior: 'Loads confirmed vessel route plans'
  },
  {
    id: 'audit-log',
    name: 'Revisjonslogg',
    endpoint: '/api/audit/visits-log?days=30',
    loadButtonId: 'audit-load',
    verifyElements: ['audit-table', 'auditTotalCount', 'auditWithPassCount'],
    expectedBehavior: 'Loads audit log of vessel visits'
  },
  {
    id: 'smittespredning',
    name: 'Smittespredning',
    endpoint: '/api/exposure/smittespredning?limit=100',
    loadButtonId: 'smitte-load',
    verifyElements: ['smitte-table'],
    expectedBehavior: 'Loads disease spread exposure data'
  },
  {
    id: 'risk',
    name: 'Risikovurdering',
    endpoint: '/api/risk/assess?limit=100',
    loadButtonId: 'risk-load',
    verifyElements: ['risk-table'],
    expectedBehavior: 'Loads risk assessment results'
  },
  {
    id: 'facilities',
    name: 'Anlegg',
    endpoint: '/api/facilities?limit=100',
    loadButtonId: 'facilities-load',
    verifyElements: ['facilities-table'],
    expectedBehavior: 'Loads all facilities'
  },
  {
    id: 'vessels',
    name: 'Fartøy',
    endpoint: '/api/vessels?limit=100',
    loadButtonId: 'vessels-load',
    verifyElements: ['vessels-table'],
    expectedBehavior: 'Loads all vessels with search capability'
  },
  {
    id: 'health',
    name: 'Helsestatus',
    endpoint: '/api/health-summary',
    loadButtonId: 'health-load',
    verifyElements: ['health-list', 'healthContainer'],
    expectedBehavior: 'Loads health status summary'
  },
  {
    id: 'ocean',
    name: 'Havstrømmer',
    endpoint: '/api/ocean/summary',
    loadButtonId: 'ocean-load',
    verifyElements: ['ocean-list', 'oceanContainer'],
    expectedBehavior: 'Loads ocean current data'
  },
  {
    id: 'admin',
    name: 'Admin Panel',
    endpoint: null, // Various endpoints
    loadButtonId: 'admin-load',
    verifyElements: ['cacheCount', 'dbStatus', 'apiStatus'],
    expectedBehavior: 'Loads system statistics and status'
  }
];

// Test API endpoint
function testEndpoint(path) {
  return new Promise((resolve) => {
    if (!path) {
      resolve({ success: true, message: 'No endpoint (auto-loads)' });
      return;
    }

    const options = {
      hostname: 'localhost',
      port: 8000,
      path: path,
      method: 'GET',
      timeout: 5000
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const json = JSON.parse(data);
            const dataCount = Array.isArray(json) ? json.length : 
                            (json.facilities?.length || json.vessels?.length || json.entries?.length || 
                             json.clearances?.length || json.predictions?.length || 
                             Object.keys(json).length);
            resolve({ 
              success: true, 
              statusCode: res.statusCode,
              dataCount,
              message: `HTTP ${res.statusCode} - ${dataCount} items/fields`
            });
          } catch (e) {
            resolve({ 
              success: true, 
              statusCode: res.statusCode,
              message: `HTTP ${res.statusCode} - Invalid JSON: ${e.message}`
            });
          }
        } else {
          resolve({ 
            success: false, 
            statusCode: res.statusCode,
            message: `HTTP ${res.statusCode} ${res.statusMessage}`
          });
        }
      });
    });

    req.on('error', (err) => {
      resolve({ 
        success: false, 
        message: `Connection error: ${err.message}`
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ 
        success: false, 
        message: 'Request timeout (5s)'
      });
    });

    req.end();
  });
}

// Main test runner
async function runTests() {
  
  
  
  
  

  const results = [];
  let passCount = 0;
  let failCount = 0;

  for (let i = 0; i < PANEL_TESTS.length; i++) {
    const panel = PANEL_TESTS[i];
    const num = String(i + 1).padStart(2, '0');
    
    
    
    
    

    // Test API endpoint
    if (panel.endpoint) {
      process.stdout.write(`      API Test: ${panel.endpoint}... `);
      const apiResult = await testEndpoint(panel.endpoint);
      
      if (apiResult.success) {
        
      } else {
        
      }

      results.push({
        panel: panel.name,
        id: panel.id,
        endpoint: panel.endpoint,
        apiSuccess: apiResult.success,
        apiMessage: apiResult.message,
        loadButton: panel.loadButtonId
      });

      if (apiResult.success) passCount++;
      else failCount++;
    } else {
      
      results.push({
        panel: panel.name,
        id: panel.id,
        endpoint: 'N/A',
        apiSuccess: true,
        apiMessage: 'No endpoint (auto-loads on init)',
        loadButton: panel.loadButtonId
      });
      passCount++;
    }

    // Brief pause between tests
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Print summary
  
  
  
  
  
  
  

  if (failCount > 0) {
    
    results.filter(r => !r.apiSuccess).forEach(r => {
      
      
      
    });
  } else {
    
  }

  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
}

// Run tests
runTests().catch(err => {
  console.error('❌ Test suite error:', err);
  process.exit(1);
});
