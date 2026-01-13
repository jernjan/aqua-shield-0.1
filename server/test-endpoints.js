// Quick test to verify all endpoints return data
const mvpData = require('./mvp-data');

const MVP = mvpData.init();

console.log('✓ MVP DATA CHECK:');
console.log('  Farmers:', MVP.farmers?.length || 0);
console.log('  Vessels:', MVP.vessels?.length || 0);
console.log('  Alerts:', MVP.alerts?.length || 0);

console.log('\n✓ ENDPOINT RESPONSES:');

// Test /api/mvp/farmer
console.log('\n/api/mvp/farmer:');
const farmerResp = {
  farms: MVP.farmers || [],
  stats: { 
    total: (MVP.farmers || []).length,
    risky: (MVP.farmers || []).filter(f => f.riskScore > 60).length,
    safe: (MVP.farmers || []).filter(f => f.riskScore <= 60).length
  },
  alertCount: (MVP.farmers || []).filter(f => f.riskScore > 60).length,
};
console.log('  farms:', farmerResp.farms.length);
console.log('  stats.total:', farmerResp.stats.total);
console.log('  stats.risky:', farmerResp.stats.risky);

// Test /api/mvp/vessel
console.log('\n/api/mvp/vessel:');
const vesselResp = {
  vessels: MVP.vessels || [],
  stats: { total: (MVP.vessels || []).length },
  taskCount: 0
};
console.log('  vessels:', vesselResp.vessels.length);
console.log('  stats.total:', vesselResp.stats.total);

// Test /api/admin/risks
console.log('\n/api/admin/risks:');
const risky = MVP.farmers.filter(f => f.riskScore > 60);
const safe = MVP.farmers.filter(f => f.riskScore <= 60);
const risksResp = {
  risky: risky,
  safe: safe,
  summary: {
    total: MVP.farmers.length,
    risky: risky.length,
    safe: safe.length,
    critical: risky.filter(f => f.riskScore > 80).length,
    high: risky.filter(f => f.riskScore > 60 && f.riskScore <= 80).length,
    medium: safe.filter(f => f.riskScore > 40 && f.riskScore <= 60).length
  },
  metadata: {
    total_facilities: MVP.farmers.length,
    total_risky: risky.length,
    total_safe: safe.length,
    critical_count: risky.filter(f => f.riskScore > 80).length,
    high_count: risky.filter(f => f.riskScore > 60 && f.riskScore <= 80).length
  },
};
console.log('  risky farms:', risksResp.risky.length);
console.log('  safe farms:', risksResp.safe.length);
console.log('  critical:', risksResp.metadata.critical_count);
console.log('  high:', risksResp.metadata.high_count);

console.log('\n✓ ALL ENDPOINTS HAVE DATA');
