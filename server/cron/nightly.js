const { readDB, saveAlert } = require('../db.js');
const { getAllFacilities } = require('../utils/barentswatch.js');
const { getAllVessels } = require('../utils/ais.js');
const { calculateFacilityRisk, calculateVesselRisk, getRiskLevel } = require('../utils/risk.js');

// Run every night at 03:00 UTC+1
function scheduleCronJob() {
  // For development, run every minute for testing
  // In production, use a proper cron library (node-cron or scheduled task)
  
  console.log('⏰ Cron job scheduled for 03:00 Europe/Oslo');
}

async function runNightlyAnalysis() {
  try {
    console.log('🌙 Starting nightly analysis...');
    
    const db = await readDB();
    const allFacilities = await getAllFacilities();
    const allVessels = await getAllVessels();
    
    // Process each user
    for (const user of db.users) {
      console.log(`📊 Analyzing for ${user.name}...`);
      
      // Get user's facilities
      const userFacilities = allFacilities.filter(f => (user.selectedFacilities || []).includes(f.id));
      
      // Calculate facility risks
      for (const facility of userFacilities) {
        const nearbyFacilities = allFacilities.filter(f => {
          const dist = Math.sqrt(Math.pow(f.lat - facility.lat, 2) + Math.pow(f.lng - facility.lng, 2));
          return dist > 0 && dist < 0.18; // ~20km
        });
        
        // TODO: Fetch real temperature from weather API (currently using mock)
        const temperature = 8 + Math.random() * 4;
        const currentStrength = Math.random() * 0.5;
        
        const riskScore = calculateFacilityRisk(facility, nearbyFacilities, temperature, currentStrength);
        const level = getRiskLevel(riskScore);
        
        // Create alert if risk changed to critical/warning
        const lastAlert = db.alerts
          .filter(a => a.userId === user.id && a.facilityId === facility.id)
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
        
        const shouldAlert = 
          (level === 'kritisk' && (!lastAlert || lastAlert.riskLevel !== 'kritisk')) ||
          (level === 'varsel' && (!lastAlert || lastAlert.riskLevel === 'grønn'));
        
        if (shouldAlert) {
          console.log(`⚠️ NEW ALERT: ${facility.name} - ${level} (score: ${riskScore})`);
          
          const alert = {
            id: 'alert_' + Date.now(),
            userId: user.id,
            type: 'facility',
            facilityId: facility.id,
            facilityName: facility.name,
            facilityPO: facility.po,
            title: `${level === 'kritisk' ? '🔴' : '🟡'} ${level.toUpperCase()}: Smitterisiko på ${facility.name}`,
            message: `Detektert ${level} smitterisiko. Lus: ${facility.liceCount}, Sykdom: ${facility.disease || 'ingen'}`,
            riskLevel: level,
            riskScore: riskScore,
            isRead: false,
            createdAt: new Date().toISOString()
          };
          
          await saveAlert(alert);
          
          // Send notification (for MVP: logged only)
          console.log(`📧 Would send email to ${user.email}`);
        }
      }
      
      // Get user's vessels
      const userVessels = allVessels.filter(v => (user.selectedVessels || []).includes(v.id));
      
      // Check vessel risk (visits to high-risk facilities)
      for (const vessel of userVessels) {
        // Find facilities near vessel within 1 km
        const nearbyFacilities = allFacilities.filter(f => {
          const dist = Math.sqrt(Math.pow(f.lat - vessel.lat, 2) + Math.pow(f.lng - vessel.lng, 2));
          return dist < 0.009; // ~1km
        });
        
        const riskScore = calculateVesselRisk(vessel, nearbyFacilities, nearbyFacilities.length);
        const level = getRiskLevel(riskScore);
        
        if (level === 'kritisk' && nearbyFacilities.some(f => f.disease)) {
          console.log(`⚠️ VESSEL ALERT: ${vessel.name} near diseased facility`);
          
          const alert = {
            id: 'alert_' + Date.now(),
            userId: user.id,
            type: 'vessel',
            vesselId: vessel.id,
            vesselName: vessel.name,
            nearbyFacilities: nearbyFacilities.map(f => ({ id: f.id, name: f.name, disease: f.disease })),
            title: `⚠️ ${vessel.name} passerte rødsone!`,
            message: `Skipet var nær ${nearbyFacilities[0]?.name}. Desinfeksjon anbefalt.`,
            riskLevel: level,
            riskScore: riskScore,
            isRead: false,
            createdAt: new Date().toISOString()
          };
          
          await saveAlert(alert);
        }
      }
    }
    
    console.log('✓ Nightly analysis complete');
  } catch (err) {
    console.error('❌ Nightly analysis failed:', err);
  }
}

module.exports = {
  scheduleCronJob,
  runNightlyAnalysis
};
